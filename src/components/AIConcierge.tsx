import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { User } from 'firebase/auth';
import { ChatMessage, ChatHistoryItem } from '../types';
import { db } from '../firebase';
import { FrontendAIService } from '../lib/ai';
import { collection, query, orderBy, onSnapshot, addDoc, limit, serverTimestamp } from 'firebase/firestore';
import { MessageList } from './AIConcierge/MessageList';
import { ChatInput } from './AIConcierge/ChatInput';
import { handleFirestoreError } from '../lib/firestoreErrorHandler';

interface AIConciergeProps {
  user: User | null;
}

/**
 * AIConcierge Architecture
 * 
 * Orchestrates the EventFlow AI Venue Concierge experience.
 * Manages high-fidelity state, Firestore sync with JSON-error telemetry, 
 * and multi-turn conversational grounding.
 * 
 * @component
 */
export const AIConcierge = React.memo(({ user }: AIConciergeProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Technical Subscription: Persistent Chat History
   */
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    const chatId = user.uid;
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
        } as ChatMessage;
      });
      setMessages(msgs);
      setError(null);
    }, (err) => {
      try {
        handleFirestoreError(err, 'list', `chats/${chatId}/messages`);
      } catch (mappedError: unknown) {
        setError('Security restriction on chat history');
        const message = mappedError instanceof Error ? mappedError.message : 'Unknown';
        console.error('[AIConcierge] Authorization Failure:', message);
      }
    });

    return () => unsubscribe();
  }, [user]);

  /**
   * Technical Action: Generative Processing Loop
   */
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading || !user) return;
    
    const chatId = user.uid;
    const userMsgContent = input;
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // Step 1: User Message Persistance
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        userId: user.uid,
        role: 'user',
        content: userMsgContent,
        timestamp: serverTimestamp()
      });

      // Step 2: Generative Inference Grounded in Telemetry
      const aiResponse = await FrontendAIService.processChat(
        userMsgContent,
        { 
          venue: 'Global Arena - Section 104', 
          user: user.displayName || 'Enterprise User',
          activeTokens: messages.length,
          timestamp: new Date().toISOString()
        },
        messages.slice(-10).map(m => ({ role: m.role, content: m.content }) as ChatHistoryItem)
      );

      // Step 3: Model Response Persistance
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        userId: user.uid,
        role: 'model',
        content: aiResponse,
        timestamp: serverTimestamp()
      });

    } catch (err: unknown) {
      try {
        handleFirestoreError(err, 'create', `chats/${chatId}/messages`);
      } catch (mappedError: unknown) {
        const message = mappedError instanceof Error ? mappedError.message : 'Unknown Failure';
        setError(`Telemetry Error: ${message.substring(0, 30)}...`);
        console.error('[AIConcierge] Pipeline Failure:', message);
      }
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: `Operational failure: Connection to venue AI gateway interrupted. Position integrity maintained.`, 
        timestamp: new Date().toISOString() 
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, user, messages]);

  return (
    <div className="flex flex-col gap-6 h-full" role="region" aria-labelledby="chat-title">
      <div id="chat-title" className="col-title flex items-center justify-between font-bold text-sm text-text-sub uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} aria-hidden="true" />
          AI Venue Concierge
        </div>
        {error && (
          <div className="flex items-center gap-1 text-[10px] text-accent-red normal-case font-bold">
            <AlertCircle size={12} /> {error}
          </div>
        )}
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 bg-bg rounded-xl border border-border p-4 overflow-y-auto space-y-4 custom-scrollbar"
        aria-live="polite"
        aria-atomic="false"
        aria-busy={loading}
        role="log"
      >
        <MessageList messages={messages} isLoading={loading} user={user} />
      </div>

      <ChatInput 
        input={input} 
        setInput={setInput} 
        onSend={handleSend} 
        isLoading={loading} 
        isUserSignedIn={!!user} 
      />
    </div>
  );
});

AIConcierge.displayName = 'AIConcierge';
