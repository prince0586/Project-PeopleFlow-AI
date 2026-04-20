import React, { useEffect, useState, useMemo } from 'react';
import { Map as MapIcon, Layers, Maximize2, Navigation, AlertCircle } from 'lucide-react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { VenueData, RouteCalculationResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { GateMarker } from './LiveMap/GateMarker';
import { handleFirestoreError } from '../lib/firestoreErrorHandler';

interface LiveMapProps {
  activeRoute?: RouteCalculationResult;
  user?: User | null;
}

/**
 * LiveMap Architecture
 * 
 * Orchestrates a high-fidelity geospatial representation of the venue.
 * Manages real-time telemetry ingestion from Firestore with authoritative
 * error reporting and smooth state transitions.
 * 
 * @component
 */
export const LiveMap = React.memo(({ activeRoute, user }: LiveMapProps) => {
  const [venue, setVenue] = useState<VenueData | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Technical Subscription: Real-time Spatial Telemetry
   */
  useEffect(() => {
    const venueId = 'stadium_01';
    
    // Establishing authoritative telemetry stream
    const unsubscribe = onSnapshot(doc(db, 'venues', venueId), (snapshot) => {
      if (snapshot.exists()) {
        setVenue(snapshot.data() as VenueData);
        setError(null);
      } else {
        console.warn(`[LiveMap] Metadata missing for egress identifier: ${venueId}`);
        setError('Venue metadata offline');
      }
    }, (err) => {
      try {
        handleFirestoreError(err, 'get', `venues/${venueId}`);
      } catch (mappedError: unknown) {
        if (!user) {
          // Graceful degradation for unauthenticated state
          setError('Sign in for live telemetry');
        } else {
          setError('Access restricted');
          const message = mappedError instanceof Error ? mappedError.message : 'Unknown';
          console.error('[LiveMap] Metadata Access Failure:', message);
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  const getCongestionColor = useMemo(() => (level: number) => {
    if (level > 0.7) return '#ef4444'; // accent-red
    if (level > 0.4) return '#f59e0b'; // accent-amber
    return '#10b981'; // accent-green
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full" role="region" aria-labelledby="map-title">
      <div className="flex items-center justify-between">
        <div id="map-title" className="col-title flex items-center gap-2 font-bold text-sm text-text-sub uppercase tracking-wider">
          <MapIcon size={14} aria-hidden="true" />
          Venue Live Map {activeRoute && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-brand flex items-center gap-1 ml-2" 
              aria-live="polite"
            >
              <Navigation size={10} aria-hidden="true" /> Route Active
            </motion.span>
          )}
        </div>
        <div className="flex gap-2">
          {error && (
            <div className="flex items-center gap-1 text-[10px] text-accent-red font-bold uppercase mr-2">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <button className="p-1.5 hover:bg-bg rounded border border-border text-text-sub" aria-label="Toggle Layers"><Layers size={14} /></button>
          <button className="p-1.5 hover:bg-bg rounded border border-border text-text-sub" aria-label="Fullscreen"><Maximize2 size={14} /></button>
        </div>
      </div>

      <div className="flex-1 bg-bg rounded-xl border border-border relative overflow-hidden group">
        <div className="absolute inset-0 bg-[#f8f9fa] flex flex-col items-center justify-center">
          <div className="relative w-full h-full opacity-40 grayscale-[0.5] mix-blend-multiply pointer-events-none">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          </div>
          
          <div className="absolute w-48 h-48 border-4 border-brand/20 rounded-full flex items-center justify-center">
            <div className="w-32 h-32 border-2 border-brand/10 rounded-full" />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 bg-brand rounded-full border-2 border-white shadow-lg relative z-10" />
              <motion.div 
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-8 h-8 bg-brand/20 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" 
              />
            </div>

            <AnimatePresence>
              {venue?.gates.map((gate, index) => {
                const angle = (index / venue.gates.length) * 2 * Math.PI;
                const x = Math.cos(angle) * 96;
                const y = Math.sin(angle) * 96;
                const isRecommended = activeRoute?.recommendedGate?.id === gate.id;

                return (
                  <GateMarker 
                    key={gate.id}
                    gate={gate}
                    isRecommended={isRecommended}
                    x={x}
                    y={y}
                    color={getCongestionColor(gate.congestion)}
                  />
                );
              })}
            </AnimatePresence>

            {activeRoute && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                <motion.path 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  d="M 96 96 L 96 20" 
                  fill="none" 
                  stroke="var(--color-brand)" 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
                  className="animate-[dash_20s_linear_infinite]"
                />
              </svg>
            )}
          </div>

          <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm p-2 rounded border border-border text-[9px] font-bold text-text-sub flex items-center gap-2">
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-accent-red rounded-full" /> High</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-accent-amber rounded-full" /> Med</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-accent-green rounded-full" /> Low</div>
            <span className="ml-2 border-l pl-2">Real-time Data Active</span>
          </div>
        </div>
        
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className="bg-white p-2 rounded shadow-md border border-border">
            <div className="text-[10px] font-bold text-brand mb-1 uppercase">CURRENT LOCATION</div>
            <div className="text-xs font-bold text-text-main">Section 104, Row B</div>
          </div>
        </div>
      </div>
    </div>
  );
});

LiveMap.displayName = 'LiveMap';
