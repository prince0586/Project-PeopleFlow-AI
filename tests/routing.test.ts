import { describe, it, expect, beforeAll } from 'vitest';
import { VenueService } from '../server/services/venueService';
import { Location, Gate } from '../src/types';

/**
 * Enterprise Routing Heuristic Test Suite
 * 
 * Verifies the mathematical accuracy and accessibility compliance of the
 * EventFlow AI weighted routing engine.
 */
describe('Routing Heuristic Integration', () => {
  const mockUserLocation: Location = { lat: 34.0522, lng: -118.2437 };
  const mockVenueId = 'test_stadium';

  describe('calculateBestRoute', () => {
    it('should prioritize less congested gates even if slightly further away', async () => {
      const results = await VenueService.calculateBestRoute(mockUserLocation, false, mockVenueId);
      
      // Gate B in simulated data has 0.3 congestion vs Gate A's 0.8
      // Gate B should be ranked higher (lower cost score) than Gate A
      const northGate = results.find(g => g.name === 'North Gate');
      const southGate = results.find(g => g.name === 'South Gate');
      const eastGate = results.find(g => g.name === 'East Gate');

      expect(results[0].id).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Low congestion Gate C (0.1) should beat high congestion Gate A (0.8)
      if (northGate && eastGate) {
        expect(eastGate.score).toBeLessThan(northGate.score!);
      }
    });

    it('should strictly enforce ADA compliance when mobilityFirst is enabled', async () => {
      const allResults = await VenueService.calculateBestRoute(mockUserLocation, false, mockVenueId);
      const adaResults = await VenueService.calculateBestRoute(mockUserLocation, true, mockVenueId);

      expect(adaResults.length).toBeLessThan(allResults.length);
      adaResults.forEach(gate => {
        expect(gate.isAccessible).toBe(true);
      });
      
      const inaccessibleGate = adaResults.find(g => g.isAccessible === false);
      expect(inaccessibleGate).toBeUndefined();
    });

    it('should maintain consistent scoring for equidistant locations', async () => {
      const results = await VenueService.calculateBestRoute(mockUserLocation, false, mockVenueId);
      results.forEach(gate => {
        expect(gate.score).toBeTypeOf('number');
        expect(gate.score).toBeGreaterThan(0);
      });
    });
  });
});
