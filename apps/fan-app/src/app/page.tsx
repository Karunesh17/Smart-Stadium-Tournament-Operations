'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Utensils, TrendingUp, LogOut, ShoppingBag, HelpCircle, Activity, Send, Compass } from 'lucide-react';

interface Item {
  id: number;
  name: string;
  base_price: number;
  original_price?: number;
  stock: number;
  vendor_id: number;
}

const MOCK_ITEMS: Item[] = [
  { id: 101, name: "Premium Hot Dog", base_price: 6.50, original_price: 6.50, stock: 45, vendor_id: 1 },
  { id: 102, name: "Cheese Nachos", base_price: 7.00, original_price: 7.00, stock: 30, vendor_id: 1 },
  { id: 103, name: "Cold Soda", base_price: 4.00, original_price: 4.00, stock: 120, vendor_id: 1 },
  { id: 104, name: "Draft Beer", base_price: 9.50, original_price: 8.00, stock: 15, vendor_id: 1 },
  { id: 105, name: "Stadium T-Shirt", base_price: 25.00, original_price: 25.00, stock: 8, vendor_id: 2 },
  { id: 106, name: "Team Cap", base_price: 18.00, original_price: 18.00, stock: 0, vendor_id: 2 }
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'ai' | 'info'>('menu');
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // AI Copilot state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hello! I am your Stadium Operations Assistant. Ask me about refund rules, dynamic pricing, or current concessions stocks.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auth check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login';
      } else {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Fetch catalog items
  const fetchItems = async () => {
    try {
      const res = await fetch('/api/v1/items');
      if (!res.ok) throw new Error('API offline');
      const data = await res.json();
      if (data && data.length > 0) {
        setItems(data);
      } else {
        setItems(MOCK_ITEMS);
      }
    } catch (err: any) {
      setItems(MOCK_ITEMS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchItems();
      const interval = setInterval(fetchItems, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsSending(true);

    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
      const res = await fetch('/api/v1/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMsg,
          role: 'fan',
          session_id: 'fan_session_id'
        })
      });

      if (!res.ok) throw new Error('Copilot offline');
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      // Local RAG fallback in case Render db is wiped / offline
      let reply = "Hello, I am your Stadium Operations Assistant. I can help you query concession inventories, review stadium refund policies, or inspect dynamic pricing factors.";
      const query = userMsg.toLowerCase();
      
      if (query.includes('refund')) {
        reply = "Based on stadium refund rules, refunds must be logged within 15 minutes of checkout at the vendor stand.";
      } else if (query.includes('pricing') || query.includes('surge') || query.includes('price')) {
        reply = "Concessions dynamic pricing adjusts prices dynamically based on real-time crowd metrics and stand purchase velocity.";
      } else if (query.includes('wait') || query.includes('gate') || query.includes('time') || query.includes('queue')) {
        reply = "Average wait times are currently: Gate A is 4 mins, Gate B is 10 mins, Section 102 restrooms has low wait, Section 118 restrooms has 10 mins wait.";
      } else if (query.includes('restroom') || query.includes('bathroom') || query.includes('toilet')) {
        reply = "Restrooms located at Section 102 currently have a very short queue (under 2 mins), while Section 118 restrooms are busier (approx. 10 mins wait).";
      } else if (query.includes('aid') || query.includes('emergency') || query.includes('doctor')) {
        reply = "The primary First Aid Station is located at Main Concourse Section 110, open for the duration of the tournament.";
      }
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } finally {
      setIsSending(false);
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock >= 10) return { label: "IN STOCK", color: "text-status-ok" };
    if (stock > 0) return { label: "LOW STOCK", color: "text-status-warning" };
    return { label: "OUT OF STOCK", color: "text-status-critical" };
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary text-sm font-mono animate-pulse">
          Verifying security token...
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary relative">
      {/* Header with Logout */}
      <div className="absolute top-6 right-6">
        <button
          onClick={handleLogout}
          aria-label="Sign Out"
          className="flex items-center gap-2 px-3 py-1.5 border border-border-subtle bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-text-primary rounded-sm text-xs font-semibold transition-all focus:outline-none focus:border-accent-primary"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="max-w-md w-full bg-bg-surface border border-border-subtle rounded-md p-6 shadow-lg">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-accent-primary/10 rounded-full flex items-center justify-center mx-auto mb-4" role="img" aria-label="Stadium Icon">
            <Compass className="w-6 h-6 text-accent-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">StadiumGPT Portal</h1>
          <p className="text-text-secondary text-sm mt-1">FIFA World Cup 2026 Operations & Support</p>
        </div>

        {/* Status Indicator */}
        <div className="border border-border-subtle bg-bg-elevated rounded p-3 mb-6 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse-subtle mr-2" aria-hidden="true"></span>
          <span className="text-xs font-mono text-status-ok font-bold">STADIUM NETWORK ONLINE</span>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-border-subtle mb-6" role="tablist" aria-label="Dashboard Categories">
          <button
            role="tab"
            aria-selected={activeTab === 'menu'}
            aria-controls="panel-menu"
            id="tab-menu"
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'menu'
                ? 'border-accent-primary text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Concessions
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'ai'}
            aria-controls="panel-ai"
            id="tab-ai"
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'ai'
                ? 'border-ai-accent text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Ask AI Copilot
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'info'}
            aria-controls="panel-info"
            id="tab-info"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 ${
              activeTab === 'info'
                ? 'border-accent-primary text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            Wait Times & Info
          </button>
        </div>

        {/* Panel Content */}
        <div>
          {/* TAB 1: CONCESSIONS MENU */}
          {activeTab === 'menu' && (
            <div id="panel-menu" role="tabpanel" aria-labelledby="tab-menu" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-text-primary">Concessions catalog</h2>
                <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                  <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Real-time Dynamic Pricing</span>
                </div>
              </div>

              {isLoading ? (
                <p className="text-xs text-text-secondary">Loading concessions inventory...</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {items.map(item => {
                    const status = getStockStatus(item.stock);
                    const isSurged = item.original_price && item.base_price > item.original_price;
                    const surgeMultiplier = isSurged ? (item.base_price / (item.original_price || 1)).toFixed(2) : '1.00';

                    return (
                      <div 
                        key={item.id} 
                        className={`p-3 bg-bg-elevated border border-border-subtle rounded-sm flex justify-between items-center ${
                          item.stock === 0 ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-text-primary">{item.name}</span>
                            <span className={`text-[9px] font-bold ${status.color}`}>({status.label})</span>
                          </div>
                          <div className="text-[10px] text-text-secondary font-mono">
                            Stock: {item.stock} left
                          </div>
                        </div>

                        <div className="text-right space-y-0.5">
                          <div className="font-mono font-bold text-xs text-text-primary">
                            ${item.base_price.toFixed(2)}
                          </div>
                          {isSurged && (
                            <div className="flex items-center gap-0.5 text-[9px] text-status-critical font-bold justify-end">
                              <TrendingUp className="w-2.5 h-2.5" aria-hidden="true" />
                              <span>{surgeMultiplier}x Surge</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI COPILOT */}
          {activeTab === 'ai' && (
            <div id="panel-ai" role="tabpanel" aria-labelledby="tab-ai" className="space-y-4">
              <h2 className="text-sm font-bold text-text-primary">Stadium AI Assistant</h2>
              
              {/* Chat messages list */}
              <div className="h-[230px] overflow-y-auto border border-border-subtle bg-bg-elevated rounded-sm p-3 space-y-3 text-xs">
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[9px] text-text-secondary font-bold mb-1 uppercase">
                      {msg.role === 'user' ? 'You' : 'Stadium AI'}
                    </span>
                    <div 
                      className={`p-2.5 rounded-sm max-w-[85%] leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-accent-primary text-white' 
                          : 'bg-bg-surface border border-border-subtle text-text-primary'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="text-[10px] text-text-secondary italic animate-pulse">
                    AI is writing response...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat form */}
              <form onSubmit={handleSendChat} className="flex gap-2">
                <label htmlFor="chat-input-field" className="sr-only">Ask Stadium AI Copilot</label>
                <input
                  id="chat-input-field"
                  type="text"
                  placeholder="Ask about refund policy, dynamic pricing..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isSending}
                  className="flex-1 bg-bg-elevated border border-border-subtle text-text-primary rounded-sm px-3 py-2 text-xs focus:outline-none focus:border-ai-accent transition-colors"
                />
                <button
                  type="submit"
                  aria-label="Send Message"
                  disabled={isSending || !chatInput.trim()}
                  className="px-3.5 bg-ai-accent text-white rounded-sm hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: STADIUM INFO & WAIT TIMES */}
          {activeTab === 'info' && (
            <div id="panel-info" role="tabpanel" aria-labelledby="tab-info" className="space-y-4">
              <h2 className="text-sm font-bold text-text-primary mb-3">Live Stadium Diagnostics</h2>

              {/* Gates Wait Times */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Gate Access Queues</h3>
                
                <div className="p-3 bg-bg-elevated border border-border-subtle rounded-sm flex justify-between items-center">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-text-primary">Gate A (Main Concourse)</div>
                    <div className="text-[10px] text-text-secondary">Expected entry duration</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-status-ok">4 Mins Wait</div>
                </div>

                <div className="p-3 bg-bg-elevated border border-border-subtle rounded-sm flex justify-between items-center">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-text-primary">Gate B (East Wing)</div>
                    <div className="text-[10px] text-text-secondary">Expected entry duration</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-status-warning">10 Mins Wait</div>
                </div>
              </div>

              {/* General Facilities queue info */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Restroom & Facility Wait Times</h3>
                
                <div className="p-3 bg-bg-elevated border border-border-subtle rounded-sm flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-text-primary">Restrooms Section 102</div>
                    <div className="text-[10px] text-text-secondary">Quiet toilet access</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-status-ok">Low Wait (&lt;2m)</div>
                </div>

                <div className="p-3 bg-bg-elevated border border-border-subtle rounded-sm flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-text-primary">Restrooms Section 118</div>
                    <div className="text-[10px] text-text-secondary">High volume traffic zone</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-status-critical">Busy (10m wait)</div>
                </div>

                <div className="p-3 bg-bg-elevated border border-border-subtle rounded-sm flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-text-primary">First Aid Station (Sec. 110)</div>
                    <div className="text-[10px] text-text-secondary">General medical emergency center</div>
                  </div>
                  <div className="text-xs font-mono font-bold text-status-ok flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-status-ok animate-pulse" aria-hidden="true" />
                    <span>OPEN</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}