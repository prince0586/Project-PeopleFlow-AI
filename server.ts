import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import helmet from 'helmet';
import compression from 'compression';
import { VenueService } from './server/services/venueService';
import { AnalyticsService } from './server/services/analyticsService';
import { AIService } from './server/services/aiService';
import { getFirestoreDB, executeWithFirestoreFallback } from './server/db';

dotenv.config();

/**
 * Validation Schemas for API requests.
 */
const RouteSchema = z.object({
  userLocation: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  mobilityFirst: z.boolean().optional(),
  venueId: z.string().optional()
});

const AnalyticsQuerySchema = z.object({
  venueId: z.string().optional().default('stadium_01'),
  type: z.string().optional()
});

const QueueQuerySchema = z.object({
  serviceType: z.enum(['concession', 'restroom', 'entry', 'exit']).optional(),
  queueLength: z.string().regex(/^\d+$/).optional().default('0'),
  venueId: z.string().optional().default('stadium_01')
});

const ChatSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.undefined()])).optional(),
  userId: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string()
  })).optional()
});

/**
 * Rate Limiters to prevent abuse.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased limit significantly to prevent "Failed to fetch"
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: { error: 'AI limit reached. Please wait an hour.' }
});

// Initialize AI Service
if (process.env.GEMINI_API_KEY) {
  AIService.init(process.env.GEMINI_API_KEY);
}

/**
 * Creates and configures the Express application.
 */
export async function createServer() {
  const app = express();
  
  // Trust proxy is required for express-rate-limit to work correctly behind Cloud Run/Nginx
  app.set('trust proxy', 1);

  // Security and Performance Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development/Vite compatibility
    crossOriginEmbedderPolicy: false
  }));
  app.use(compression());
  app.use(cors());
  app.use(express.json());
  
  // Health check endpoint (not rate limited)
  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Analytics Report (not rate limited for dashboard availability)
  app.get('/api/analytics/report', async (req, res) => {
    const validation = AnalyticsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: validation.error.format() });
    }

    const { venueId, type } = validation.data;
    console.log(`[Server] Analytics Report requested for venue: ${venueId}, type: ${type}`);
    try {
      const report = await AnalyticsService.getVenueReport(venueId, type);
      res.json(report);
    } catch (error) {
      console.error('Analytics Report Error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics report' });
    }
  });

  // Seed analytics in background
  AnalyticsService.seedAnalytics().catch(e => console.error('[Server] Seeding failed:', e));

  app.use('/api', apiLimiter); 

  // --- API Routes ---

  /**
   * @route POST /api/route
   * @desc Optimized crowd routing using VenueService and Analytics logging.
   */
  app.post('/api/route', async (req, res) => {
    const validation = RouteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error });
    }

    const { userLocation, mobilityFirst, venueId = 'stadium_01' } = validation.data;
    
    try {
      const scoredGates = await VenueService.calculateBestRoute(
        userLocation || { lat: 34.0520, lng: -118.2430 },
        !!mobilityFirst,
        venueId
      );

      // Log analytics to "BigQuery"
      await AnalyticsService.logEvent({
        type: 'ROUTE_CALCULATION',
        venueId,
        payload: { mobilityFirst, gateSelected: scoredGates[0].id },
        timestamp: new Date().toISOString()
      });

      res.json({
        recommendedGate: scoredGates[0],
        alternatives: scoredGates.slice(1),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Routing Error:', error);
      res.status(500).json({ error: 'Routing calculation failed' });
    }
  });

  /**
   * @route GET /api/queue/estimate
   * @desc Wait time estimation with analytics integration.
   */
  app.get('/api/queue/estimate', async (req, res) => {
    const validation = QueueQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: validation.error.format() });
    }

    const { serviceType, queueLength, venueId } = validation.data;
    
    const processingTimes: Record<string, number> = {
      concession: 2.5, restroom: 1.5, entry: 0.5, exit: 0.2
    };

    const avgTime = processingTimes[serviceType as string] || 1.0;
    const length = parseInt(queueLength) || 0;
    const ewt = length * avgTime;

    try {
      await AnalyticsService.logEvent({
        type: 'QUEUE_ESTIMATE',
        venueId,
        payload: { serviceType: serviceType || 'unknown', ewt },
        timestamp: new Date().toISOString()
      });

      res.json({ estimatedWaitTime: ewt, unit: 'minutes', confidence: 0.95 });
    } catch (error) {
      console.error('Queue Estimate Error:', error);
      res.status(500).json({ error: 'Failed to generate queue estimate' });
    }
  });

  /**
   * @route POST /api/chat
   * @desc AI Venue Concierge with Function Calling and Advanced Grounding.
   */
  app.post('/api/chat', aiLimiter, async (req, res) => {
    const validation = ChatSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid chat message', details: validation.error });
    }

    const { message, context, userId, history } = validation.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY not configured. Please add your API key in the AI Studio Secrets panel." 
      });
    }

    try {
      // Fetch past user interactions for personalization
      let pastInteractions: any[] = [];
      if (userId) {
        try {
          pastInteractions = await executeWithFirestoreFallback(async (db) => {
            const snapshot = await db.collection('user_interactions')
              .where('userId', '==', userId)
              .orderBy('timestamp', 'desc')
              .limit(5)
              .get();
            return snapshot.docs.map(doc => doc.data().message);
          });
        } catch (err: any) {
          // Ignore interaction fetch errors to keep chat functional
        }
      }

      const enhancedContext = {
        ...context,
        pastInteractions,
        timestamp: new Date().toISOString()
      };

      const responseText = await AIService.processChat(message, enhancedContext, userId, history);
      res.json({ text: responseText });
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      res.status(500).json({ error: error.message || 'AI processing failed' });
    }
  });

  // --- Vite / Static Files ---
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    // Skip Vite in test environment
  } else if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // Global Error Handler
  app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Error Handler]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  createServer().then(app => {
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] FanFlow AI Backend running at http://0.0.0.0:${PORT}`);
      console.log(`[Server] Health check: http://0.0.0.0:${PORT}/api/health`);
    });
  }).catch(err => {
    console.error('[Server] Failed to start server:', err);
  });
}
