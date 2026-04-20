/**
 * Custom hook for high-fidelity venue telemetry ingestion.
 * 
 * Orchestrates API polling, retry logic, and architectural state management 
 * for the EventFlow AI analytics pipeline.
 * 
 * @module hooks/useAnalytics
 */
import { useState, useEffect } from 'react';
import { AnalyticsReport } from '../types';

export function useAnalytics(venueId: string, eventType: string) {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
          throw new Error('Non-JSON Ingestion Payload');
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Upstream Failure: ${res.status}`);
        }
        
        const data = await res.json();
        if (isMounted) {
          setReport(data);
          retryCount = 0;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        
        const message = err instanceof Error ? err.message : 'Ingestion Failure';
        if (isMounted) {
          setError(message);
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(() => fetchReport(signal), 1500 * retryCount);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    const controller = new AbortController();
    fetchReport(controller.signal);
    const interval = setInterval(() => fetchReport(controller.signal), 20000); 

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [venueId, eventType]);

  return { report, loading, error };
}
