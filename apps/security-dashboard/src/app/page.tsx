'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Users, RefreshCw, AlertOctagon, Activity, Sparkles, CheckCircle2, AlertTriangle, LogOut, Flame, ShieldAlert, HeartPulse, HardHat, FileWarning, BarChart2, DollarSign, TrendingUp, Briefcase } from 'lucide-react';
import ChatWidget from '../../../../libs/shared-ui/ChatWidget';

interface HeatmapArea {
  area_id: number;
  name: string;
  capacity: number;
  current_count: number;
  density_percentage: number;
  status: 'safe' | 'warning' | 'danger';
}

interface HeatmapResponse {
  areas: HeatmapArea[];
  updated_at: string;
}

interface Incident {
  id: number;
  title: string;
  description: string | null;
  type: string;
  area_id: number;
  severity_score: number;
  severity_level: 'info' | 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'assigned' | 'resolved';
  is_overridden: boolean;
  created_at: string;
}

// Analytics Interfaces
interface SalesByItem {
  item_name: string;
  revenue: number;
  quantity_sold: number;
}

interface SalesAnalytics {
  total_revenue: number;
  total_transactions: number;
  items_sold: number;
  sales_by_item: SalesByItem[];
}

interface AreaOccupancy {
  area_name: string;
  current_count: number;
  capacity: number;
  density: number;
}

interface CrowdAnalytics {
  total_stadium_occupancy: number;
  occupancy_by_area: AreaOccupancy[];
}

interface StaffAnalytics {
  total_volunteers: number;
  active_shifts: number;
  task_completion_rate: number;
  tasks_by_status: Record<string, number>;
}

interface IncidentAnalytics {
  total_incidents: number;
  incidents_by_severity: Record<string, number>;
  incidents_by_status: Record<string, number>;
}

interface DashboardAnalytics {
  sales: SalesAnalytics;
  crowd: CrowdAnalytics;
  staff: StaffAnalytics;
  incidents: IncidentAnalytics;
  cached: boolean;
}

