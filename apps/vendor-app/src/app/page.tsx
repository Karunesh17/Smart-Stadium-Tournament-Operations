'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, AlertTriangle, Plus, Bell, RefreshCw, Sparkles, LogOut, TrendingUp, DollarSign, Calendar, BarChart2 } from 'lucide-react';

interface Item {
  id: number;
  vendor_id: number;
  name: string;
  base_price: number; // Dynamic price
  original_price: number | null; // Starting floor
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

interface PricingHistory {
  id: number;
  item_id: number;
  old_price: number;
  new_price: number;
  reason: string;
  timestamp: string;
}

export default function VendorDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [pricingHistory, setPricingHistory] = useState<PricingHistory[]>([]);
  const [vendorName] = useState("Priya's Stadium Concessions");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'items' | 'sales' | 'pricing-logs'>('items');

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

  // Forecast Simulation State
  const [forecastItemId, setForecastItemId] = useState<number | null>(null);
  const [forecastQty, setForecastQty] = useState(15);
  const [isForecasting, setIsForecasting] = useState(false);
  const [forecastResult, setForecastResult] = useState<{ price: number; basis: string; score: number } | null>(null);

  const fetchAllVendorData = async () => {
    setError(null);
    try {
      // 1. Fetch inventory
      const resItems = await fetch('/api/v1/items');
      if (!resItems.ok) throw new Error('Failed to load catalog inventory items.');
      const itemsData = await resItems.json();
      setItems(itemsData);

      // 2. Fetch sales
      const resSales = await fetch('/api/v1/sales');
      if (resSales.ok) {
        const salesData = await resSales.json();
        setRecentSales(salesData);
      }

      // 3. Fetch pricing history
      const resHistory = await fetch('/api/v1/pricing/history');
      if (resHistory.ok) {
        const historyData = await resHistory.json();
        setPricingHistory(historyData);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('An error occurred updating catalog analytics.');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for updates every 4 seconds
  useEffect(() => {
    fetchAllVendorData();
    const interval = setInterval(fetchAllVendorData, 4000);
    return () => clearInterval(interval);
  }, []);

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
          quantity: Number(quantity)
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Insufficient inventory levels or payment error.');
      }

      const saleRecord: Sale = await res.json();
      
      // Instantly refresh list to get dynamic prices triggered by checkouts
      await fetchAllVendorData();
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
      const res = await fetch('/api/v1/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          vendor_id: 1, // Assume default vendor ID
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
      fetchAllVendorData();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to register catalog item.');
    } finally {
      setIsAddLoading(false);
    }
  };

  // Forecast submit simulation
  const handleForecastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forecastItemId) return;
    setIsForecasting(true);
    setForecastResult(null);
    setError(null);

