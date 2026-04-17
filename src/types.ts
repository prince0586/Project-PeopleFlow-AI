/**
 * Shared types for FanFlow AI
 */

/**
 * Geographic coordinates.
 */
export interface Location {
  lat: number;
  lng: number;
}

/**
 * Represents a venue gate with its status and location.
 */
export interface Gate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isAccessible: boolean;
  congestion: number;
  score?: number;
}

/**
 * Root venue data structure.
 */
export interface VenueData {
  id: string;
  name: string;
  congestionLevel: number;
  gates: Gate[];
}

/**
 * A user's token in a virtual queue.
 */
export interface QueueToken {
  id: string;
  userId: string;
  venueId: string;
  serviceType: 'concession' | 'restroom' | 'entry' | 'exit';
  status: 'waiting' | 'called' | 'completed' | 'cancelled';
  joinedAt: string;
  estimatedWaitTime: number;
}

/**
 * A message in the AI chat interface.
 */
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

/**
 * Enhanced context for Chat API
 */
export interface ChatContext extends Record<string, string | number | boolean | string[] | undefined> {
  venue?: string;
  user?: string;
  activeTokens?: number;
  timestamp?: string;
  pastInteractions?: string[];
}

/**
 * Chat history item for Gemini integration
 */
export interface ChatHistoryItem {
  role: 'user' | 'model';
  content: string;
}

/**
 * An event logged to the analytics system.
 */
export interface AnalyticsEvent {
  type: string;
  userId?: string;
  venueId: string;
  payload: any;
  timestamp: string;
}

/**
 * A performance report generated from analytics data.
 */
export interface AnalyticsReport {
  venueId: string;
  eventType: string;
  period: string;
  peakCongestion: number;
  avgWaitTime: number;
  totalThroughput: number;
  generatedAt: string;
  status: string;
  warning?: string;
}
