import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, ChevronRight, Send, Bot, User as UserIcon, AlertCircle } from 'lucide-react';
import { User } from 'firebase/auth';
import { ChatMessage } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, limit, serverTimestamp } from 'firebase/firestore';

interface AIConciergeProps {
  user: User | null;
}

/**
 * AIConcierge Component
 * 
 * Provides a chat interface for the FanFlow AI Venue Concierge.
 * Features persistent chat history stored in Firestore and real-time synchronization.
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
   * Effect hook to subscribe to persistent chat history from Firestore.
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
      console.error('[AIConcierge] Firestore History Error:', err);
      setError('Failed to load chat history');
    });

    return () => unsubscribe();
  }, [user]);

  /**
   * Effect hook to auto-scroll the chat window to the latest message.
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  /**
   * Sends a user message to the AI backend and stores it in Firestore.
   */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || !user) return;
    
    const chatId = user.uid;
    const userMsgContent = input;
    setInput('');
    setLoading(true);

    try {
      // 1. Save user message to Firestore
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        userId: user.uid,
        role: 'user',
        content: userMsgContent,
        timestamp: serverTimestamp()
      });

      // 2. Fetch AI response
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsgContent, 
          context: { 
            venue: 'Global Arena', 
            user: user.displayName || 'Guest',
            activeTokens: messages.length
          },
          userId: user.uid,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      
      const data = await res.json();

      // 3. Save AI response to Firestore
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        userId: user.uid,
        role: 'model',
        content: data.text,
        timestamp: serverTimestamp()
      });

    } catch (err: any) {
      console.error('[AIConcierge] Chat Error:', err);
      setError(`Chat failed: ${err.message}`);
      
      // Optionally add a local error message
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: `I'm having trouble connecting to the venue systems. Please try again shortly.`, 
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
        {!user && (
          <div className="text-center py-10 space-y-4">
            <Bot size={32} className="mx-auto text-text-sub opacity-20" />
            <p className="text-xs text-text-sub">Please sign in to chat with the concierge.</p>
          </div>
        )}
        {user && messages.length === 0 && !loading && (
          <div className="text-center space-y-4 mt-10 animate-in fade-in zoom-in duration-700">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto border border-border shadow-sm">
              <Bot size={24} className="text-brand" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-text-main">How can I help you, {user.displayName?.split(' ')[0]}?</p>
              <p className="text-text-sub text-[11px] max-w-[180px] mx-auto">Ask about facilities, routing, or your current queue status.</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex gap-2 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-brand text-white' : 'bg-surface border border-border text-brand'}`}>
                {msg.role === 'user' ? <UserIcon size={12} /> : <Bot size={12} />}
              </div>
              <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                msg.role === 'user' ? 'bg-brand text-white rounded-tr-none' : 'bg-surface border border-border rounded-tl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0">
                <Bot size={12} className="text-brand" />
              </div>
              <div className="bg-surface border border-border p-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 relative">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder={user ? "Ask the concierge..." : "Sign in to chat"}
          disabled={!user || loading}
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all shadow-sm disabled:opacity-50"
          aria-label="Chat input"
        />
        <button 
          onClick={sendMessage}
          disabled={!input.trim() || loading || !user}
          className="bg-brand text-white p-3.5 rounded-xl hover:bg-brand-dark transition-all shadow-sm disabled:opacity-50 disabled:hover:bg-brand focus:ring-2 focus:ring-brand focus:ring-offset-2"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
});

AIConcierge.displayName = 'AIConcierge';
