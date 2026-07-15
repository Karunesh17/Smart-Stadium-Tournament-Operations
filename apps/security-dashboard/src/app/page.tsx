'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Users, RefreshCw, AlertOctagon, Activity, Sparkles, CheckCircle2, ChevronRight, LogOut } from 'lucide-react';

interface HeatmapArea {
  area_id: number;
  name: string;
  capacity: int;
  current_count: int;
  density_percentage: number;
  status: 'safe' | 'warning' | 'danger';
}

interface HeatmapResponse {
  areas: HeatmapArea[];
  updated_at: string;
}

export default function SecurityDashboard() {
  const [heatmapData, setHeatmapData] = useState<HeatmapArea[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local telemetry simulation controls state
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [simCount, setSimCount] = useState(100);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);

  const fetchHeatmap = async () => {
    setError(null);
    try {
      const res = await fetch('/api/v1/crowd/heatmap');
      if (!res.ok) throw new Error('Failed to retrieve crowd heatmap telemetry.');
      const data: HeatmapResponse = await res.json();
      setHeatmapData(data.areas);
      setLastUpdated(data.updated_at);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to query density statistics.');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for updates every 3 seconds to satisfy the < 5s update window
  useEffect(() => {
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulator telemetry submit
  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId) return;
    setIsSimulating(true);
    setSimSuccess(false);
    setError(null);

    try {
      const res = await fetch('/api/v1/crowd/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: selectedAreaId,
          count: Number(simCount)
        })
      });

      if (!res.ok) throw new Error('Failed to post telemetry sensor data.');
      
      setSimSuccess(true);
      setTimeout(() => setSimSuccess(false), 2000);
      fetchHeatmap(); // Immediate update
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Telemetry submission error.');
    } finally {
      setIsSimulating(false);
    }
  };

  const triggerPresetSpike = async (areaId: number, targetCapacity: number, multiplier: number) => {
    setError(null);
    const count = Math.round(targetCapacity * multiplier);
    try {
      const res = await fetch('/api/v1/crowd/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: areaId,
          count: count
        })
      });
      if (!res.ok) throw new Error('Failed to trigger spike.');
      fetchHeatmap();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  // Aggregated stadium occupancy statistics
  const totalCapacity = heatmapData.reduce((sum, area) => sum + area.capacity, 0);
  const totalOccupancy = heatmapData.reduce((sum, area) => sum + area.current_count, 0);
  const averageDensity = totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0;

  const getStatusClasses = (status: 'safe' | 'warning' | 'danger') => {
    if (status === 'safe') return { card: 'border-status-ok/30 bg-status-ok/5', label: 'text-status-ok bg-status-ok/10 border-status-ok/20', badge: 'bg-status-ok' };
    if (status === 'warning') return { card: 'border-status-warning/30 bg-status-warning/5', label: 'text-status-warning bg-status-warning/10 border-status-warning/20', badge: 'bg-status-warning' };
    return { card: 'border-status-critical/30 bg-status-critical/5', label: 'text-status-critical bg-status-critical/10 border-status-critical/20', badge: 'bg-status-critical' };
  };

  const getRiskStatus = () => {
    const dangerAreas = heatmapData.filter(a => a.status === 'danger');
    if (dangerAreas.length > 0) return { label: 'CRITICAL CONGESTION', color: 'text-status-critical bg-status-critical/10 border-status-critical/30' };
    const warningAreas = heatmapData.filter(a => a.status === 'warning');
    if (warningAreas.length > 0) return { label: 'ELEVATED ALERT', color: 'text-status-warning bg-status-warning/10 border-status-warning/30' };
    return { label: 'SECURE', color: 'text-status-ok bg-status-ok/10 border-status-ok/30' };
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary text-text-primary">
      {/* Top Header Navbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-bg-surface border-b border-border-subtle sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-accent-primary" />
          <span className="font-bold text-lg tracking-wider text-text-primary">SECURITY COMMAND</span>
          <span className="text-xs font-mono px-2 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-secondary">
            Telemetry Dashboard
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 border rounded font-mono text-xs font-bold ${getRiskStatus().color}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>RISK LEVEL: {getRiskStatus().label}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
          <div className="flex items-center gap-1 text-ai-accent text-xs font-semibold px-2 py-1 bg-ai-accent/15 border border-ai-accent/30 rounded">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Copilot Guard Active</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left main view */}
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
                <Shield className="w-6 h-6 text-accent-primary" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-semibold uppercase">Total Safe Sectors</p>
                <h3 className="text-2xl font-bold text-text-primary">
                  {heatmapData.filter(a => a.status === 'safe').length} / {heatmapData.length}
                </h3>
              </div>
            </div>

            <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
              <div className="p-3 bg-status-warning/10 rounded">
                <Users className="w-6 h-6 text-status-warning" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-semibold uppercase">Current Occupancy</p>
                <h3 className="text-2xl font-bold text-text-primary font-mono">
                  {totalOccupancy.toLocaleString()} <span className="text-xs text-text-secondary">/ {totalCapacity.toLocaleString()}</span>
                </h3>
              </div>
            </div>

            <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
              <div className="p-3 bg-status-critical/10 rounded">
                <Activity className="w-6 h-6 text-status-critical" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-semibold uppercase">Average Density</p>
                <h3 className="text-2xl font-bold text-text-primary font-mono">
                  {averageDensity.toFixed(1)}%
                </h3>
              </div>
            </div>
          </div>

          {/* Heatmap Layout Grid */}
          <section className="bg-bg-surface border border-border-subtle rounded-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Stadium Sectors Occupancy</h2>
                <p className="text-xs text-text-secondary mt-0.5">Real-time CCTV and Wi-Fi scanner estimates</p>
              </div>
              <button 
                onClick={fetchHeatmap}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated border border-border-subtle hover:bg-bg-elevated/80 text-xs font-semibold text-text-secondary rounded transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Fetch Latest</span>
              </button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-bg-elevated border border-border-subtle animate-pulse rounded"></div>
                ))}
              </div>
            ) : heatmapData.length === 0 ? (
              <div className="border border-dashed border-border-subtle rounded p-12 text-center">
                <AlertOctagon className="w-10 h-10 text-text-secondary mx-auto mb-3" />
                <p className="text-sm text-text-secondary">No physical area sectors defined in database.</p>
                <p className="text-xs text-text-secondary mt-1">Use the simulator tool to create defaults.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {heatmapData.map(area => {
                  const ui = getStatusClasses(area.status);
                  return (
                    <div key={area.area_id} className={`border rounded-md p-5 flex flex-col justify-between transition-colors ${ui.card}`}>
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-text-primary text-base">{area.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-sm flex items-center gap-1 ${ui.label}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ui.badge}`}></span>
                            <span className="uppercase">{area.status}</span>
                          </span>
                        </div>

                        {/* Capacity gauge */}
                        <div className="flex justify-between text-xs font-mono text-text-secondary mb-2">
                          <span>Occupancy: {area.current_count} / {area.capacity}</span>
                          <span>{area.density_percentage}%</span>
                        </div>
                        <div className="w-full bg-bg-elevated rounded-full h-2 overflow-hidden border border-border-subtle">
                          <div 
                            className={`h-full transition-all duration-500 rounded-full ${
                              area.status === 'safe' ? 'bg-status-ok' : area.status === 'warning' ? 'bg-status-warning' : 'bg-status-critical'
                            }`}
                            style={{ width: `${Math.min(100, area.density_percentage)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Interactive presets for spikes tests */}
                      <div className="flex gap-2 mt-4 pt-3 border-t border-border-subtle/40">
                        <button
                          onClick={() => triggerPresetSpike(area.area_id, area.capacity, 0.45)}
                          className="px-2 py-1 bg-bg-elevated hover:bg-bg-elevated/70 border border-border-subtle rounded text-[10px] font-semibold text-text-secondary"
                        >
                          Reset Normal (45%)
                        </button>
                        <button
                          onClick={() => triggerPresetSpike(area.area_id, area.capacity, 0.95)}
                          className="px-2 py-1 bg-status-critical/10 hover:bg-status-critical/20 border border-status-critical/20 rounded text-[10px] font-semibold text-status-critical"
                        >
                          Trigger Spike (95%)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* Right side simulator panel */}
        <aside className="w-full lg:w-96 bg-bg-surface border-t lg:border-t-0 lg:border-l border-border-subtle p-6 space-y-6">
          <div className="border-b border-border-subtle pb-4">
            <h3 className="text-md font-bold text-text-primary flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-accent-primary" />
              <span>CCTV & BLE Telemetry Simulator</span>
            </h3>
            <p className="text-xs text-text-secondary mt-1">Simulate live hardware counts directly from client console</p>
          </div>

          <form onSubmit={handleSimulateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Target Sector
              </label>
              <select
                className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs focus:outline-none focus:border-accent-primary"
                value={selectedAreaId || ''}
                onChange={(e) => setSelectedAreaId(Number(e.target.value))}
                required
              >
                <option value="">-- Choose Area Sector --</option>
                {heatmapData.map(a => (
                  <option key={a.area_id} value={a.area_id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Simulated Headcount Count
              </label>
              <input
                type="number"
                min="0"
                className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs font-mono focus:outline-none focus:border-accent-primary"
                value={simCount}
                onChange={(e) => setSimCount(Math.max(0, Number(e.target.value)))}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-accent-primary text-white text-xs font-bold rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              disabled={isSimulating || !selectedAreaId}
            >
              {isSimulating ? "Streaming Ingest..." : "Post Telemetry Count"}
            </button>

            {simSuccess && (
              <div className="flex items-center gap-1 text-xs text-status-ok justify-center font-semibold mt-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Count updated in heatmap!</span>
              </div>
            )}
          </form>

          <div className="border-t border-border-subtle pt-4 space-y-4">
            <h4 className="text-xs font-bold text-text-secondary uppercase">Telemetry Details</h4>
            <div className="bg-bg-elevated p-3 border border-border-subtle rounded space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-text-secondary">Last Sync:</span>
                <span className="text-text-primary">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Ingest Sync Channel:</span>
                <span className="text-accent-primary">crowd.updated</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Identifier Gating:</span>
                <span className="text-status-ok font-semibold">Anonymized</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}