/**
 * Shared types for FanFlow AI
 */

export interface Location {
  lat: number;
  lng: number;
}

export interface Gate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isAccessible: boolean;
  congestion: number;
  score?: number;
}

export interface VenueData {
  id: string;
  name: string;
  congestionLevel: number;
  gates: Gate[];
}

export interface QueueToken {
  id: string;
  userId: string;
  venueId: string;
  serviceType: 'concession' | 'restroom' | 'entry' | 'exit';
  status: 'waiting' | 'called' | 'completed' | 'cancelled';
  joinedAt: string;
  estimatedWaitTime: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface AnalyticsEvent {
  type: string;
  userId?: string;
  venueId: string;
  payload: any;
  timestamp: string;
}
