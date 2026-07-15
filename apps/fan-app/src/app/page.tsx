'use client';

import React, { useState, useEffect } from 'react';
import { Utensils, TrendingUp, LogOut, ShoppingBag } from 'lucide-react';

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

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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
      if (!res.ok) throw new Error('API offline');
      const data = await res.json();
      if (data && data.length > 0) {
        setItems(data);
      } else {
        // Fallback to mock items if database is empty
        setItems(MOCK_ITEMS);
      }
      setError(null);
    } catch (err: any) {
      // Fallback to mock items if API is unreachable
      setItems(MOCK_ITEMS);
      setError(null);
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
          Welcome to the Smart Stadium Fan Portal. Access concessions menus and check wait times.
        </p>
        <div className="border border-border-subtle bg-bg-elevated rounded p-4 mb-6 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse-subtle mr-2"></span>
          <span className="text-xs font-mono text-status-ok">STADIUM ONLINE</span>
        </div>

        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="w-full py-2.5 bg-accent-primary text-white rounded-sm text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>{showMenu ? 'Hide Concessions Menu' : 'Open Concessions Menu'}</span>
        </button>

        {/* Basic Concessions List */}
        {showMenu && (
          <div className="mt-6 border-t border-border-subtle pt-6 text-left space-y-4 max-h-[350px] overflow-y-auto pr-1">
            <h2 className="text-sm font-bold text-text-primary mb-3">Today's Menu Items</h2>
            {isLoading ? (
              <p className="text-xs text-text-secondary">Loading concessions...</p>
            ) : (
              <div className="space-y-3">
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
                          Stock: {item.stock} units left
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="font-mono font-bold text-xs text-text-primary">
                          ${item.base_price.toFixed(2)}
                        </div>
                        {isSurged && (
                          <div className="flex items-center gap-0.5 text-[9px] text-status-critical font-bold justify-end">
                            <TrendingUp className="w-2.5 h-2.5" />
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
      </div>
    </main>
  );
}