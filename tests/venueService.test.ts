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

  it('should filter strictly for accessible gates when mobilityFirst is enabled', async () => {
    const userLocation = { lat: 34.0522, lng: -118.2437 };
    const mobilityFirst = true;
    const venueId = 'stadium_01';
    
    const routes = await VenueService.calculateBestRoute(userLocation, mobilityFirst, venueId);
    
    expect(routes.every(r => r.isAccessible)).toBe(true);
  });

  it('should handle extreme distances correctly in the scoring heuristic', async () => {
    // Location very far away
    const farLocation = { lat: 40.7128, lng: -74.0060 }; // NYC
    const venueId = 'stadium_01';
    
    const routes = await VenueService.calculateBestRoute(farLocation, false, venueId);
    
    expect(routes).toBeDefined();
    expect(routes.length).toBe(3);
    // Even at extreme distances, the scoring should be consistent
    const firstScore = routes[0].score!;
    const lastScore = routes[2].score!;
    expect(firstScore).toBeLessThanOrEqual(lastScore);
  });
});
