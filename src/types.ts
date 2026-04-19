/**
 * Shared types for EventFlow AI.
 * This module defines the core data model with strict TypeScript interfaces
 * and discriminated unions to ensure end-to-end type safety.
 */

/**
 * Geographic coordinates in decimal degrees.
 */
export interface Location {
  /** Latitude in decimal degrees (e.g., 34.0522) */
  lat: number;
  /** Longitude in decimal degrees (e.g., -118.2437) */
  lng: number;
}

/**
 * Represents a venue gate with its status and accessibility features.
 * Used for the weighted crowd routing heuristic.
 */
export interface Gate {
  /** Unique gate identifier (e.g., "gate_north") */
  id: string;
  /** Human-readable gate name */
  name: string;
  /** Geographic latitude */
  lat: number;
  /** Geographic longitude */
  lng: number;
  /** Whether the gate supports mobility-restricted access (ADA compliance) */
  isAccessible: boolean;
  /** Real-time congestion level (0.0 to 1.0) */
  congestion: number;
  /** Internal heuristic score calculated during routing (Lower is better) */
  score?: number;
}

/**
 * Root venue data structure.
 * Represents the current state of a stadium or event space.
 */
export interface VenueData {
  /** Unique venue identifier (e.g., "stadium_01") */
  id: string;
  /** Full name of the venue */
  name: string;
  /** Aggregate congestion level for the entire facility */
  congestionLevel: number;
  /** List of individual gates and access points */
  gates: Gate[];
}

/**
 * Valid service types for virtual queuing.
 */
export type ServiceType = 'concession' | 'restroom' | 'entry' | 'exit';

/**
 * Valid status states for a queue token.
 */
export type QueueStatus = 'waiting' | 'called' | 'completed' | 'cancelled';

/**
 * A user's token in a virtual queue.
 * Implements a time-ordered tracking system for venue amenities.
 */
export interface QueueToken {
  /** Unique token identifier */
  id: string;
  /** The Firebase UID of the token owner */
  userId: string;
  /** Reference to the venue where the token is active */
  venueId: string;
  /** The type of service being queued for */
  serviceType: ServiceType;
  /** Current state of the token in the lifecycle */
  status: QueueStatus;
  /** ISO 8601 timestamp when the user joined the queue */
  joinedAt: string;
  /** Calculated estimated wait time in minutes */
  estimatedWaitTime: number;
}

/**
 * A message in the human-AI conversational interface.
 */
export interface ChatMessage {
  /** Role in the conversation (user input vs model response) */
  role: 'user' | 'model';
  /** The text content of the message */
  content: string;
  /** ISO 8601 timestamp of message generation */
  timestamp: string;
}

/**
 * Enhanced context provided to the Gemini 1.5 Flash API.
 * Contains real-time telemetry and user-specific state for grounding.
 */
export interface ChatContext extends Record<string, string | number | boolean | string[] | undefined> {
  /** Current active venue */
  venue?: string;
  /** Display name of the user */
  user?: string;
  /** Number of active queue tokens currently held by the user */
  activeTokens?: number;
  /** Current system timestamp */
  timestamp?: string;
  /** List of recent messages for multi-turn personalization */
  pastInteractions?: string[];
}

/**
 * Raw chat history item formatted for the Google Generative AI SDK.
 */
export interface ChatHistoryItem {
  /** Role in history */
  role: 'user' | 'model';
  /** Message content */
  content: string;
}

/**
 * Represents the calculated routing result including recommended path and alternatives.
 */
export interface RouteCalculationResult {
  /** The primary high-performance route recommendation */
  recommendedGate: Gate;
  /** Alternative ingress/egress points ranked by heuristic score */
  alternatives: Gate[];
  /** Geographic center of the request */
  requestLocation: Location;
}

/**
 * An analytical event logged to the telemetry system.
 * Used for enterprise performance reporting and traffic analysis.
 */
export interface AnalyticsEvent {
  /** The classification of the event (e.g., "ROUTE_CALCULATION") */
  type: string;
  /** Optional user identifier associated with the event */
  userId?: string;
  /** Mandatory venue identifier */
  venueId: string;
  /** Arbitrary data payload specific to the event type */
  payload: Record<string, string | number | boolean | null | undefined>;
  /** ISO 8601 creation timestamp */
  timestamp: string;
}

/**
 * A sophisticated performance report derived from aggregate analytics.
 */
export interface AnalyticsReport {
  /** Reference to the venue in scope */
  venueId: string;
  /** The segment of events analyzed (e.g., "Queue Flow") */
  eventType: string;
  /** The time window for the analysis (e.g., "Last 60 Minutes") */
  period: string;
  /** Highest recorded congestion points in the period */
  peakCongestion: number;
  /** Arithmetic mean of wait times in minutes */
  avgWaitTime: number;
  /** Total count of processed sessions (throughput) */
  totalThroughput: number;
  /** ISO 8601 generation timestamp */
  generatedAt: string;
  /** Status of the processing pipeline */
  status: 'Complete' | 'Partial' | 'Degraded';
  /** Optional warnings about data gaps or anomalies */
  warning?: string;
  /** Flag indicating if anomalous patterns were detected in the telemetry stream */
  anomaliesDetected?: boolean;
  /** High-level operational insight derived from data aggregation */
  insights?: string;
}
