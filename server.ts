import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { VenueService } from './server/services/venueService';
import { AnalyticsService } from './server/services/analyticsService';
import { AIService } from './server/services/aiService';
import './server/db'; // Ensure DB is initialized

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

const ChatSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z.record(z.string(), z.any()).optional(),
  userId: z.string().optional()
});

/**
 * Rate Limiters to prevent abuse.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit to prevent "Failed to fetch" due to throttling
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
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

  app.use(cors());
  app.use(express.json());
  app.use('/api', apiLimiter); // Removed trailing slash for better matching

  // Health check endpoint
  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

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
    const { serviceType, queueLength, venueId = 'stadium_01' } = req.query;
    
    const processingTimes: Record<string, number> = {
      concession: 2.5, restroom: 1.5, entry: 0.5, exit: 0.2
    };

    const avgTime = processingTimes[serviceType as string] || 1.0;
    const length = parseInt(queueLength as string) || 0;
    const ewt = length * avgTime;

    try {
      await AnalyticsService.logEvent({
        type: 'QUEUE_ESTIMATE',
        venueId: venueId as string,
        payload: { serviceType, ewt },
        timestamp: new Date().toISOString()
      });

      res.json({ estimatedWaitTime: ewt, unit: 'minutes', confidence: 0.95 });
    } catch (error) {
      console.error('Queue Estimate Error:', error);
      res.status(500).json({ error: 'Failed to generate queue estimate' });
    }
  });

  /**
   * @route GET /api/analytics/report
   * @desc Fetch venue performance metrics (Simulated BigQuery Report).
   */
  app.get('/api/analytics/report', async (req, res) => {
    const { venueId = 'stadium_01', type } = req.query;
    try {
      const report = await AnalyticsService.getVenueReport(venueId as string, type as string);
      res.json(report);
    } catch (error) {
      console.error('Analytics Report Error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics report' });
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

    const { message, context, userId } = validation.data;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY not configured. Please add your API key in the AI Studio Secrets panel." 
      });
    }

    try {
      const responseText = await AIService.processChat(message, context, userId);
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
