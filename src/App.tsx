import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Users, 
  MessageSquare, 
  Clock, 
  Navigation, 
  ShieldCheck, 
  Accessibility,
  ChevronRight,
  LogOut,
  LogIn
} from 'lucide-react';
import { auth, signIn, signOut, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, getDocs } from 'firebase/firestore';
import { getVenueGuidance } from './services/geminiService';

// --- Components ---

const Header = ({ user }: { user: User | null }) => (
  <header className="bg-surface border-bottom border-border px-10 py-4 flex justify-between items-center sticky top-0 z-50">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-brand rounded-md flex items-center justify-center text-white font-bold text-lg">F</div>
      <h1 className="text-lg font-semibold tracking-tight">
        FANFLOW AI <span className="font-normal text-text-sub ml-2">System Design v1.0</span>
      </h1>
    </div>
    <div className="flex items-center gap-4">
      {user ? (
        <div className="flex items-center gap-3">
          <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
          <button onClick={signOut} className="p-2 hover:bg-bg rounded-full transition-colors">
            <LogOut size={18} className="text-text-sub" />
          </button>
        </div>
      ) : (
        <button onClick={signIn} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-dark transition-all">
          <LogIn size={18} />
          Sign In
        </button>
      )}
    </div>
  </header>
);

const CrowdRouting = () => {
  const [route, setRoute] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mobilityFirst, setMobilityFirst] = useState(false);

  const getBestRoute = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobilityFirst, userLocation: { lat: 34.0520, lng: -118.2430 } })
      });
      const data = await res.json();
      setRoute(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="col-title">
        <Navigation size={14} />
        Dynamic Routing Engine
      </div>
      
      <div className="flex-1 bg-bg rounded-xl border border-border relative overflow-hidden flex flex-col items-center justify-center p-8">
        {route ? (
          <div className="w-full space-y-6">
            <div className="card">
              <div className="text-[12px] color-brand font-semibold mb-1">RECOMMENDED PATH</div>
              <h3 className="text-xl font-bold mb-2">{route.recommendedGate.name}</h3>
              <div className="flex items-center gap-4 text-sm text-text-sub">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  {Math.round(route.recommendedGate.congestion * 15)}m wait
                </div>
                <div className="flex items-center gap-1">
                  <Accessibility size={14} />
                  {route.recommendedGate.isAccessible ? 'Accessible' : 'Standard'}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-text-sub font-bold">Alternative Gates</p>
              {route.alternatives.map((alt: any) => (
                <div key={alt.id} className="flex justify-between items-center text-sm p-3 bg-surface rounded-lg border border-border">
                  <span className="font-medium">{alt.name}</span>
                  <span className="text-text-sub">+{Math.round(alt.score * 100)}m</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto border border-border shadow-sm">
              <MapPin size={24} className="text-brand" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold">Ready to Route</h3>
              <p className="text-sm text-text-sub max-w-[200px]">Calculate the most efficient path based on real-time congestion.</p>
            </div>
            <button 
              onClick={getBestRoute}
              disabled={loading}
              className="bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-all disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Analyzing...' : 'Initialize Routing'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mobilityFirst ? 'bg-brand/10 text-brand' : 'bg-bg text-text-sub'}`}>
            <Accessibility size={20} />
          </div>
          <div>
            <p className="text-sm font-bold">Mobility-First</p>
            <p className="text-[11px] text-text-sub">Avoid stairs & escalators</p>
          </div>
        </div>
        <button 
          onClick={() => setMobilityFirst(!mobilityFirst)}
          className={`w-12 h-6 rounded-full relative transition-all ${mobilityFirst ? 'bg-brand' : 'bg-border'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${mobilityFirst ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );
};

const VirtualQueue = ({ user }: { user: User | null }) => {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'queues'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTokens(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const joinQueue = async (type: string) => {
    if (!user) return signIn();
    setLoading(true);
    try {
      const res = await fetch(`/api/queue/estimate?serviceType=${type}&queueLength=${Math.floor(Math.random() * 20)}`);
      const { estimatedWaitTime } = await res.json();
      
      await addDoc(collection(db, 'queues'), {
        userId: user.uid,
        venueId: 'stadium_01',
        serviceType: type,
        status: 'waiting',
        joinedAt: new Date().toISOString(),
        estimatedWaitTime
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="col-title">
        <Users size={14} />
        Virtual Queue Tokens
      </div>

      <div className="space-y-3">
        {['concession', 'restroom'].map(type => (
          <button 
            key={type}
            onClick={() => joinQueue(type)}
            disabled={loading}
            className="w-full flex items-center justify-between p-4 bg-surface rounded-xl border border-border hover:border-brand hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center text-text-sub group-hover:text-brand transition-colors">
                <Users size={16} />
              </div>
              <span className="capitalize font-bold text-sm">{type}</span>
            </div>
            <ChevronRight size={16} className="text-border group-hover:text-brand transition-all" />
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        <AnimatePresence>
          {tokens.map(token => (
            <motion.div 
              key={token.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-4 bg-surface border border-border rounded-xl shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="tag uppercase font-bold text-brand">{token.serviceType}</div>
                <div className="text-[10px] text-text-sub font-mono">ID: {token.id.slice(-6)}</div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-text-sub uppercase font-bold">Estimated Wait</p>
                  <p className="text-xl font-bold text-brand">{Math.round(token.estimatedWaitTime)}<span className="text-xs ml-1">min</span></p>
                </div>
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const AIConcierge = ({ user }: { user: User | null }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Real-time Data Fetchers for Gemini Function Calling ---

  const tools_execution_map = {
    getQueueStatus: async (args: { userId: string }) => {
      if (!user) return "User not authenticated.";
      const q = query(collection(db, 'queues'), where('userId', '==', user.uid), where('status', '==', 'waiting'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    getVenueCongestion: async (args: { venueId: string }) => {
      // In a real app, this would fetch from a 'venues' collection
      return {
        venueId: args.venueId,
        congestionLevel: 0.45,
        status: "Open",
        activeGates: ["Gate A", "Gate B"]
      };
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const guidance = await getVenueGuidance(input, { venue: 'Stadium 01', user: user?.displayName }, tools_execution_map);
    const aiMsg = { role: 'model', content: guidance, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="col-title">
        <MessageSquare size={14} />
        AI Venue Concierge
      </div>

      <div className="flex-1 bg-bg rounded-xl border border-border p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="text-center space-y-4 mt-10">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto border border-border">
              <MessageSquare size={20} className="text-brand" />
            </div>
            <p className="text-text-sub text-sm max-w-[180px] mx-auto">Ask about facilities, routes, or real-time venue updates.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
              msg.role === 'user' ? 'bg-brand text-white' : 'bg-surface border border-border'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border p-3 rounded-xl flex gap-1">
              <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-brand/40 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask a question..."
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand transition-all"
        />
        <button 
          onClick={sendMessage}
          className="bg-brand text-white p-3 rounded-lg hover:bg-brand-dark transition-all shadow-sm"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Header user={user} />
      
      <main className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr_300px] gap-px bg-border overflow-hidden">
        <section className="bg-surface p-6 overflow-y-auto">
          <VirtualQueue user={user} />
        </section>
        
        <section className="bg-surface p-6 overflow-y-auto">
          <CrowdRouting />
        </section>
        
        <section className="bg-surface p-6 overflow-y-auto">
          <AIConcierge user={user} />
        </section>
      </main>

      <footer className="bg-surface border-top border-border px-10 py-3 flex gap-6 text-[12px] text-text-sub">
        <div className="flex items-center gap-2">
          Status: <span className="text-brand font-bold">Stage 1 Active</span>
        </div>
        <div className="flex items-center gap-2">
          Target Latency: <span className="text-brand font-bold">&lt;200ms</span>
        </div>
        <div className="flex items-center gap-2">
          Availability: <span className="text-brand font-bold">99.9% (SLO)</span>
        </div>
        <div className="ml-auto">
          Author: <span className="text-brand font-bold">Senior Architect</span>
        </div>
      </footer>
    </div>
  );
}
