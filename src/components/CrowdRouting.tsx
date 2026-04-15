import React, { useState, useCallback } from 'react';
import { Navigation, Clock, Accessibility, MapPin } from 'lucide-react';
import { Gate } from '../types';

interface CrowdRoutingProps {
  onRouteCalculated?: (route: any) => void;
}

export const CrowdRouting = React.memo(({ onRouteCalculated }: CrowdRoutingProps) => {
  const [route, setRoute] = useState<{ recommendedGate: Gate; alternatives: Gate[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobilityFirst, setMobilityFirst] = useState(false);

  const getBestRoute = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobilityFirst, userLocation: { lat: 34.0520, lng: -118.2430 } })
      });
      const data = await res.json();
      setRoute(data);
      if (onRouteCalculated) {
        onRouteCalculated(data);
      }
    } catch (err) {
      console.error('Routing Error:', err);
    } finally {
      setLoading(false);
    }
  }, [mobilityFirst, onRouteCalculated]);

  return (
    <div className="flex flex-col gap-6 h-full" role="region" aria-labelledby="routing-title">
      <div id="routing-title" className="col-title flex items-center gap-2 font-bold text-sm text-text-sub uppercase tracking-wider">
        <Navigation size={14} aria-hidden="true" />
        Dynamic Routing Engine
      </div>
      
      <div className="flex-1 bg-bg rounded-xl border border-border relative overflow-hidden flex flex-col items-center justify-center p-8 transition-all hover:shadow-md">
        {route ? (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="card p-5 bg-surface border border-border rounded-xl shadow-sm">
              <div className="text-[12px] text-brand font-bold mb-1 uppercase tracking-widest">RECOMMENDED PATH</div>
              <h3 className="text-xl font-bold mb-2">{route.recommendedGate.name}</h3>
              <div className="flex items-center gap-4 text-sm text-text-sub">
                <div className="flex items-center gap-1" aria-label={`Estimated wait time: ${Math.round(route.recommendedGate.congestion * 15)} minutes`}>
                  <Clock size={14} aria-hidden="true" />
                  {Math.round(route.recommendedGate.congestion * 15)}m wait
                </div>
                <div className="flex items-center gap-1" aria-label={`Accessibility: ${route.recommendedGate.isAccessible ? 'Accessible' : 'Standard'}`}>
                  <Accessibility size={14} aria-hidden="true" />
                  {route.recommendedGate.isAccessible ? 'Accessible' : 'Standard'}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-text-sub font-bold">Alternative Gates</p>
              {route.alternatives.map((alt) => (
                <div key={alt.id} className="flex justify-between items-center text-sm p-3 bg-surface rounded-lg border border-border hover:border-brand/30 transition-colors">
                  <span className="font-medium">{alt.name}</span>
                  <span className="text-text-sub font-mono">+{Math.round((alt.score || 0) * 100)}m</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto border border-border shadow-sm animate-pulse">
              <MapPin size={24} className="text-brand" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-lg">Ready to Route</h3>
              <p className="text-sm text-text-sub max-w-[200px] mx-auto">Calculate the most efficient path based on real-time venue congestion.</p>
            </div>
            <button 
              onClick={getBestRoute}
              disabled={loading}
              className="bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-all disabled:opacity-50 shadow-sm focus:ring-2 focus:ring-brand focus:ring-offset-2"
              aria-busy={loading}
            >
              {loading ? 'Analyzing Venue...' : 'Initialize Routing'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${mobilityFirst ? 'bg-brand/10 text-brand' : 'bg-bg text-text-sub'}`}>
            <Accessibility size={20} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold">Mobility-First</p>
            <p className="text-[11px] text-text-sub">Prioritize accessible paths</p>
          </div>
        </div>
        <button 
          onClick={() => setMobilityFirst(!mobilityFirst)}
          className={`w-12 h-6 rounded-full relative transition-all focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${mobilityFirst ? 'bg-brand' : 'bg-border'}`}
          aria-pressed={mobilityFirst}
          aria-label="Toggle Mobility-First Routing"
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${mobilityFirst ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );
});

CrowdRouting.displayName = 'CrowdRouting';
