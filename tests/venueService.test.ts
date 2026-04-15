import { describe, it, expect, vi } from 'vitest';
import { VenueService } from '../server/services/venueService';

describe('VenueService', () => {
  it('should return default venue data when DB is not available', async () => {
    const venueId = 'test_venue';
    const data = await VenueService.getVenueData(venueId);
    
    expect(data).toBeDefined();
    expect(data.id).toBe(venueId);
    expect(data.name).toBe('Global Arena');
    expect(data.gates.length).toBeGreaterThan(0);
  });

  it('should calculate the best route based on distance and congestion', async () => {
    const userLocation = { lat: 34.0522, lng: -118.2437 };
    const mobilityFirst = false;
    const venueId = 'stadium_01';
    
    const routes = await VenueService.calculateBestRoute(userLocation, mobilityFirst, venueId);
    
    expect(routes).toBeDefined();
    expect(routes.length).toBe(3);
    // The first route should be the one with the lowest score
    expect(routes[0].score).toBeLessThanOrEqual(routes[1].score!);
  });
});
