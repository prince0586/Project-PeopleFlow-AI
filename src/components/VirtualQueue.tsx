import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { Users, AlertCircle } from 'lucide-react';
import { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, signIn } from '../firebase';
import { QueueToken } from '../types';
import { QueueButton } from './VirtualQueue/QueueButton';
import { TokenCard } from './VirtualQueue/TokenCard';
import { handleFirestoreError } from '../lib/firestoreErrorHandler';

interface VirtualQueueProps {
  user: User | null;
}

/**
 * VirtualQueue Architecture
 * 
 * Manages the user's virtual queue lifecycle. Leverages real-time Firestore 
 * synchronization with architectural error telemetry (FirestoreErrorInfo).
 * 
 * @component
 */
export const VirtualQueue = React.memo(({ user }: VirtualQueueProps) => {
  const [tokens, setTokens] = useState<QueueToken[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Technical Subscription: Real-time Queue State Sync
   */
  useEffect(() => {
    if (!user) {
      setTokens([]);
      return;
    }

    const q = query(collection(db, 'queues'), where('userId', '==', user.uid));
    
    // Establishing authoritative telemetry stream
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTokens(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueueToken)));
      setErrorMessage(null);
    }, (error) => {
      try {
        handleFirestoreError(error, 'list', 'queues');
      } catch (mappedError: unknown) {
        setErrorMessage('Access Control Restriction');
        const message = mappedError instanceof Error ? mappedError.message : 'Unknown';
        console.error('[VirtualQueue] Authorization Failure:', message);
      }
    });

    return () => unsubscribe();
  }, [user]);

  /**
   * Action: Virtual Ingress Request
   */
  const joinQueue = useCallback(async (type: string) => {
    if (!user) {
      signIn();
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/queue/estimate?serviceType=${type}&queueLength=${Math.floor(Math.random() * 20)}`);
      if (!res.ok) throw new Error(`Operational latency or API mismatch: ${res.status}`);
      
      const { estimatedWaitTime } = await res.json();
      
      // Atomic Firestore Ingestion
      await addDoc(collection(db, 'queues'), {
        userId: user.uid,
        venueId: 'stadium_01',
        serviceType: type,
        status: 'waiting',
        joinedAt: serverTimestamp(),
        estimatedWaitTime
      });
    } catch (err: unknown) {
      try {
        handleFirestoreError(err, 'create', 'queues');
      } catch (mappedError: unknown) {
        setErrorMessage('Permission Denied');
        const message = mappedError instanceof Error ? mappedError.message : 'Unknown';
        console.error('[VirtualQueue] Create Invariant Failure:', message);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  return (
    <div className="flex flex-col gap-6 h-full" role="region" aria-labelledby="queue-title">
      <div className="flex items-center justify-between col-title">
        <div id="queue-title" className="flex items-center gap-2">
          <Users size={14} aria-hidden="true" />
          Virtual Queue Tokens
        </div>
        {errorMessage && (
          <div className="flex items-center gap-1 text-[9px] text-accent-red font-bold animate-pulse">
            <AlertCircle size={10} /> SECURITY ALERT
          </div>
        )}
      </div>

      <div className="space-y-3">
        {['concession', 'restroom', 'entry'].map(type => (
          <QueueButton 
            key={type}
            type={type}
            onClick={() => joinQueue(type)}
            loading={loading}
          />
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar" aria-live="polite">
        <AnimatePresence mode="popLayout">
          {tokens.length === 0 && !loading && !errorMessage && (
            <div className="text-center py-10 text-text-sub text-sm italic opacity-60">
              No active tokens detected in the current session.
            </div>
          )}
          {tokens.map(token => (
            <TokenCard key={token.id} token={token} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

 VirtualQueue.displayName = 'VirtualQueue';
