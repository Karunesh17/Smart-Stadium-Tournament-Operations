'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, AlertTriangle, Plus, Bell, RefreshCw, Sparkles, LogOut } from 'lucide-react';

interface Item {
  id: number;
  vendor_id: number;
  name: string;
  base_price: number;
  stock: number;
  updated_at: string;
}

interface Sale {
  id: number;
  item_id: number;
  quantity: number;
  price_at_sale: number;
  timestamp: string;
}

export default function VendorDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [vendorName, setVendorName] = useState("Priya's Concessions");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'items' | 'sales'>('items');

  // Checkout modal state
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // New Item modal state
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(10.00);
  const [newItemStock, setNewItemStock] = useState(50);
  const [isAddLoading, setIsAddLoading] = useState(false);

  const fetchInventory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/items');
      if (!res.ok) throw new Error('Failed to load catalog inventory items.');
      const data = await res.json();
      setItems(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('An error occurred loading catalog data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleSellClick = (item: Item) => {
    setSelectedItem(item);
    setQuantity(1);
    setError(null);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsCheckoutLoading(true);
    setError(null);

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';

    try {
      const res = await fetch('/api/v1/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          item_id: selectedItem.id,
          quantity: quantity
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Checkout transaction failed.');
      }

      const saleRecord: Sale = await res.json();
      
      // Update inventory lists in place
      setItems(prevItems => 
        prevItems.map(it => 
          it.id === selectedItem.id ? { ...it, stock: it.stock - quantity } : it
        )
      );
      setRecentSales(prevSales => [saleRecord, ...prevSales]);
      setSelectedItem(null);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('An unexpected error occurred during sale checkouts.');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || newItemPrice <= 0 || newItemStock < 0) {
      setError('Please provide valid item attributes.');
      return;
    }
    setIsAddLoading(true);
    setError(null);

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';

    try {
      // In MVP, we assume vendor_id = 1 for the default vendor profile
      const res = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          vendor_id: 1,
          name: newItemName,
          base_price: Number(newItemPrice),
          stock: Number(newItemStock)
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to add item to catalog.');
      }

      const createdItem: Item = await res.json();
      setItems(prev => [...prev, createdItem]);
      setIsAddItemOpen(false);
      setNewItemName('');
      setNewItemPrice(10.00);
      setNewItemStock(50);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to register catalog item.');
    } finally {
      setIsAddLoading(false);
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock >= 10) return { label: "OK", color: "text-status-ok bg-status-ok/10 border-status-ok/30", dot: "bg-status-ok" };
    if (stock > 0) return { label: "WARN", color: "text-status-warning bg-status-warning/10 border-status-warning/30", dot: "bg-status-warning" };
    return { label: "CRIT", color: "text-status-critical bg-status-critical/10 border-status-critical/30", dot: "bg-status-critical" };
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary text-text-primary">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-bg-surface border-b border-border-subtle sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-accent-primary" />
          <span className="font-bold text-lg tracking-wider text-text-primary">SMART STADIUM POS</span>
          <span className="text-xs font-mono px-2 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-secondary">
            Vendor Portal
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{vendorName}</span>
          </div>
          <button className="relative text-text-secondary hover:text-text-primary transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-status-critical rounded-full flex items-center justify-center text-[10px] font-bold text-white">
              3
            </span>
          </button>
          <button 
            onClick={handleLogout}
            className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
          <div className="flex items-center gap-1 text-ai-accent text-xs font-semibold px-2 py-1 bg-ai-accent/15 border border-ai-accent/30 rounded">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copilot Ready</span>
          </div>
        </div>
      </header>

      {/* Main Grid Wrapper */}
      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside className="w-60 bg-bg-surface border-r border-border-subtle p-6 flex flex-col justify-between hidden md:flex">
          <div className="space-y-8">
            <div>
              <p className="text-xs font-semibold tracking-wider text-text-secondary uppercase mb-4">Operations</p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('items')}
                  className={`w-full text-left px-3 py-2 text-sm font-semibold rounded-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'items'
                      ? 'bg-accent-primary/10 text-accent-primary border-l-2 border-accent-primary'
                      : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  }`}
                >
                  Concessions Inventory
                </button>
                <button
                  onClick={() => setActiveTab('sales')}
                  className={`w-full text-left px-3 py-2 text-sm font-semibold rounded-sm transition-colors flex items-center gap-2 ${
                    activeTab === 'sales'
                      ? 'bg-accent-primary/10 text-accent-primary border-l-2 border-accent-primary'
                      : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  }`}
                >
                  Transaction Sales
                </button>
              </nav>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-4">
            <button
              onClick={fetchInventory}
              className="w-full flex items-center justify-center gap-2 py-2 border border-border-subtle hover:bg-bg-elevated rounded-sm text-xs font-semibold text-text-secondary hover:text-text-primary transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Catalog</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 border border-status-critical/30 bg-status-critical/10 text-status-critical rounded-sm p-4 flex items-center justify-between">
              <span className="text-sm font-semibold">{error}</span>
              <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
            </div>
          )}

          {activeTab === 'items' ? (
            <div>
              {/* Header section with add item trigger */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Concessions Inventory</h2>
                  <p className="text-xs text-text-secondary mt-1">Real-time stock indicators and quick POS sales tools</p>
                </div>
                <button
                  onClick={() => setIsAddItemOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary text-white text-xs font-bold rounded-sm hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Item</span>
                </button>
              </div>

              {isLoading ? (
                // Skeletons loader
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-bg-surface border border-border-subtle rounded-md p-5 animate-pulse h-40"></div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="border border-dashed border-border-subtle bg-bg-surface rounded-md p-12 text-center max-w-lg mx-auto mt-8">
                  <ShoppingBag className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                  <h3 className="text-md font-semibold text-text-primary">No Inventory Items Registered</h3>
                  <p className="text-sm text-text-secondary mt-2 mb-6">
                    Add concessions menu items or souvenirs to begin tracking sales in this POS terminal.
                  </p>
                  <button
                    onClick={() => setIsAddItemOpen(true)}
                    className="px-4 py-2 bg-accent-primary text-white text-xs font-bold rounded-sm hover:opacity-90 transition-opacity"
                  >
                    Register Your First Item
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map(item => {
                    const status = getStockStatus(item.stock);
                    return (
                      <div key={item.id} className="bg-bg-surface border border-border-subtle rounded-md p-5 flex flex-col justify-between hover:border-border-subtle/80 transition-colors">
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="font-semibold text-text-primary text-base">{item.name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-sm flex items-center gap-1.5 ${status.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                              <span>{status.label}</span>
                            </span>
                          </div>
                          <div className="flex justify-between items-baseline mb-4">
                            <span className="text-2xl font-bold text-text-primary">${item.base_price.toFixed(2)}</span>
                            <span className="text-xs font-mono text-text-secondary">{item.stock} in stock</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSellClick(item)}
                          className="w-full py-2 bg-bg-elevated border border-border-subtle hover:bg-accent-primary hover:text-white rounded-sm text-xs font-semibold tracking-wider text-text-primary transition-all uppercase"
                          disabled={item.stock === 0}
                        >
                          {item.stock === 0 ? "Out of Stock" : "Sell"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // Sales History Panel
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text-primary">Concessions Transactions</h2>
                <p className="text-xs text-text-secondary mt-1">Live feed of POS sales logged on this terminal</p>
              </div>

              {recentSales.length === 0 ? (
                <div className="border border-dashed border-border-subtle bg-bg-surface rounded-md p-12 text-center max-w-lg mx-auto mt-8">
                  <ShoppingBag className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                  <h3 className="text-md font-semibold text-text-primary">No Sales Logged Yet</h3>
                  <p className="text-sm text-text-secondary mt-2">
                    Transactions recorded via item checkout will appear here in chronological order.
                  </p>
                </div>
              ) : (
                <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-elevated border-b border-border-subtle">
                        <th className="p-4 text-xs font-bold text-text-secondary tracking-wider">Sale ID</th>
                        <th className="p-4 text-xs font-bold text-text-secondary tracking-wider">Item ID</th>
                        <th className="p-4 text-xs font-bold text-text-secondary tracking-wider">Quantity</th>
                        <th className="p-4 text-xs font-bold text-text-secondary tracking-wider">Price per Unit</th>
                        <th className="p-4 text-xs font-bold text-text-secondary tracking-wider">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono text-sm">
                      {recentSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-bg-elevated/40 transition-colors">
                          <td className="p-4 text-text-primary">#SALE-{sale.id}</td>
                          <td className="p-4 text-text-secondary">#ITEM-{sale.item_id}</td>
                          <td className="p-4 text-text-primary font-bold">{sale.quantity}</td>
                          <td className="p-4 text-status-ok font-bold">${sale.price_at_sale.toFixed(2)}</td>
                          <td className="p-4 text-text-secondary text-xs">{new Date(sale.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Sell Modal / Drawer sheet */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-bg-surface border border-border-subtle rounded-md max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-text-primary mb-2">POS Sale Checkout</h3>
            <p className="text-xs text-text-secondary mb-6">Record checkout transaction details for customer.</p>

            <form onSubmit={handleCheckoutSubmit} className="space-y-6">
              <div className="flex justify-between items-center bg-bg-elevated p-3 border border-border-subtle rounded">
                <span className="text-sm font-semibold text-text-primary">{selectedItem.name}</span>
                <span className="text-sm font-bold text-accent-primary">${selectedItem.base_price.toFixed(2)} / unit</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2">
                  Transaction Quantity
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max={selectedItem.stock}
                    className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded-sm py-2 px-3 text-sm focus:outline-none focus:border-accent-primary transition-colors font-mono"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(selectedItem.stock, Math.max(1, Number(e.target.value))))}
                  />
                  <span className="text-xs font-mono text-text-secondary shrink-0">
                    Max: {selectedItem.stock} available
                  </span>
                </div>
              </div>

              <div className="border-t border-border-subtle pt-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">TOTAL AMOUNT DUE</span>
                <span className="text-xl font-mono font-bold text-status-ok">
                  ${(selectedItem.base_price * quantity).toFixed(2)}
                </span>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-2 bg-bg-elevated hover:bg-bg-elevated/80 border border-border-subtle rounded-sm text-xs font-semibold text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-accent-primary hover:opacity-90 rounded-sm text-xs font-bold text-white transition-opacity flex items-center justify-center"
                  disabled={isCheckoutLoading}
                >
                  {isCheckoutLoading ? "Completing..." : "Complete Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddItemOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-bg-surface border border-border-subtle rounded-md max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-text-primary mb-2">Register Catalog Item</h3>
            <p className="text-xs text-text-secondary mb-6">Add a concessions food or merchandise item to menu catalog.</p>

            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2" htmlFor="itemName">
                  Item Description / Name
                </label>
                <input
                  id="itemName"
                  type="text"
                  required
                  placeholder="e.g. Classic Hot Dog, Team Cap"
                  className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded-sm py-2 px-3 text-sm focus:outline-none focus:border-accent-primary transition-colors"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2" htmlFor="itemPrice">
                    Base Unit Price ($)
                  </label>
                  <input
                    id="itemPrice"
                    type="number"
                    step="0.01"
                    min="0.10"
                    required
                    className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded-sm py-2 px-3 text-sm focus:outline-none focus:border-accent-primary transition-colors font-mono"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-2" htmlFor="itemStock">
                    Opening Stock Count
                  </label>
                  <input
                    id="itemStock"
                    type="number"
                    min="0"
                    required
                    className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded-sm py-2 px-3 text-sm focus:outline-none focus:border-accent-primary transition-colors font-mono"
                    value={newItemStock}
                    onChange={(e) => setNewItemStock(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="flex-1 py-2 bg-bg-elevated hover:bg-bg-elevated/80 border border-border-subtle rounded-sm text-xs font-semibold text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-accent-primary hover:opacity-90 rounded-sm text-xs font-bold text-white transition-opacity"
                  disabled={isAddLoading}
                >
                  {isAddLoading ? "Registering..." : "Add to Catalog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}