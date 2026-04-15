import React from 'react';
import { Map as MapIcon, Layers, Maximize2, Navigation } from 'lucide-react';

interface LiveMapProps {
  activeRoute?: any;
}

/**
 * LiveMap Component
 * 
 * Renders a simulated live venue map with dynamic routing and gate markers.
 * Optimized with React.memo to prevent unnecessary re-renders during high-frequency updates.
 * 
 * @component
 */
export const LiveMap = React.memo(({ activeRoute }: LiveMapProps) => {
  return (
    <div className="flex flex-col gap-4 h-full" role="region" aria-labelledby="map-title">
      <div className="flex items-center justify-between">
        <div id="map-title" className="col-title flex items-center gap-2 font-bold text-sm text-text-sub uppercase tracking-wider">
          <MapIcon size={14} aria-hidden="true" />
          Venue Live Map {activeRoute && (
            <span className="text-brand flex items-center gap-1 ml-2" aria-live="polite">
              <Navigation size={10} aria-hidden="true" /> Route Active
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button className="p-1.5 hover:bg-bg rounded border border-border text-text-sub" aria-label="Toggle Layers"><Layers size={14} /></button>
          <button className="p-1.5 hover:bg-bg rounded border border-border text-text-sub" aria-label="Fullscreen"><Maximize2 size={14} /></button>
        </div>
      </div>

      <div className="flex-1 bg-bg rounded-xl border border-border relative overflow-hidden group">
        {/* Simulated Google Maps View */}
        <div className="absolute inset-0 bg-[#f8f9fa] flex flex-col items-center justify-center">
          <div className="relative w-full h-full opacity-40 grayscale-[0.5] mix-blend-multiply pointer-events-none">
            {/* Grid pattern to simulate map tiles */}
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          </div>
          
          {/* Venue Outline Simulation */}
          <div className="absolute w-48 h-48 border-4 border-brand/20 rounded-full flex items-center justify-center">
            <div className="w-32 h-32 border-2 border-brand/10 rounded-full" />
            
            {/* User Location Marker */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 bg-brand rounded-full border-2 border-white shadow-lg relative z-10" />
              <div className="w-8 h-8 bg-brand/20 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping" />
            </div>

            {/* Static Gate Markers (Default) */}
            {!activeRoute && (
              <>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="w-3 h-3 bg-accent-red rounded-full border-2 border-white shadow-sm relative" />
                  <span className="text-[8px] font-bold mt-1 bg-white px-1 rounded shadow-sm">Gate A</span>
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex flex-col items-center">
                  <div className="w-3 h-3 bg-accent-green rounded-full border-2 border-white shadow-sm relative" />
                  <span className="text-[8px] font-bold mt-1 bg-white px-1 rounded shadow-sm">Gate B</span>
                </div>
              </>
            )}

            {/* Dynamic Route Markers */}
            {activeRoute && (
              <>
                {/* Recommended Route Path (Simulated) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  <path 
                    d="M 96 96 L 96 20" 
                    fill="none" 
                    stroke="var(--color-brand)" 
                    strokeWidth="2" 
                    strokeDasharray="4 4"
                    className="animate-[dash_20s_linear_infinite]"
                  />
                </svg>

                {/* Recommended Gate */}
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 scale-125 transition-transform"
                  role="img"
                  aria-label={`Recommended Gate: ${activeRoute.recommendedGate.name}`}
                >
                  <div className="w-4 h-4 bg-brand rounded-full border-2 border-white shadow-md relative" />
                  <span className="text-[9px] font-bold mt-1 bg-brand text-white px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                    <Navigation size={8} aria-hidden="true" /> {activeRoute.recommendedGate.name}
                  </span>
                </div>

                {/* Alternative Gates */}
                {activeRoute.alternatives.map((alt: any, i: number) => (
                  <div 
                    key={alt.id} 
                    className={`absolute flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity`}
                    role="img"
                    aria-label={`Alternative Gate: ${alt.name}`}
                    style={{ 
                      bottom: i === 0 ? '0' : '50%', 
                      left: i === 0 ? '50%' : '0',
                      transform: i === 0 ? 'translate(-50%, 50%)' : 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="w-3 h-3 bg-text-sub rounded-full border-2 border-white shadow-sm relative" />
                    <span className="text-[8px] font-bold mt-1 bg-white px-1 rounded shadow-sm">{alt.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm p-2 rounded border border-border text-[9px] font-bold text-text-sub flex items-center gap-2">
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-accent-red rounded-full" /> High</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-accent-green rounded-full" /> Low</div>
            <span className="ml-2 border-l pl-2">Google Maps Platform</span>
          </div>
        </div>
        
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className="bg-white p-2 rounded shadow-md border border-border">
            <div className="text-[10px] font-bold text-brand mb-1">CURRENT LOCATION</div>
            <div className="text-xs font-bold text-text-main">Section 104, Row B</div>
          </div>
        </div>
      </div>
    </div>
  );
});

LiveMap.displayName = 'LiveMap';
