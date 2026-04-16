import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Activity, PieChart } from 'lucide-react';

/**
 * AnalyticsDashboard Component
 * 
 * Displays real-time venue performance metrics retrieved from the simulated BigQuery backend.
 * Features automatic polling and detailed loading/error states for high reliability.
 * 
 * @component
 */
export const AnalyticsDashboard = React.memo(() => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string>('stadium_01');
  const [eventType, setEventType] = useState<string>('');

  /**
   * Effect hook to fetch analytics reports on mount and when filters change.
   * Includes a 30-second polling interval for real-time updates and retry logic.
   */
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const fetchReport = async (signal?: AbortSignal) => {
      if (!isMounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const url = `/api/analytics/report?venueId=${venueId}${eventType ? `&type=${eventType}` : ''}`;
        const res = await fetch(url, { signal });
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned non-JSON response. It might be restarting.');
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        if (isMounted) {
          setReport(data);
          retryCount = 0; // Reset retry count on success
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        
        console.error('[AnalyticsDashboard] Fetch Error:', err);
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
          setError(message);
          
          // Retry logic for "Failed to fetch" (network errors)
          if ((message.includes('Failed to fetch') || message.includes('Query Timeout')) && retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`[AnalyticsDashboard] Retrying fetch (${retryCount}/${MAX_RETRIES})...`);
            setTimeout(() => fetchReport(signal), 2000 * retryCount);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    const controller = new AbortController();
    fetchReport(controller.signal);
    const interval = setInterval(() => fetchReport(controller.signal), 30000); 
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [venueId, eventType]);

  if (loading && !report) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-4 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-3 w-24 bg-bg rounded" />
          <div className="h-3 w-12 bg-bg rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-8 bg-bg rounded" />
          <div className="h-8 bg-bg rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-2 w-16 bg-bg rounded" />
            <div className="h-6 w-12 bg-bg rounded" />
            <div className="h-1 bg-bg rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-2 w-16 bg-bg rounded" />
            <div className="h-6 w-12 bg-bg rounded" />
            <div className="h-1 bg-bg rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="bg-surface border border-accent-red/50 rounded-xl p-4 shadow-sm text-center">
        <p className="text-xs text-accent-red font-bold mb-2">Analytics Unavailable</p>
        <p className="text-[10px] text-text-sub italic">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 text-[9px] bg-bg border border-border px-2 py-1 rounded hover:bg-surface transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm" role="region" aria-labelledby="analytics-title">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <div id="analytics-title" className="flex items-center gap-2 font-bold text-[10px] text-text-sub uppercase tracking-widest">
            <BarChart3 size={12} aria-hidden="true" />
            Venue Intelligence (BigQuery)
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded" aria-label="System is live">
            <Activity size={10} aria-hidden="true" /> LIVE
          </div>
        </div>

        {report?.warning && (
          <div className="bg-accent-red/5 border border-accent-red/20 rounded p-2 text-[8px] text-accent-red italic leading-tight">
            ⚠️ {report.warning}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <select 
            value={venueId} 
            onChange={(e) => setVenueId(e.target.value)}
            className="text-[10px] bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand"
            aria-label="Filter by Venue"
          >
            <option value="stadium_01">Stadium 01</option>
            <option value="arena_02">Arena 02</option>
            <option value="hall_03">Hall 03</option>
          </select>
          <select 
            value={eventType} 
            onChange={(e) => setEventType(e.target.value)}
            className="text-[10px] bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand"
            aria-label="Filter by Event Type"
          >
            <option value="">All Events</option>
            <option value="ROUTE_CALCULATION">Routing</option>
            <option value="QUEUE_ESTIMATE">Queuing</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4" aria-live="polite">
        <div className="space-y-1">
          <p className="text-[9px] text-text-sub uppercase font-bold">Peak Congestion</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tabular-nums">{(report?.peakCongestion * 100).toFixed(0)}%</span>
            <TrendingUp size={10} className="text-accent-red" aria-hidden="true" />
          </div>
          <div className="w-full h-1 bg-bg rounded-full overflow-hidden" role="progressbar" aria-valuenow={report?.peakCongestion * 100} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent-red transition-all duration-1000" style={{ width: `${report?.peakCongestion * 100}%` }} />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[9px] text-text-sub uppercase font-bold">Avg Wait Time</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tabular-nums">{report?.avgWaitTime}m</span>
            <PieChart size={10} className="text-brand" aria-hidden="true" />
          </div>
          <div className="w-full h-1 bg-bg rounded-full overflow-hidden" role="progressbar" aria-valuenow={65} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-brand transition-all duration-1000" style={{ width: '65%' }} />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
        <div className="text-[9px] text-text-sub font-medium">
          Total Throughput: <span className="text-text-main font-bold tabular-nums">{report?.totalThroughput.toLocaleString()}</span>
        </div>
        <div className="text-[9px] text-text-sub font-mono italic">
          Tier: Enterprise Analytics
        </div>
      </div>
    </div>
  );
});

AnalyticsDashboard.displayName = 'AnalyticsDashboard';
