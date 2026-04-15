import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { Header } from './components/Header';
import { VirtualQueue } from './components/VirtualQueue';
import { CrowdRouting } from './components/CrowdRouting';
import { AIConcierge } from './components/AIConcierge';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { LiveMap } from './components/LiveMap';

/**
 * FanFlow AI - Enterprise Venue Management System
 * 
 * The root application component that orchestrates the layout, authentication state,
 * and global theme settings. It features a responsive grid layout optimized for
 * real-time venue operations.
 * 
 * @component
 */
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<any>(null);

  /**
   * Effect hook to synchronize authentication state with Firebase.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        console.log(`[App] User authenticated: ${u.email}`);
      }
    });
    return () => unsubscribe();
  }, []);

  /**
   * Toggles the high-contrast theme for accessibility.
   */
  const toggleHighContrast = useCallback(() => {
    setIsHighContrast(prev => !prev);
  }, []);

  /**
   * Memoized theme classes to prevent unnecessary re-renders.
   */
  const themeClasses = useMemo(() => 
    `min-h-screen flex flex-col transition-colors duration-300 ${isHighContrast ? 'bg-black text-white' : 'bg-bg text-text-main'}`
  , [isHighContrast]);

  return (
    <div className={themeClasses}>
      <Header user={user} />
      
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-px bg-border overflow-hidden" role="main">
        {/* Left Sidebar: Queues & Analytics */}
        <section className="bg-surface p-6 overflow-y-auto flex flex-col gap-6 border-r border-border" aria-label="Queues and Analytics Sidebar">
          <VirtualQueue user={user} />
          <AnalyticsDashboard />
        </section>
        
        {/* Center: Live Map & Routing */}
        <section className="bg-surface p-6 overflow-y-auto flex flex-col gap-6" aria-label="Live Navigation and Routing">
          <div className="flex-1 min-h-[400px]">
            <LiveMap activeRoute={activeRoute} />
          </div>
          <div className="h-[300px]">
            <CrowdRouting onRouteCalculated={setActiveRoute} />
          </div>
        </section>
        
        {/* Right Sidebar: AI Concierge */}
        <section className="bg-surface p-6 overflow-y-auto border-l border-border" aria-label="AI Support Sidebar">
          <AIConcierge user={user} />
        </section>
      </main>

      <footer className="bg-surface border-t border-border px-10 py-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-[11px] text-text-sub" role="contentinfo">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand animate-pulse" aria-hidden="true" />
          System Status: <span className="text-text-main font-bold">Operational</span>
        </div>
        <div className="flex items-center gap-2">
          Latency: <span className="text-text-main font-bold">&lt;150ms</span>
        </div>
        <div className="flex items-center gap-2">
          Analytics Tier: <span className="text-brand font-bold">Google Cloud Enterprise</span>
        </div>
        
        <div className="ml-auto flex items-center gap-4">
          <button 
            onClick={toggleHighContrast}
            className="px-2 py-1 border border-border rounded hover:bg-bg transition-colors font-bold uppercase tracking-tighter focus:ring-2 focus:ring-brand"
            aria-pressed={isHighContrast}
            aria-label="Toggle High Contrast Mode"
          >
            {isHighContrast ? 'Standard Mode' : 'High Contrast'}
          </button>
          <div className="text-text-sub italic">
            FanFlow AI v2.0.0 • 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
