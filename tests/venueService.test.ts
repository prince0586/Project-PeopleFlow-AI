import { describe, it, expect, vi } from 'vitest';
import { VenueService } from '../server/services/venueService';

describe('VenueService', () => {
  it('should calculate the best route based on distance and congestion', async () => {
    const userLocation = { lat: 34.0520, lng: -118.2430 };
    const mobilityFirst = false;
    const venueId = 'stadium_01';

    const routes = await VenueService.calculateBestRoute(userLocation, mobilityFirst, venueId);
    
    expect(routes).toBeDefined();
    expect(routes.length).toBeGreaterThan(0);
    // The first gate should have the lowest score
    expect(routes[0].score).toBeLessThanOrEqual(routes[1].score || Infinity);
  });

  it('should filter non-accessible gates when mobilityFirst is true', async () => {
    const userLocation = { lat: 34.0520, lng: -118.2430 };
    const mobilityFirst = true;
    const venueId = 'stadium_01';

    const routes = await VenueService.calculateBestRoute(userLocation, mobilityFirst, venueId);
    
    routes.forEach(gate => {
      expect(gate.isAccessible).toBe(true);
    });
  });
});
