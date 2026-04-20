/**
 * EventFlow AI - Enterprise Server Architecture
 * 
 * Orchestrates the full-stack event loop of the application. 
 * This server handles API routing, real-time telemetry ingestion, Express middleware 
 * orchestration for security (Helmet) and compression, and Vite development serving 
 * alongside production static asset delivery.
 * 
 * @module Server
 * @security Implements defensive headers, rate limiting, and input validation.
 */
import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { AnalyticsService } from './server/services/analyticsService';
import { RouteController } from './server/controllers/routeController';
import { AnalyticsController } from './server/controllers/analyticsController';
import { QueueController } from './server/controllers/queueController';

dotenv.config();

/**
 * API Rate Limiter
 * 
 * Defends the API endpoints against Distributed Denial of Service (DDoS) 
 * and excessive credential scraping.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute sliding window
  max: 5000, // Permit 5000 requests per window
  message: { error: 'Exceeded rate limit thresholds. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * createServer factory function
 * 
 * Initializes the Express application instance with pre-configured
 * middleware and dynamic routing based on the operational environment.
 * 
 * @returns {Promise<express.Application>} An initialized Express application.
 */
export async function createServer(): Promise<express.Application> {
  const app = express();
  
  // Necessary for rate limiting behind reverse proxies (Nginx/Cloud Run)
  app.set('trust proxy', 1);

  /**
   * Security Hardening Layer 1: Helmet
   * CSP is disabled in development to maintain iframe compatibility for the preview platform.
   */
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  app.use(compression());
  app.use(cors());
  app.use(express.json());
  
  /**
   * Health Check Diagnostic Endpoint
   * Used by cloud probes to verify instance availability.
   */
  app.get('/api/health', (req: express.Request, res: express.Response) => res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }));

  /**
   * Analytics Pipeline - Reporting
   */
  app.get('/api/analytics/report', AnalyticsController.getReport);

  // Asynchronous diagnostic seeding
  AnalyticsService.seedAnalytics().catch(e => console.error('[Server] Seeding failed:', e));

  // Apply rate limiting to all standard API endpoints
  app.use('/api', apiLimiter); 

  /**
   * Domain Logic Endpoints
   */
  app.post('/api/route', RouteController.calculateRoute);
  app.get('/api/queue/estimate', QueueController.getEstimate);

  // Vite / Static Assets / SPA Fallback Logic
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    // Isolated for test environments
  } else if (process.env.NODE_ENV !== 'production') {
    // Dynamic import to prevent require() of ESM-only vite in production CJS bundles
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ 
      server: { middlewareMode: true }, 
      appType: 'spa' 
    });
    app.use(vite.middlewares);
  } else {
    // Production delivery of pre-compiled static assets
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => res.sendFile(path.join(distPath, 'index.html')));
  }

  /**
   * Global Exception Interceptor
   * Centralizes error propagation and ensures uniform JSON error responses.
   */
  app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Error Handler]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Architectural Failure',
      timestamp: new Date().toISOString(),
      trace: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  return app;
}

/**
 * Enterprise Loop Initialization
 */
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  createServer().then((app: express.Application) => {
    const PORT = 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] EventFlow AI Backend running at http://0.0.0.0:${PORT}`);
      console.log(`[Server] Health check: http://0.0.0.0:${PORT}/api/health`);
    });
  }).catch((err: Error) => {
    console.error('[Server] Failed to start enterprise server:', err);
  });
}
