import NodeCache from 'node-cache';
import admin from 'firebase-admin';
import { Gate, VenueData } from '../../src/types';

// Cache venue data for 60 seconds to reduce Firestore reads and improve performance
const venueCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

/**
 * Venue Service
 * Handles venue metadata, gate status, and congestion routing.
 */
export class VenueService {
  /**
   * Fetches venue data with in-memory caching.
   */
  static async getVenueData(venueId: string): Promise<VenueData> {
    const cachedData = venueCache.get<VenueData>(venueId);
    if (cachedData) {
      return cachedData;
    }

    // Default simulated data if Firestore is not available or document missing
    const defaultData: VenueData = {
      id: venueId,
      name: 'Global Arena',
      congestionLevel: 0.4,
      gates: [
        { id: 'A', name: 'North Gate', lat: 34.0522, lng: -118.2437, isAccessible: true, congestion: 0.8 },
        { id: 'B', name: 'South Gate', lat: 34.0530, lng: -118.2445, isAccessible: true, congestion: 0.3 },
        { id: 'C', name: 'East Gate', lat: 34.0515, lng: -118.2420, isAccessible: false, congestion: 0.1 },
      ]
    };

    const db = admin.apps.length ? admin.firestore() : null;
    if (db) {
      try {
        const doc = await db.collection('venues').doc(venueId).get();
        if (doc.exists) {
          const data = doc.data() as VenueData;
          venueCache.set(venueId, data);
          return data;
        }
      } catch (error) {
        console.error('Firestore Error in VenueService:', error);
      }
    }

    return defaultData;
  }

  /**
   * Optimized routing algorithm.
   * O(N log N) complexity.
   */
  static async calculateBestRoute(userLocation: { lat: number, lng: number }, mobilityFirst: boolean, venueId: string) {
    const venue = await this.getVenueData(venueId);
    const availableGates = mobilityFirst ? venue.gates.filter(g => g.isAccessible) : venue.gates;

    const scoredGates = availableGates.map(gate => {
      // Haversine-like distance approximation
      const distance = Math.sqrt(
        Math.pow(gate.lat - userLocation.lat, 2) + 
        Math.pow(gate.lng - userLocation.lng, 2)
      );
      // Weighted score: Distance (70%) + Congestion (30%)
      const score = (distance * 0.7) + (gate.congestion * 0.3);
      return { ...gate, score };
    });

    return scoredGates.sort((a, b) => (a.score || 0) - (b.score || 0));
  }
}
