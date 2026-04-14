import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../server';
import { Express } from 'express';

describe('FanFlow AI API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createServer();
  });

  describe('POST /api/route', () => {
    it('should return a recommended gate and alternatives', async () => {
      const res = await request(app)
        .post('/api/route')
        .send({
          userLocation: { lat: 34.0520, lng: -118.2430 },
          mobilityFirst: false
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('recommendedGate');
      expect(res.body).toHaveProperty('alternatives');
      expect(Array.isArray(res.body.alternatives)).toBe(true);
    });

    it('should filter for accessible gates when mobilityFirst is true', async () => {
      const res = await request(app)
        .post('/api/route')
        .send({
          userLocation: { lat: 34.0520, lng: -118.2430 },
          mobilityFirst: true
        });

      expect(res.status).toBe(200);
      expect(res.body.recommendedGate.isAccessible).toBe(true);
      res.body.alternatives.forEach((gate: any) => {
        expect(gate.isAccessible).toBe(true);
      });
    });
  });

  describe('GET /api/queue/estimate', () => {
    it('should return an estimated wait time', async () => {
      const res = await request(app)
        .get('/api/queue/estimate')
        .query({ serviceType: 'concession', queueLength: '10' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('estimatedWaitTime');
      expect(res.body.estimatedWaitTime).toBe(25); // 10 * 2.5
    });

    it('should handle missing parameters gracefully', async () => {
      const res = await request(app).get('/api/queue/estimate');
      expect(res.status).toBe(200);
      expect(res.body.estimatedWaitTime).toBe(0);
    });
  });
});