    try {
      const res = await fetch('/api/v1/pricing/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: forecastItemId,
          projected_sales_quantity: Number(forecastQty)
        })
      });

      if (!res.ok) throw new Error('Forecasting simulation failed.');
      const data = await res.json();
      setForecastResult({
        price: data.projected_price,
        basis: data.confidence_basis,
        score: data.confidence_score
      });
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setIsForecasting(false);
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock >= 10) return { label: "IN STOCK", color: "text-status-ok bg-status-ok/10 border-status-ok/30", dot: "bg-status-ok" };
    if (stock > 0) return { label: "LOW STOCK", color: "text-status-warning bg-status-warning/10 border-status-warning/30", dot: "bg-status-warning" };
    return { label: "OUT OF STOCK", color: "text-status-critical bg-status-critical/10 border-status-critical/30", dot: "bg-status-critical" };
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  };

  const activeSurges = items.filter(it => it.original_price && it.base_price > it.original_price).length;

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary text-text-primary">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-bg-surface border-b border-border-subtle sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-accent-primary" />
          <span className="font-bold text-lg tracking-wider text-text-primary">STADIUM CONCESSIONS POS</span>
          <span className="text-xs font-mono px-2 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-secondary">
            Vendor Portal
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-text-secondary font-mono">
            Merchant: {vendorName}
          </span>
          <button 
            onClick={handleLogout}
            className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
          <div className="flex items-center gap-1 text-ai-accent text-xs font-semibold px-2 py-1 bg-ai-accent/15 border border-ai-accent/30 rounded">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dynamic Engine Active</span>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="flex flex-1 flex-col lg:flex-row">
        
        {/* Left dashboard main view */}
        <main className="flex-1 p-6 space-y-6">
          {error && (
            <div className="border border-status-critical/30 bg-status-critical/10 text-status-critical rounded p-4 flex items-center justify-between">
              <span className="text-sm font-semibold">{error}</span>
              <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
            </div>
          )}

          {/* Quick Stats Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
              <div className="p-3 bg-accent-primary/10 rounded">
                <ShoppingBag className="w-6 h-6 text-accent-primary" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-semibold uppercase">Items Registered</p>
                <h3 className="text-2xl font-bold text-text-primary font-mono">{items.length}</h3>
              </div>
            </div>

            <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
              <div className="p-3 bg-status-critical/10 rounded">
                <TrendingUp className="w-6 h-6 text-status-critical" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-semibold uppercase">Active Surge Escalations</p>
                <h3 className="text-2xl font-bold text-text-primary font-mono">{activeSurges} <span className="text-xs text-text-secondary">items</span></h3>
              </div>
            </div>

            <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
              <div className="p-3 bg-status-warning/10 rounded">
                <DollarSign className="w-6 h-6 text-status-warning" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-semibold uppercase">Gross Concession Checkouts</p>
                <h3 className="text-2xl font-bold text-text-primary font-mono">{recentSales.length}</h3>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-4 border-b border-border-subtle">
            <button
              onClick={() => setActiveTab('items')}
              className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'items' ? 'border-accent-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              Concession Catalog Grid
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'sales' ? 'border-accent-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              Transaction Log History
            </button>
            <button
              onClick={() => setActiveTab('pricing-logs')}
              className={`pb-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'pricing-logs' ? 'border-accent-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              Surge Adjustment Audit Trail
            </button>
          </div>

          {/* TAB 1: Items Grid */}
          {activeTab === 'items' && (
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Concessions POS Catalog</h2>
                  <p className="text-xs text-text-secondary mt-0.5">Click an item card to initiate checkouts terminal</p>
                </div>
                <button
                  onClick={() => setIsAddItemOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/95 text-xs font-bold text-white rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Concession</span>
                </button>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-44 bg-bg-surface border border-border-subtle animate-pulse rounded"></div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="border border-dashed border-border-subtle bg-bg-surface rounded-md p-12 text-center">
                  <ShoppingBag className="w-10 h-10 text-text-secondary mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">No items registered in vendor catalog.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {items.map(item => {
                    const status = getStockStatus(item.stock);
                    const isSurged = item.original_price && item.base_price > item.original_price;
                    const surgeMultiplier = isSurged ? (item.base_price / (item.original_price || 1)).toFixed(2) : '1.00';

                    return (
                      <div 
                        key={item.id} 
                        onClick={() => item.stock > 0 && setSelectedItem(item)}
                        className={`bg-bg-surface border rounded-md p-5 flex flex-col justify-between cursor-pointer transition-all hover:translate-y-[-2px] ${
                          item.stock === 0 ? 'opacity-60 border-border-subtle/50' : 'border-border-subtle hover:border-accent-primary/60'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-text-primary text-base">{item.name}</h3>
                            <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-sm flex items-center gap-1 ${status.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                              <span>{status.label}</span>
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-text-primary">
                              ${item.base_price.toFixed(2)}
                            </span>
                            {isSurged && (
                              <div className="flex items-center gap-0.5 text-xs text-status-critical font-bold">
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>{surgeMultiplier}x Surge</span>
                              </div>
                            )}
                          </div>

                          <div className="text-xs font-mono text-text-secondary flex justify-between">
                            <span>Base: ${item.original_price ? item.original_price.toFixed(2) : item.base_price.toFixed(2)}</span>
                            <span>Stock: {item.stock} left</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TAB 2: Sales transaction log */}
          {activeTab === 'sales' && (
            <section className="bg-bg-surface border border-border-subtle rounded-md p-6">
              <h2 className="text-md font-bold text-text-primary mb-4">Gross POS Checkouts</h2>
              {recentSales.length === 0 ? (
                <p className="text-xs text-text-secondary">No checkouts recorded today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border-subtle text-text-secondary">
                        <th className="py-2">Sale ID</th>
                        <th>Item ID</th>
                        <th>Quantity</th>
                        <th>Charged Price</th>
                        <th>Transaction Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSales.map(sale => (
                        <tr key={sale.id} className="border-b border-border-subtle/50 text-text-primary hover:bg-bg-elevated/20">
                          <td className="py-2.5">#{sale.id}</td>
                          <td>Item #{sale.item_id}</td>
                          <td>{sale.quantity} units</td>
                          <td className="font-bold text-status-warning">${sale.price_at_sale.toFixed(2)}</td>
                          <td className="text-text-secondary">{new Date(sale.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* TAB 3: Pricing Audit Log */}
          {activeTab === 'pricing-logs' && (
            <section className="bg-bg-surface border border-border-subtle rounded-md p-6 space-y-4">
              <div>
                <h2 className="text-md font-bold text-text-primary">Dynamic Pricing Adjustment Audit Log</h2>
                <p className="text-xs text-text-secondary mt-0.5">Price changes calculated and committed in past intervals</p>
              </div>

              {pricingHistory.length === 0 ? (
                <p className="text-xs text-text-secondary">No dynamic price changes logged yet.</p>
              ) : (
                <div className="space-y-4">
                  {pricingHistory.slice().reverse().map(log => {
                    const item = items.find(i => i.id === log.item_id);
                    const direction = log.new_price > log.old_price ? 'surged' : 'demoted';
                    return (
                      <div key={log.id} className="border border-border-subtle/70 bg-bg-elevated/20 p-4 rounded flex justify-between gap-4 font-mono text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text-primary">{item ? item.name : `Item #${log.item_id}`}</span>
                            <span className={`text-[10px] px-1.5 rounded uppercase font-semibold ${
                              direction === 'surged' ? 'bg-status-critical/10 text-status-critical' : 'bg-status-ok/10 text-status-ok'
                            }`}>
                              {direction}
                            </span>
                          </div>
                          <p className="text-text-secondary text-[11px]">Reason: {log.reason}</p>
                          <p className="text-[10px] text-text-secondary/70">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right flex flex-col justify-center">
                          <span className="text-text-secondary text-[10px]">Price Shift</span>
                          <span className="font-bold text-text-primary">
                            ${log.old_price.toFixed(2)} $\rightarrow$ <span className={direction === 'surged' ? 'text-status-critical' : 'text-status-ok'}>${log.new_price.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>

        {/* Right side dynamic pricing rules & forecast simulator sidebar */}
        <aside className="w-full lg:w-96 bg-bg-surface border-t lg:border-t-0 lg:border-l border-border-subtle p-6 space-y-6">
          
          {/* Recalculate Cooldown info */}
          <div className="bg-bg-elevated p-4 border border-border-subtle rounded space-y-3">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
              <span>Surge Engine Rules</span>
            </h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-text-secondary">Antiflap Cooldown:</span>
                <span className="text-text-primary font-bold">30 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Demand Horizon:</span>
                <span className="text-text-primary">5-min velocity</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Price Ceiling:</span>
                <span className="text-status-critical font-bold">2.5x original</span>
              </div>
            </div>
          </div>

          {/* Pricing Forecast Simulator */}
          <div className="space-y-4 border-t border-border-subtle pt-6">
            <div>
              <h3 className="text-md font-bold text-text-primary flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-accent-primary" />
                <span>Pricing Forecast Simulator</span>
              </h3>
              <p className="text-xs text-text-secondary mt-1">Simulate future prices based on projected checkout rates</p>
            </div>

            <form onSubmit={handleForecastSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                  Target Concession
                </label>
                <select
                  value={forecastItemId || ''}
                  onChange={(e) => setForecastItemId(Number(e.target.value))}
                  className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs focus:outline-none focus:border-accent-primary"
                  required
                >
                  <option value="">-- Choose Item --</option>
                  {items.map(it => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                  Projected sales in next 5m
                </label>
                <input
                  type="number"
                  min="1"
                  value={forecastQty}
                  onChange={(e) => setForecastQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs font-mono focus:outline-none focus:border-accent-primary"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-accent-primary text-white text-xs font-bold rounded hover:opacity-90 transition-opacity"
                disabled={isForecasting || !forecastItemId}
              >
                {isForecasting ? "Computing Projections..." : "Simulate Price Forecast"}
              </button>
            </form>

            {forecastResult && (
              <div className="bg-bg-elevated p-4 border border-border-subtle rounded space-y-3 font-mono text-xs">
                <div className="flex justify-between items-baseline border-b border-border-subtle/50 pb-2">
                  <span className="text-text-secondary text-[11px]">Projected Price:</span>
                  <span className="text-lg font-bold text-status-warning">${forecastResult.price.toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-text-secondary uppercase block font-semibold">Confidence basis</span>
                  <p className="text-[11px] text-text-primary leading-relaxed">{forecastResult.basis}</p>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-text-secondary font-semibold">Reliability Score:</span>
                  <span className={`font-bold px-1.5 py-0.5 rounded ${
                    forecastResult.score >= 0.8 ? 'bg-status-ok/10 text-status-ok' : 'bg-status-warning/10 text-status-warning'
                  }`}>
                    {Math.round(forecastResult.score * 100)}% Confidence
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* MODAL: Checkout quantity confirmation */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-subtle max-w-sm w-full rounded p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Concessions Checkout</h3>
              <p className="text-xs text-text-secondary mt-1">Record sales transaction for "{selectedItem.name}"</p>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Checkout Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(selectedItem.stock, Math.max(1, Number(e.target.value))))}
                  className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs font-mono focus:outline-none focus:border-accent-primary"
                  required
                />
              </div>

              <div className="bg-bg-elevated p-3 border border-border-subtle rounded space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Current Surge Price:</span>
                  <span className="text-text-primary font-bold">${selectedItem.base_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border-subtle/50 pt-2 font-bold">
                  <span>Grand Total:</span>
                  <span className="text-status-warning">${(selectedItem.base_price * quantity).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3 justify-end text-xs font-bold pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-bg-elevated border border-border-subtle hover:bg-bg-elevated/70 text-text-secondary rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent-primary text-white hover:opacity-95 rounded flex items-center gap-1.5"
                  disabled={isCheckoutLoading}
                >
                  {isCheckoutLoading ? "Processing..." : "Complete Checkout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Register Concession */}
      {isAddItemOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-subtle max-w-sm w-full rounded p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-text-primary">Register Concession</h3>
              <p className="text-xs text-text-secondary mt-1">Add a new item to Priya's Concessions catalog</p>
            </div>

            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Concession Item Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nacho Combo"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs focus:outline-none focus:border-accent-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Starting Price Floor ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(Math.max(0.01, Number(e.target.value)))}
                  className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs font-mono focus:outline-none focus:border-accent-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Initial Inventory Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={newItemStock}
                  onChange={(e) => setNewItemStock(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs font-mono focus:outline-none focus:border-accent-primary"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end text-xs font-bold pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="px-4 py-2 bg-bg-elevated border border-border-subtle hover:bg-bg-elevated/70 text-text-secondary rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent-primary text-white hover:opacity-95 rounded"
                  disabled={isAddLoading}
                >
                  {isAddLoading ? "Saving Concession..." : "Register Concession"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}