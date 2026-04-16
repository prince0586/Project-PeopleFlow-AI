import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, ChevronRight, Clock } from 'lucide-react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, signIn } from '../firebase';
import { QueueToken } from '../types';

interface VirtualQueueProps {
  user: User | null;
}

/**
 * VirtualQueue Component
 * 
 * Manages the user's virtual queue tokens and allows joining new queues.
 * Integrates with Firestore for real-time updates and the backend API for wait time estimation.
 * 
 * @component
 */
export const VirtualQueue = React.memo(({ user }: VirtualQueueProps) => {
  const [tokens, setTokens] = useState<QueueToken[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Effect hook to subscribe to the user's queue tokens in Firestore.
   */
  useEffect(() => {
    if (!user) {
      setTokens([]);
      return;
    }
    const q = query(collection(db, 'queues'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTokens(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueueToken)));
    }, (error) => {
      console.error('[VirtualQueue] Firestore Subscription Error:', error);
    });
    return () => unsubscribe();
  }, [user]);

  /**
   * Joins a specific service queue.
   * 
   * @param type - The type of service (e.g., 'concession', 'restroom').
   */
  const joinQueue = useCallback(async (type: string) => {
    if (!user) {
      signIn();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/queue/estimate?serviceType=${type}&queueLength=${Math.floor(Math.random() * 20)}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      
      const { estimatedWaitTime } = await res.json();
      
      await addDoc(collection(db, 'queues'), {
        userId: user.uid,
        venueId: 'stadium_01',
        serviceType: type,
        status: 'waiting',
        joinedAt: serverTimestamp(),
        estimatedWaitTime
      });
    } catch (err) {
      console.error('[VirtualQueue] Join Error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return (
    <div className="flex flex-col gap-6 h-full" role="region" aria-labelledby="queue-title">
      <div id="queue-title" className="col-title flex items-center gap-2 font-bold text-sm text-text-sub uppercase tracking-wider">
        <Users size={14} aria-hidden="true" />
        Virtual Queue Tokens
      </div>

      <div className="space-y-3">
        {['concession', 'restroom', 'entry'].map(type => (
          <button 
            key={type}
            onClick={() => joinQueue(type)}
            disabled={loading}
            className="w-full flex items-center justify-between p-4 bg-surface rounded-xl border border-border hover:border-brand hover:shadow-sm transition-all group focus:ring-2 focus:ring-brand focus:ring-offset-2"
            aria-label={`Join ${type} queue`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center text-text-sub group-hover:text-brand transition-colors">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Users size={16} aria-hidden="true" />
                )}
              </div>
              <span className="capitalize font-bold text-sm text-text-main">{type}</span>
            </div>
            <ChevronRight size={16} className="text-border group-hover:text-brand transition-all" aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {tokens.length === 0 && !loading && (
            <div className="text-center py-10 text-text-sub text-sm italic">
              No active tokens. Join a queue to begin.
            </div>
          )}
          {tokens.map(token => (
            <motion.div 
              key={token.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              layout
              className="p-4 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="px-2 py-0.5 bg-brand/10 text-brand text-[10px] uppercase font-bold rounded tracking-wider">
                  {token.serviceType}
                </div>
                <div className="text-[10px] text-text-sub font-mono bg-bg px-1.5 py-0.5 rounded">
                  ID: {token.id.slice(-6)}
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-text-sub uppercase font-bold mb-1 flex items-center gap-1">
                    <Clock size={10} /> Estimated Wait
                  </p>
                  <p className="text-2xl font-bold text-brand tabular-nums">
                    {Math.round(token.estimatedWaitTime)}
                    <span className="text-xs ml-1 font-normal text-text-sub">min</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" title="Live tracking active" />
                  <span className="text-[9px] text-accent-green font-bold uppercase tracking-tighter">Live</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

VirtualQueue.displayName = 'VirtualQueue';
