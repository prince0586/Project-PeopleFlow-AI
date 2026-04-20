import { describe, it, expect, vi } from 'vitest';
import { VenueService } from '../server/services/venueService';

describe('VenueService - Internal Heuristic Engine', () => {
  it('should rank a less congested far gate over a highly congested near gate', async () => {
    // Mock user at North Gate coordinates
    const userLocation = { lat: 34.0522, lng: -118.2437 };
    
    // According to getDefaultVenueData:
    // A: North Gate (Dist=0, Congestion=0.8) -> Score: (0 * 0.4) + (80 * 0.6) = 48
    // B: South Gate (Dist=0.0011, Congestion=0.3) -> Score: (1.1 * 0.4) + (30 * 0.6) = 0.44 + 18 = 18.44
    // C: East Gate (Dist=0.0018, Congestion=0.1) -> Score: (1.8 * 0.4) + (10 * 0.6) = 0.72 + 6 = 6.72
    
    const results = await VenueService.calculateBestRoute(userLocation, false, 'test_venue');
    
    // East Gate (C) should be first despite being further than A because it has much lower congestion
    expect(results[0].id).toBe('C');
    expect(results[results.length - 1].id).toBe('A');
  });

  it('should strictly filter unavailable gates when mobilityFirst is active', async () => {
    const userLocation = { lat: 34.0522, lng: -118.2437 };
    const results = await VenueService.calculateBestRoute(userLocation, true, 'test_venue');
    
    // Gate C is NOT accessible
    const hasInaccessibleGate = results.some(g => !g.isAccessible);
    expect(hasInaccessibleGate).toBe(false);
    expect(results.find(g => g.id === 'C')).toBeUndefined();
  });
});
