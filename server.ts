import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import admin from 'firebase-admin';
import fs from 'fs';
import { VenueService } from './server/services/venueService';
import { AnalyticsService } from './server/services/analyticsService';

dotenv.config();

// --- Firebase Admin Initialization ---
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(firebaseConfigPath)) {
  const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  admin.initializeApp({
    projectId: config.projectId,
  });
}

const db = admin.apps.length ? admin.firestore() : null;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// --- AI Tool Declarations ---
const getQueueStatus = {
  name: "getQueueStatus",
  description: "Get the current status and estimated wait time for the user's active queue tokens.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      userId: { type: SchemaType.STRING, description: "The unique ID of the user." }
    },
    required: ["userId"]
  }
};

const getVenueCongestion = {
  name: "getVenueCongestion",
  description: "Get the current congestion level and gate status for the venue.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      venueId: { type: SchemaType.STRING, description: "The unique ID of the venue." }
    },
    required: ["venueId"]
  }
};

export async function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  /**
   * @route POST /api/route
   * @desc Optimized crowd routing using VenueService and Analytics logging.
   */
  app.post('/api/route', async (req, res) => {
    const { userLocation, mobilityFirst, venueId = 'stadium_01' } = req.body;
    
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

    await AnalyticsService.logEvent({
      type: 'QUEUE_ESTIMATE',
      venueId: venueId as string,
      payload: { serviceType, ewt },
      timestamp: new Date().toISOString()
    });

    res.json({ estimatedWaitTime: ewt, unit: 'minutes', confidence: 0.95 });
  });

  /**
   * @route GET /api/analytics/report
   * @desc Fetch venue performance metrics (Simulated BigQuery Report).
   */
  app.get('/api/analytics/report', async (req, res) => {
    const { venueId = 'stadium_01', type } = req.query;
    const report = await AnalyticsService.getVenueReport(venueId as string, type as string);
    res.json(report);
  });

  /**
   * @route POST /api/chat
   * @desc AI Venue Concierge with Function Calling and Advanced Grounding.
   */
  app.post('/api/chat', async (req, res) => {
    const { message, context, userId } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured." });
    }

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: `You are the FanFlow AI Venue Concierge. 
        Context: ${JSON.stringify(context)}
        Instructions: Provide concise, helpful guidance. Use tools for real-time data. 
        Grounding: You have access to the latest venue safety protocols and facility maps.`,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: message }] }],
        tools: [{ functionDeclarations: [getQueueStatus, getVenueCongestion] } as any],
      });

      const response = result.response;
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const toolResults = [];
        for (const call of functionCalls) {
          let toolResponse;
          if (call.name === "getQueueStatus" && db) {
            const { userId: uid } = call.args as any;
            const snapshot = await db.collection('queues').where('userId', '==', uid).where('status', '==', 'waiting').get();
            toolResponse = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          } else if (call.name === "getVenueCongestion") {
            const venue = await VenueService.getVenueData((call.args as any).venueId || 'stadium_01');
            toolResponse = { congestion: venue.congestionLevel, status: "Normal", gates: venue.gates.map(g => g.name) };
          }

          toolResults.push({
            functionResponse: { name: call.name, response: { result: toolResponse } }
          });
        }

        const secondResult = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: message }] },
            response.candidates![0].content,
            { role: 'user', parts: toolResults as any }
          ]
        });

        return res.json({ text: secondResult.response.text() });
      }

      res.json({ text: response.text() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Vite / Static Files ---
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    // Skip Vite
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
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running at http://localhost:${PORT}`));
  });
}
