import NodeCache from 'node-cache';
import { executeWithFirestoreFallback } from '../db';
import { Gate, VenueData } from '../../src/types';

/**
 * Venue Cache
 * Cache venue data for 60 seconds to reduce Firestore reads and improve performance.
 */
const venueCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

/**
 * VenueService
 * 
 * Handles venue metadata, gate status, and congestion-aware routing logic.
 * Utilizes in-memory caching to minimize database latency and optimize throughput.
 * 
 * @category Services
 */
export class VenueService {
  /**
   * Fetches venue data with in-memory caching support.
   * 
   * @param venueId - The unique ID of the venue to retrieve.
   * @returns A Promise resolving to the venue metadata and gate status.
   * @example
   * const venue = await VenueService.getVenueData('stadium_01');
   */
  public static async getVenueData(venueId: string): Promise<VenueData> {
    const cachedData = venueCache.get<VenueData>(venueId);
    if (cachedData) {
      return cachedData;
    }

    try {
      const data = await executeWithFirestoreFallback(async (db) => {
        const doc = await db.collection('venues').doc(venueId).get();
        if (doc.exists) {
          return doc.data() as VenueData;
        }
        return null;
      });

      if (data) {
        venueCache.set(venueId, data);
        return data;
      }
    } catch (error) {
      const err = error as Error & { code?: number };
      const errorMsg = (err.message || String(err)).toUpperCase();
      const isAccessError = errorMsg.includes('PERMISSION_DENIED') || 
                           errorMsg.includes('NOT_FOUND') ||
                           err.code === 5 ||
                           err.code === 7;
      
      if (!isAccessError) {
        console.error('[VenueService] Firestore Retrieval Error:', err.message || err);
      }
    }

    return this.getDefaultVenueData(venueId);
  }

  /**
   * Optimized routing algorithm to find the best entry/exit gate.
   * Uses a weighted scoring system: Distance (70%) + Congestion (30%).
   * 
   * @param userLocation - The current lat/lng coordinates of the user.
   * @param mobilityFirst - Boolean flag to prioritize accessible gates.
   * @param venueId - The ID of the venue for which to calculate routing.
   * @returns A Promise resolving to a sorted list of gates with calculated scores.
   */
  public static async calculateBestRoute(
    userLocation: { lat: number, lng: number }, 
    mobilityFirst: boolean, 
    venueId: string
  ): Promise<Gate[]> {
    const venue = await this.getVenueData(venueId);
    const availableGates = mobilityFirst ? venue.gates.filter(g => g.isAccessible) : venue.gates;

    const scoredGates = availableGates.map(gate => {
      // Euclidean distance approximation for performance
      const distance = Math.sqrt(
        Math.pow(gate.lat - userLocation.lat, 2) + 
        Math.pow(gate.lng - userLocation.lng, 2)
      );
      
      // Weighted score calculation: Distance (70%) + Congestion (30%)
      const score = (distance * 0.7) + (gate.congestion * 0.3);
      return { ...gate, score };
    });

    return scoredGates.sort((a, b) => (a.score || 0) - (b.score || 0));
  }

  /**
   * Provides fallback venue data if the database is unreachable.
   * 
   * @param venueId - The ID of the venue.
   * @returns A default VenueData object.
   */
  private static getDefaultVenueData(venueId: string): VenueData {
    return {
      id: venueId,
      name: 'Global Arena',
      congestionLevel: 0.4,
      gates: [
        { id: 'A', name: 'North Gate', lat: 34.0522, lng: -118.2437, isAccessible: true, congestion: 0.8 },
        { id: 'B', name: 'South Gate', lat: 34.0530, lng: -118.2445, isAccessible: true, congestion: 0.3 },
        { id: 'C', name: 'East Gate', lat: 34.0515, lng: -118.2420, isAccessible: false, congestion: 0.1 },
      ]
    };
  }
}
