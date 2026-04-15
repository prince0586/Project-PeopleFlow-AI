import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, ChevronRight, Send, Bot, User as UserIcon } from 'lucide-react';
import { User } from 'firebase/auth';
import { ChatMessage } from '../types';

interface AIConciergeProps {
  user: User | null;
}

export const AIConcierge = React.memo(({ user }: AIConciergeProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input, 
          context: { venue: 'Global Arena', user: user?.displayName || 'Guest' },
          userId: user?.uid 
        })
      });
      const data = await res.json();
      const aiMsg: ChatMessage = { role: 'model', content: data.text || data.error, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Chat Error:', err);
      setMessages(prev => [...prev, { role: 'model', content: "I'm having trouble connecting to the venue systems. Please try again shortly.", timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, user]);

  return (
    <div className="flex flex-col gap-6 h-full" role="region" aria-labelledby="chat-title">
      <div id="chat-title" className="col-title flex items-center gap-2 font-bold text-sm text-text-sub uppercase tracking-wider">
        <MessageSquare size={14} aria-hidden="true" />
        AI Venue Concierge
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 bg-bg rounded-xl border border-border p-4 overflow-y-auto space-y-4 custom-scrollbar"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="text-center space-y-4 mt-10 animate-in fade-in zoom-in duration-700">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto border border-border shadow-sm">
              <Bot size={24} className="text-brand" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm">How can I help you today?</p>
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
          placeholder="Ask the concierge..."
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all shadow-sm"
          aria-label="Chat input"
        />
        <button 
          onClick={sendMessage}
          disabled={!input.trim() || loading}
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
