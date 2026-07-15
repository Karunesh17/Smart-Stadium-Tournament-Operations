'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Utensils, TrendingUp, LogOut } from 'lucide-react';
import ChatWidget from '../../../../libs/shared-ui/ChatWidget';

interface Item {
  id: number;
  name: string;
  base_price: number;
  original_price?: number;
  stock: number;
  vendor_id: number;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) throw new Error('Failed to load concessions menu catalog.');
      const data = await res.json();
      setItems(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred loading the concessions menu.');
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

  const getStockStatus = (stock: number) => {
    if (stock >= 10) {
      return { 
        label: "IN STOCK", 
        color: "text-status-ok bg-status-ok/10 border-status-ok/30", 
        dot: "bg-status-ok" 
      };
    }
    if (stock > 0) {
      return { 
        label: "LOW STOCK", 
        color: "text-status-warning bg-status-warning/10 border-status-warning/30", 
        dot: "bg-status-warning" 
      };
    }
    return { 
      label: "OUT OF STOCK", 
      color: "text-status-critical bg-status-critical/10 border-status-critical/30", 
      dot: "bg-status-critical" 
    };
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
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 border border-border-subtle bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-text-primary rounded-sm text-xs font-semibold transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="max-w-md w-full bg-bg-surface border border-border-subtle rounded-md p-6 shadow-lg text-center">
        <div className="w-12 h-12 bg-accent-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Utensils className="w-6 h-6 text-accent-primary" />
        </div>
        <h1 className="text-2xl font-semibold mb-4 text-text-primary">Fan Application</h1>
        <p className="text-text-secondary mb-6 text-sm">
          Welcome to the Smart Stadium Fan Portal. Access concessions menus, checkout wait times, and interact with the AI Copilot.
        </p>
        <div className="border border-border-subtle bg-bg-elevated rounded p-4 mb-4 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse-subtle mr-2"></span>
          <span className="text-xs font-mono text-status-ok">STADIUM ONLINE</span>
        </div>
        <button 
          onClick={() => setIsMenuOpen(true)}
          className="w-full py-2 bg-accent-primary text-white rounded-sm text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all"
        >
          Open Concessions Menu
        </button>
      </div>

      {/* MODAL: Concessions Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-bg-surface border border-border-subtle rounded-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-in">
            {/* Modal Header */}
            <header className="px-6 py-4 bg-bg-elevated border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent-primary">
                <ShoppingBag className="w-5 h-5" />
                <h2 className="text-lg font-bold text-text-primary">Stadium Concessions Menu</h2>
              </div>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="h-20 bg-bg-elevated/50 animate-pulse rounded-md border border-border-subtle/50" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center p-6 border border-status-critical/30 bg-status-critical/10 rounded-sm text-status-critical text-sm">
                  {error}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-border-subtle bg-bg-elevated/20 rounded-md">
                  <p className="text-sm text-text-secondary">No concessions items available at the moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {items.map(item => {
                    const status = getStockStatus(item.stock);
                    const isSurged = item.original_price && item.base_price > item.original_price;
                    const surgeMultiplier = isSurged ? (item.base_price / (item.original_price || 1)).toFixed(2) : '1.00';

                    return (
                      <div 
                        key={item.id} 
                        className={`bg-bg-elevated border rounded-md p-4 flex flex-col justify-between transition-all ${
                          item.stock === 0 ? 'opacity-60 border-border-subtle/50' : 'border-border-subtle hover:border-accent-primary/40'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-text-primary text-sm line-clamp-1">{item.name}</h3>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 border rounded-sm flex items-center gap-1 shrink-0 ${status.color}`}>
                              <span className={`w-1 h-1 rounded-full ${status.dot}`}></span>
                              <span>{status.label}</span>
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold font-mono text-text-primary">
                              ${item.base_price.toFixed(2)}
                            </span>
                            {isSurged && (
                              <div className="flex items-center gap-0.5 text-[10px] text-status-critical font-bold">
                                <TrendingUp className="w-3 h-3" />
                                <span>{surgeMultiplier}x Surge</span>
                              </div>
                            )}
                          </div>

                          <div className="text-[10px] font-mono text-text-secondary flex justify-between">
                            <span>Base: ${item.original_price ? item.original_price.toFixed(2) : item.base_price.toFixed(2)}</span>
                            <span>Stock: {item.stock} left</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <footer className="px-6 py-4 bg-bg-elevated border-t border-border-subtle flex justify-end">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-2 bg-bg-surface hover:bg-bg-elevated border border-border-subtle text-text-primary rounded-sm text-xs font-semibold transition-colors"
              >
                Close Menu
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Floating AI Copilot Chat Widget */}
      <ChatWidget role="fan" />
    </main>
  );
}