export default function SecurityDashboard() {
  const [activeMainTab, setActiveMainTab] = useState<'telemetry' | 'analytics'>('telemetry');
  
  // Telemetry View state
  const [heatmapData, setHeatmapData] = useState<HeatmapArea[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics View state
  const [analyticsData, setAnalyticsData] = useState<DashboardAnalytics | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [lastAnalyticsFetch, setLastAnalyticsFetch] = useState<string | null>(null);
  
  // Local telemetry simulation controls state
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [simCount, setSimCount] = useState(100);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);

  // Incident intake form state
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportType, setReportType] = useState('general');
  const [reportAreaId, setReportAreaId] = useState<number | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const fetchHeatmapAndIncidents = async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';
    setError(null);
    try {
      // 1. Fetch heatmap
      const resHeatmap = await fetch('/api/v1/crowd/heatmap');
      if (!resHeatmap.ok) throw new Error('Failed to retrieve crowd heatmap telemetry.');
      const heatmap: HeatmapResponse = await resHeatmap.json();
      setHeatmapData(heatmap.areas);
      setLastUpdated(heatmap.updated_at);

      // 2. Fetch incidents
      const resIncidents = await fetch('/api/v1/incidents/', {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (resIncidents.ok) {
        const incidentsData = await resIncidents.json();
        setIncidents(incidentsData);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to query operations statistics.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalyticsDashboard = async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';
    setIsAnalyticsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/analytics/dashboard', {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access denied: Requires Admin/Security permissions.');
        throw new Error('Failed to pull consolidated operations KPI metrics.');
      }
      const data: DashboardAnalytics = await res.json();
      setAnalyticsData(data);
      setLastAnalyticsFetch(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load operations analytics reports.');
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  // Poll for updates based on active tab
  useEffect(() => {
    fetchHeatmapAndIncidents();
    const intervalTelemetry = setInterval(fetchHeatmapAndIncidents, 4000);
    return () => clearInterval(intervalTelemetry);
  }, []);

  useEffect(() => {
    if (activeMainTab === 'analytics') {
      fetchAnalyticsDashboard();
    }
  }, [activeMainTab]);

  const handleSimulateTelemetry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId) {
      setError('Please select a target stadium area.');
      return;
    }
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

      if (!res.ok) throw new Error('Telemetry sweep ingest pipeline failed.');

      setSimSuccess(true);
      setTimeout(() => setSimSuccess(false), 2000);
      fetchHeatmapAndIncidents();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Telemetry simulation failed.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle || !reportAreaId) {
      setError('Incident title and location details are required.');
      return;
    }
    setIsReporting(true);
    setReportSuccess(false);
    setError(null);

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';

    try {
      const res = await fetch('/api/v1/incidents/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          title: reportTitle,
          description: reportDesc,
          type: reportType,
          area_id: reportAreaId
        })
      });

      if (!res.ok) throw new Error('Failed to report incident to risk engine.');

      setReportSuccess(true);
      setReportTitle('');
      setReportDesc('');
      setTimeout(() => setReportSuccess(false), 2000);
      fetchHeatmapAndIncidents();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to submit incident report.');
    } finally {
      setIsReporting(false);
    }
  };

  const handleOverrideSeverity = async (incidentId: number, newLevel: string) => {
    setError(null);
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';

    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}/override`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ severity_level: newLevel })
      });

      if (!res.ok) throw new Error('Failed to override incident severity level.');
      fetchHeatmapAndIncidents();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleResolveIncident = async (incidentId: number) => {
    setError(null);
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';

    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ status: 'resolved' })
      });

      if (!res.ok) throw new Error('Failed to resolve incident.');
      fetchHeatmapAndIncidents();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const totalCapacity = heatmapData.reduce((sum, area) => sum + area.capacity, 0);
  const totalOccupancy = heatmapData.reduce((sum, area) => sum + area.current_count, 0);
  const averageDensity = totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0;

  const getStatusClasses = (status: 'safe' | 'warning' | 'danger') => {
    if (status === 'safe') return { card: 'border-status-ok/30 bg-status-ok/5', label: 'text-status-ok bg-status-ok/10 border-status-ok/20', badge: 'bg-status-ok' };
    if (status === 'warning') return { card: 'border-status-warning/30 bg-status-warning/5', label: 'text-status-warning bg-status-warning/10 border-status-warning/20', badge: 'bg-status-warning' };
    return { card: 'border-status-critical/30 bg-status-critical/5', label: 'text-status-critical bg-status-critical/10 border-status-critical/20', badge: 'bg-status-critical' };
  };

  const getSeverityBadgeClasses = (level: string) => {
    if (level === 'critical') return 'text-status-critical bg-status-critical/10 border-status-critical/30';
    if (level === 'high') return 'text-status-critical/80 bg-status-critical/5 border-status-critical/20';
    if (level === 'medium') return 'text-status-warning bg-status-warning/10 border-status-warning/30';
    if (level === 'low') return 'text-text-primary bg-bg-elevated border-border-subtle';
    return 'text-text-secondary bg-bg-elevated/40 border-border-subtle/50';
  };

  const getIncidentIcon = (type: string) => {
    if (type === 'fire') return <Flame className="w-4 h-4 text-status-critical" />;
    if (type === 'medical') return <HeartPulse className="w-4 h-4 text-status-critical" />;
    if (type === 'security') return <ShieldAlert className="w-4 h-4 text-status-warning" />;
    if (type === 'structural') return <HardHat className="w-4 h-4 text-status-warning" />;
    return <FileWarning className="w-4 h-4 text-text-secondary" />;
  };

  const getRiskStatus = () => {
    const activeIncidentsCount = incidents.filter(i => i.status !== 'resolved').length;
    const dangerAreas = heatmapData.filter(a => a.status === 'danger');
    
    if (activeIncidentsCount > 0 || dangerAreas.length > 0) {
      return { label: 'ELEVATED RISK LEVEL', color: 'text-status-critical bg-status-critical/10 border-status-critical/30' };
    }
    return { label: 'STABLE OPERATIONS', color: 'text-status-ok bg-status-ok/10 border-status-ok/30' };
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
            Telemetry & Risk Control
          </span>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-bg-primary border border-border-subtle p-1 rounded">
          <button
            onClick={() => setActiveMainTab('telemetry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
              activeMainTab === 'telemetry' ? 'bg-accent-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Command Telemetry Feed</span>
          </button>
          <button
            onClick={() => setActiveMainTab('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
              activeMainTab === 'analytics' ? 'bg-accent-primary text-white shadow' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Operational KPI Analytics</span>
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 border rounded font-mono text-xs font-bold ${getRiskStatus().color}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>RISK: {getRiskStatus().label}</span>
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
            <span>Guard Engine Online</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      {activeMainTab === 'telemetry' ? (
        <div className="flex flex-1 flex-col lg:flex-row">
          
          {/* Left main telemetry view */}
          <main className="flex-1 p-6 space-y-6">
            {error && (
              <div className="border border-status-critical/30 bg-status-critical/10 text-status-critical rounded p-4 flex items-center justify-between">
                <span className="text-sm font-semibold">{error}</span>
                <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
              </div>
            )}

            {/* Quick Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
                <div className="p-3 bg-accent-primary/10 rounded">
                  <Shield className="w-6 h-6 text-accent-primary" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary font-semibold uppercase">Sectors Guarded</p>
                  <h3 className="text-2xl font-bold text-text-primary">
                    {heatmapData.filter(a => a.status === 'safe').length} / {heatmapData.length}
                  </h3>
                </div>
              </div>

              <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
                <div className="p-3 bg-status-critical/10 rounded">
                  <AlertTriangle className="w-6 h-6 text-status-critical" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary font-semibold uppercase">Active Incidents</p>
                  <h3 className="text-2xl font-bold text-text-primary font-mono">
                    {incidents.filter(i => i.status !== 'resolved').length}
                  </h3>
                </div>
              </div>

              <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
                <div className="p-3 bg-status-warning/10 rounded">
                  <Users className="w-6 h-6 text-status-warning" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary font-semibold uppercase">Stadium Occupancy</p>
                  <h3 className="text-2xl font-bold text-text-primary font-mono text-base">
                    {totalOccupancy.toLocaleString()} <span className="text-xs text-text-secondary">/ {totalCapacity.toLocaleString()}</span>
                  </h3>
                </div>
              </div>

              <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-4">
                <div className="p-3 bg-bg-elevated rounded">
                  <Activity className="w-6 h-6 text-text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary font-semibold uppercase">Avg Density</p>
                  <h3 className="text-2xl font-bold text-text-primary font-mono">
                    {averageDensity.toFixed(1)}%
                  </h3>
                </div>
              </div>
            </div>

            {/* Stadium Heatmap Telemetry Grid */}
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Stadium Sector CCTV Telemetry</h2>
                <p className="text-xs text-text-secondary mt-0.5">Real-time occupancy metrics streamed from local BLE and visual scanning networks</p>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-bg-surface border border-border-subtle animate-pulse rounded"></div>
                  ))}
                </div>
              ) : heatmapData.length === 0 ? (
                <div className="border border-dashed border-border-subtle bg-bg-surface rounded-md p-12 text-center text-xs text-text-secondary">
                  No crowd telemetry sectors registered.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {heatmapData.map(area => {
                    const status = getStatusClasses(area.status);
                    return (
                      <div 
                        key={area.area_id}
                        className={`bg-bg-surface border rounded-md p-5 flex flex-col justify-between transition-all hover:translate-y-[-1px] ${status.card}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-text-primary text-sm">{area.name}</h3>
                            <span className="text-[10px] text-text-secondary font-mono">ID: #{area.area_id}</span>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-sm flex items-center gap-1 uppercase ${status.label}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.badge}`}></span>
                            <span>{area.status}</span>
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-text-secondary">Density:</span>
                            <span className="font-bold text-text-primary">{(area.density_percentage * 100).toFixed(0)}%</span>
                          </div>
                          
                          {/* Visual density meter bar */}
                          <div className="w-full h-1.5 bg-bg-elevated rounded overflow-hidden">
                            <div 
                              className="h-full transition-all duration-500"
                              style={{ 
                                width: `${Math.min(100, area.density_percentage * 100)}%`,
                                backgroundColor: area.status === 'safe' ? '#2ECC71' : area.status === 'warning' ? '#F5A623' : '#E5484D' 
                              }}
                            />
                          </div>

                          <div className="flex justify-between text-[11px] font-mono text-text-secondary pt-1">
                            <span>Count: {area.current_count}</span>
                            <span>Cap: {area.capacity}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Incident Log Feed */}
            <section className="bg-bg-surface border border-border-subtle rounded-md p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-border-subtle/50 pb-3">
                <div>
                  <h2 className="text-md font-bold text-text-primary">Active Incident Logs Feed</h2>
                  <p className="text-xs text-text-secondary mt-0.5">Real-time dispatch status of security reports</p>
                </div>
                <span className="text-xs font-semibold text-accent-primary font-mono">
                  {incidents.filter(i => i.status !== 'resolved').length} incidents unresolved
                </span>
              </div>

              {incidents.length === 0 ? (
                <p className="text-xs text-text-secondary py-4 text-center">No security incidents reported today.</p>
              ) : (
                <div className="space-y-4">
                  {incidents.slice().reverse().map(inc => (
                    <div 
                      key={inc.id} 
                      className={`border border-border-subtle/70 bg-bg-elevated/20 p-4 rounded-md flex flex-col md:flex-row justify-between gap-4 font-mono text-xs ${
                        inc.status === 'resolved' ? 'opacity-65' : ''
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                            {getIncidentIcon(inc.type)}
                            <span>Incident #{inc.id}: {inc.title}</span>
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getSeverityBadgeClasses(inc.severity_level)}`}>
                            {inc.severity_level.toUpperCase()}
                          </span>
                          <span className={`text-[9px] px-1.5 rounded uppercase font-semibold ${
                            inc.status === 'resolved' ? 'bg-status-ok/10 text-status-ok' : inc.status === 'assigned' ? 'bg-status-warning/10 text-status-warning' : 'bg-status-critical/10 text-status-critical'
                          }`}>
                            {inc.status}
                          </span>
                          {inc.is_overridden && (
                            <span className="text-[9px] bg-accent-primary/10 text-accent-primary px-1 rounded font-semibold uppercase">
                              Manual Overridden
                            </span>
                          )}
                        </div>
                        <p className="text-text-secondary text-xs leading-relaxed">{inc.description || 'No descriptive details logged.'}</p>
                        <div className="flex gap-4 text-[10px] text-text-secondary/70 pt-1">
                          <span>Location: Area #{inc.area_id}</span>
                          <span>Reported: {new Date(inc.created_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Incident Override & Resolution Actions */}
                      <div className="flex flex-row md:flex-col justify-end items-end gap-3 min-w-[150px]">
                        {inc.status !== 'resolved' && (
                          <>
                            <div className="w-full flex flex-col gap-1">
                              <label className="text-[9px] text-text-secondary font-semibold uppercase">Override Severity</label>
                              <select
                                value={inc.severity_level}
                                onChange={(e) => handleOverrideSeverity(inc.id, e.target.value)}
                                className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-1 px-2 text-[11px] focus:outline-none focus:border-accent-primary"
                              >
                                <option value="info">Info</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                              </select>
                            </div>

                            <button
                              onClick={() => handleResolveIncident(inc.id)}
                              className="px-3 py-1 bg-status-ok hover:opacity-90 text-[11px] text-white font-bold rounded-sm w-full text-center transition-all"
                            >
                              Resolve Event
                            </button>
                          </>
                        )}
                        {inc.status === 'resolved' && (
                          <span className="text-status-ok text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>RESOLVED</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          {/* Right sidebar with simulation controls and intake form */}
          <aside className="w-full lg:w-96 bg-bg-surface border-t lg:border-t-0 lg:border-l border-border-subtle p-6 space-y-6">
            
            {/* Real-time Telemetry Simulator controls */}
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-bold text-text-primary flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-accent-primary" />
                  <span>Telemetry Sweep Simulator</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">Simulate visual/BLE CCTV sensor sweep counts</p>
              </div>

              {simSuccess && (
                <div className="bg-status-ok/10 border border-status-ok/30 text-status-ok text-xs p-3 rounded font-semibold">
                  Sensor count update emitted successfully.
                </div>
              )}

              <form onSubmit={handleSimulateTelemetry} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                    Select Target Area
                  </label>
                  <select
                    value={selectedAreaId || ''}
                    onChange={(e) => setSelectedAreaId(Number(e.target.value))}
                    className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs focus:outline-none focus:border-accent-primary"
                    required
                  >
                    <option value="">-- Choose Stadium Area --</option>
                    {heatmapData.map(area => (
                      <option key={area.area_id} value={area.area_id}>{area.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                    Simulate Occupant Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={simCount}
                    onChange={(e) => setSimCount(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs font-mono focus:outline-none focus:border-accent-primary"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-accent-primary text-white text-xs font-bold rounded hover:opacity-90 transition-opacity"
                  disabled={isSimulating || !selectedAreaId}
                >
                  {isSimulating ? "Transmitting telemetry..." : "Transmit Sensor Sweep"}
                </button>
              </form>
            </div>

            {/* Security Incident Intake Log Form */}
            <div className="space-y-4 border-t border-border-subtle pt-6">
              <div>
                <h3 className="text-md font-bold text-text-primary flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-status-critical" />
                  <span>Log Security Incident</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">Manual incident intake form reporting to the Risk Engine</p>
              </div>

              {reportSuccess && (
                <div className="bg-status-ok/10 border border-status-ok/30 text-status-ok text-xs p-3 rounded font-semibold">
                  Incident registered and auto-assigned tasks.
                </div>
              )}

              <form onSubmit={handleReportIncident} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                    Incident Summary Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flipped barricade in Sector A"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs focus:outline-none focus:border-accent-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                    Descriptive logs
                  </label>
                  <textarea
                    placeholder="Provide details about risk factors, actions, or immediate specialist assignments"
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs h-20 focus:outline-none focus:border-accent-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                      Event Type
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs focus:outline-none focus:border-accent-primary"
                    >
                      <option value="general">General</option>
                      <option value="fire">Fire</option>
                      <option value="medical">Medical</option>
                      <option value="security">Security</option>
                      <option value="structural">Structural</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">
                      Sector Area Location
                    </label>
                    <select
                      value={reportAreaId || ''}
                      onChange={(e) => setReportAreaId(Number(e.target.value))}
                      className="w-full bg-bg-elevated border border-border-subtle text-text-primary rounded py-2 px-3 text-xs focus:outline-none focus:border-accent-primary"
                      required
                    >
                      <option value="">-- Sector --</option>
                      {heatmapData.map(area => (
                        <option key={area.area_id} value={area.area_id}>{area.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-status-critical text-white text-xs font-bold rounded hover:opacity-95 transition-opacity"
                  disabled={isReporting || !reportTitle || !reportAreaId}
                >
                  {isReporting ? "Evaluating incident metrics..." : "Commit Incident Report"}
                </button>
              </form>
            </div>

            {/* Risk factors indicator info */}
            <div className="space-y-4 border-t border-border-subtle pt-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-text-secondary uppercase">Risk Engine Factors</h4>
                <div className="bg-bg-elevated p-3 border border-border-subtle rounded space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Density Mult:</span>
                    <span className="text-text-primary">1.0 + (Occupancy / Capacity)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Night Shift Mult:</span>
                    <span className="text-text-primary">1.5x (18:00 - 06:00 UTC)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Auto-Task Escalate:</span>
                    <span className="text-status-critical font-semibold">High / Critical</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        /* Analytics View Tab */
        <main className="flex-1 p-6 space-y-6">
          {error && (
            <div className="border border-status-critical/30 bg-status-critical/10 text-status-critical rounded p-4 flex items-center justify-between">
              <span className="text-sm font-semibold">{error}</span>
              <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
            </div>
          )}

          {/* Admin Analytics Header Panel */}
          <div className="flex justify-between items-center bg-bg-surface border border-border-subtle p-5 rounded-md">
            <div>
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-accent-primary" />
                <span>STADIUM AGGREGATE KPI METRICS</span>
              </h2>
              <p className="text-xs text-text-secondary mt-1 font-mono">
                Consolidated Operational Reporting & Cross-Service Aggregations
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {analyticsData && (
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border rounded uppercase ${
                  analyticsData.cached 
                    ? 'text-status-warning bg-status-warning/10 border-status-warning/20' 
                    : 'text-status-ok bg-status-ok/10 border-status-ok/20'
                }`}>
                  {analyticsData.cached ? "Cached (5s TTL)" : "Fresh Data"}
                </span>
              )}
              {lastAnalyticsFetch && (
                <span className="text-xs text-text-secondary font-mono">
                  Refreshed: {lastAnalyticsFetch}
                </span>
              )}
              <button
                onClick={fetchAnalyticsDashboard}
                disabled={isAnalyticsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated hover:bg-bg-elevated/80 border border-border-subtle rounded text-xs font-bold text-text-primary transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAnalyticsLoading ? 'animate-spin' : ''}`} />
                <span>Sync Metrics</span>
              </button>
            </div>
          </div>

          {/* Aggregated KPI Section */}
          {isAnalyticsLoading && !analyticsData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-64 bg-bg-surface border border-border-subtle animate-pulse rounded"></div>
              ))}
            </div>
          ) : !analyticsData ? (
            <div className="border border-dashed border-border-subtle bg-bg-surface rounded-md p-12 text-center text-xs text-text-secondary">
              Failed to resolve aggregate data. Verify admin role mapping tokens.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* CARD 1: Concession Sales Performance */}
              <div className="bg-bg-surface border border-border-subtle rounded-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2">
                  <h3 className="font-bold text-sm text-text-primary flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-status-warning" />
                    <span>Concession Merchant Sales</span>
                  </h3>
                  <span className="text-xs text-text-secondary font-mono">Inventory Service</span>
                </div>
                
                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-4 font-mono text-center">
                  <div className="bg-bg-elevated p-3 border border-border-subtle/40 rounded">
                    <span className="text-[10px] text-text-secondary block">Gross Revenue</span>
                    <span className="text-lg font-bold text-status-ok">${analyticsData.sales.total_revenue.toFixed(2)}</span>
                  </div>
                  <div className="bg-bg-elevated p-3 border border-border-subtle/40 rounded">
                    <span className="text-[10px] text-text-secondary block">Transactions</span>
                    <span className="text-lg font-bold text-text-primary">{analyticsData.sales.total_transactions}</span>
                  </div>
                  <div className="bg-bg-elevated p-3 border border-border-subtle/40 rounded">
                    <span className="text-[10px] text-text-secondary block">Items Sold</span>
                    <span className="text-lg font-bold text-accent-primary">{analyticsData.sales.items_sold}</span>
                  </div>
                </div>

                {/* Items breakdown list */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-semibold text-text-secondary uppercase">Product sales revenue share</h4>
                  {analyticsData.sales.sales_by_item.length === 0 ? (
                    <p className="text-xs text-text-secondary font-mono italic">No transactions recorded yet.</p>
                  ) : (
                    <div className="space-y-2.5 font-mono text-xs">
                      {analyticsData.sales.sales_by_item.map((item, i) => {
                        const totalRev = analyticsData.sales.total_revenue || 1;
                        const percentage = (item.revenue / totalRev) * 100;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between">
                              <span className="font-semibold text-text-primary">{item.item_name}</span>
                              <span className="text-text-secondary">
                                {item.quantity_sold} sold · <span className="font-bold text-status-warning">${item.revenue.toFixed(2)}</span>
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-bg-elevated rounded overflow-hidden">
                              <div className="h-full bg-status-warning" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 2: Venue Occupancy Heatmaps */}
              <div className="bg-bg-surface border border-border-subtle rounded-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2">
                  <h3 className="font-bold text-sm text-text-primary flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-accent-primary" />
                    <span>Stadium Occupancy & Densities</span>
                  </h3>
                  <span className="text-xs text-text-secondary font-mono">Crowd Service</span>
                </div>

                {/* Overall Occupancy Indicator */}
                <div className="bg-bg-elevated p-4 border border-border-subtle/40 rounded flex items-center justify-between font-mono">
                  <div>
                    <span className="text-[10px] text-text-secondary block">Consolidated Arena Occupancy</span>
                    <span className="text-xl font-bold text-text-primary">
                      {analyticsData.crowd.total_stadium_occupancy.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-text-secondary block">Occupancy Density</span>
                    <span className={`text-lg font-bold ${
                      averageDensity >= 75 ? 'text-status-critical' : averageDensity >= 40 ? 'text-status-warning' : 'text-status-ok'
                    }`}>
                      {averageDensity.toFixed(1)}% Utilized
                    </span>
                  </div>
                </div>

                {/* Area list with density indicators */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-semibold text-text-secondary uppercase">Sector occupancies</h4>
                  <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
                    {analyticsData.crowd.occupancy_by_area.map((area, i) => {
                      const pct = area.density * 100;
                      return (
                        <div key={i} className="flex justify-between items-center text-xs font-mono py-1 border-b border-border-subtle/30">
                          <span className="font-semibold text-text-primary">{area.area_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-text-secondary">
                              {area.current_count} / {area.capacity}
                            </span>
                            <span className={`font-bold px-1.5 py-0.5 rounded-sm text-[10px] ${
                              pct >= 75 ? 'bg-status-critical/10 text-status-critical' : pct >= 40 ? 'bg-status-warning/10 text-status-warning' : 'bg-status-ok/10 text-status-ok'
                            }`}>
                              {pct.toFixed(0)}% dense
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CARD 3: Staffing Utilization Rates */}
              <div className="bg-bg-surface border border-border-subtle rounded-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2">
                  <h3 className="font-bold text-sm text-text-primary flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-status-ok" />
                    <span>Volunteer Staffing & Task Rates</span>
                  </h3>
                  <span className="text-xs text-text-secondary font-mono">Staff Service</span>
                </div>

                {/* Staff KPI totals */}
                <div className="grid grid-cols-3 gap-4 font-mono text-center">
                  <div className="bg-bg-elevated p-3 border border-border-subtle/40 rounded">
                    <span className="text-[10px] text-text-secondary block">Staff Profile Profiles</span>
                    <span className="text-lg font-bold text-text-primary">{analyticsData.staff.total_volunteers}</span>
                  </div>
                  <div className="bg-bg-elevated p-3 border border-border-subtle/40 rounded">
                    <span className="text-[10px] text-text-secondary block">Active Shifts</span>
                    <span className="text-lg font-bold text-text-primary">{analyticsData.staff.active_shifts}</span>
                  </div>
                  <div className="bg-bg-elevated p-3 border border-border-subtle/40 rounded">
                    <span className="text-[10px] text-text-secondary block">Completion Rate</span>
                    <span className="text-lg font-bold text-status-ok">
                      {(analyticsData.staff.task_completion_rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Task statuses breakdown */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-semibold text-text-secondary uppercase">Operational Task Boards Distributions</h4>
                  <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                    <div className="border border-border-subtle/70 bg-bg-elevated/10 p-3 rounded text-center">
                      <span className="text-text-secondary block text-[10px]">Open Tasks</span>
                      <span className="font-bold text-text-primary text-base">{analyticsData.staff.tasks_by_status.open || 0}</span>
                    </div>
                    <div className="border border-border-subtle/70 bg-bg-elevated/10 p-3 rounded text-center border-l-status-warning">
                      <span className="text-text-secondary block text-[10px]">In-Progress</span>
                      <span className="font-bold text-status-warning text-base">{analyticsData.staff.tasks_by_status["in-progress"] || 0}</span>
                    </div>
                    <div className="border border-border-subtle/70 bg-bg-elevated/10 p-3 rounded text-center border-l-status-ok">
                      <span className="text-text-secondary block text-[10px]">Marked Done</span>
                      <span className="font-bold text-status-ok text-base">{analyticsData.staff.tasks_by_status.done || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 4: Security Incident Analytics */}
              <div className="bg-bg-surface border border-border-subtle rounded-md p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2">
                  <h3 className="font-bold text-sm text-text-primary flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-status-critical" />
                    <span>Incident Severity & Status Frequency</span>
                  </h3>
                  <span className="text-xs text-text-secondary font-mono">Risk Service</span>
                </div>

                {/* Total Incidents Info */}
                <div className="bg-bg-elevated p-4 border border-border-subtle/40 rounded flex items-center justify-between font-mono">
                  <div>
                    <span className="text-[10px] text-text-secondary block">Total Reported Incidents</span>
                    <span className="text-xl font-bold text-text-primary">{analyticsData.incidents.total_incidents}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-text-secondary block">Active Dispatch Issues</span>
                    <span className="text-lg font-bold text-status-critical">
                      {analyticsData.incidents.total_incidents - (analyticsData.incidents.incidents_by_status.resolved || 0)}
                    </span>
                  </div>
                </div>

                {/* Severity levels grid */}
                <div className="grid grid-cols-5 gap-2 pt-2">
                  {Object.entries(analyticsData.incidents.incidents_by_severity).map(([lvl, qty]) => (
                    <div key={lvl} className="border border-border-subtle/50 bg-bg-elevated/20 p-2 rounded text-center font-mono">
                      <span className="text-[9px] text-text-secondary block uppercase">{lvl}</span>
                      <span className={`text-sm font-bold ${
                        lvl === 'critical' || lvl === 'high' ? 'text-status-critical' : lvl === 'medium' ? 'text-status-warning' : 'text-text-primary'
                      }`}>{qty}</span>
                    </div>
                  ))}
                </div>

                {/* Incident resolution status indicators */}
                <div className="flex justify-between items-center text-xs font-mono pt-1 text-text-secondary">
                  <span>Reported: <strong className="text-text-primary">{analyticsData.incidents.incidents_by_status.reported || 0}</strong></span>
                  <span>Assigned: <strong className="text-status-warning">{analyticsData.incidents.incidents_by_status.assigned || 0}</strong></span>
                  <span>Resolved: <strong className="text-status-ok">{analyticsData.incidents.incidents_by_status.resolved || 0}</strong></span>
                </div>

              </div>

            </div>
          )}
        </main>
      )}

      {/* Embedded chat copilot floating bubble */}
      <ChatWidget role="security" />

    </div>
  );
}