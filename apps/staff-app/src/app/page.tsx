'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, CheckCircle2, Play, Bell, AlertCircle, RefreshCw, Sparkles, User, LogOut } from 'lucide-react';
import ChatWidget from '../../../../libs/shared-ui/ChatWidget';


interface StaffProfile {
  id: number;
  user_id: number;
  role_specialty: string;
}

interface Shift {
  id: number;
  staff_id: number;
  start_time: string;
  end_time: string;
  zone: string;
}

interface Task {
  id: number;
  assigned_staff_id: number | null;
  title: string;
  description: string | null;
  status: 'open' | 'in-progress' | 'done';
  created_at: string;
}

export default function StaffAppDashboard() {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Real-time alert notifications banners state
  const [alerts, setAlerts] = useState<string[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);

  const fetchProfileAndSchedules = async () => {
    setIsLoading(true);
    setError(null);
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';

    try {
      // 1. Fetch Staff Profile
      const resProfile = await fetch('/api/v1/staff/profile', {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (!resProfile.ok) throw new Error('Could not retrieve your staff profile registration.');
      const profileData: StaffProfile = await resProfile.json();
      setProfile(profileData);

      // 2. Fetch Shifts for this staff
      const resShifts = await fetch(`/api/v1/staff/shifts?staff_id=${profileData.id}`);
      if (resShifts.ok) {
        const shiftsData = await resShifts.json();
        setShifts(shiftsData);
      }

      // 3. Fetch Tasks for this staff
      const resTasks = await fetch(`/api/v1/staff/tasks?assigned_staff_id=${profileData.id}`);
      if (resTasks.ok) {
        const tasksData = await resTasks.json();
        setTasks(tasksData);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('An error occurred during profile synchronization.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndSchedules();
  }, []);

  // Establish WebSockets channel on profile load
  useEffect(() => {
    if (!profile) return;

    // Connect to WebSocket using host domain
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/staff/ws/${profile.id}`;
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.event === 'backlog_sync') {
          // Sync outstanding tasks from fallback queue
          const backlog: Task[] = msg.data;
          setTasks(prevTasks => {
            // Merge backlog tasks with existing tasks in state
            const taskMap = new Map(prevTasks.map(t => [t.id, t]));
            backlog.forEach(t => taskMap.set(t.id, t));
            return Array.from(taskMap.values());
          });
        }
        
        if (msg.event === 'task_assigned') {
          const newTask: Task = msg.data;
          setTasks(prev => {
            if (prev.some(t => t.id === newTask.id)) return prev;
            return [...prev, newTask];
          });
          triggerAlert(`New Task Allocated: "${newTask.title}"`);
        }

        if (msg.event === 'shift_assigned') {
          const newShift: Shift = msg.data;
          setShifts(prev => {
            if (prev.some(s => s.id === newShift.id)) return prev;
            return [...prev, newShift];
          });
          triggerAlert(`New Shift Scheduled: Zone ${newShift.zone}`);
        }

        if (msg.event === 'task_status_updated') {
          const updated: { id: number; title: string; status: 'open' | 'in-progress' | 'done' } = msg.data;
          setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, status: updated.status } : t));
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    socket.onerror = () => {
      console.warn('WebSocket telemetry connection error. Retrying fallback query sync.');
    };

    return () => {
      socket.close();
    };
  }, [profile]);

  const triggerAlert = (message: string) => {
    setAlerts(prev => [message, ...prev]);
    // Auto dismiss after 5s
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a !== message));
    }, 5000);
  };

  const handleUpdateStatus = async (taskId: number, nextStatus: 'in-progress' | 'done') => {
    setError(null);
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';

    try {
      const res = await fetch(`/api/v1/staff/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'State transition rejected.');
      }

      // Update locally
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to update task status.');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary text-text-primary">
      {/* Notifications Banners */}
      <div className="fixed top-20 right-6 z-50 space-y-2 max-w-sm w-full">
        {alerts.map((alert, index) => (
          <div key={index} className="bg-accent-primary text-white text-xs font-bold px-4 py-3 rounded shadow-2xl flex items-center gap-2 border border-accent-primary/20 animate-slide-in">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>{alert}</span>
          </div>
        ))}
      </div>

      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-bg-surface border-b border-border-subtle sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-accent-primary" />
          <span className="font-bold text-lg tracking-wider text-text-primary">VOLUNTEER PORTAL</span>
          <span className="text-xs font-mono px-2 py-0.5 bg-bg-elevated border border-border-subtle rounded text-text-secondary">
            Staff App
          </span>
        </div>
        <div className="flex items-center gap-6">
          {profile && (
            <div className="flex items-center gap-2 text-xs font-mono text-text-secondary bg-bg-elevated border border-border-subtle px-2 py-1 rounded">
              <User className="w-3.5 h-3.5" />
              <span>ID: #{profile.id} | Specialty: {profile.role_specialty}</span>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
          <div className="flex items-center gap-1 text-ai-accent text-xs font-semibold px-2 py-1 bg-ai-accent/15 border border-ai-accent/30 rounded">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guard Active</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-6 border border-status-critical/30 bg-status-critical/10 text-status-critical rounded p-4 flex items-center justify-between">
          <span className="text-sm font-semibold">{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Main content grid */}
      <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Tasks columns (left 2/3) */}
        <section className="xl:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Allocated Operations Tasks</h2>
              <p className="text-xs text-text-secondary mt-0.5">Strict state lifecycle status tracking (open → in-progress → done)</p>
            </div>
            <button 
              onClick={fetchProfileAndSchedules}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated border border-border-subtle hover:bg-bg-elevated/80 text-xs font-semibold text-text-secondary rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Portal</span>
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-bg-surface border border-border-subtle animate-pulse rounded"></div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="border border-dashed border-border-subtle bg-bg-surface rounded-md p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-status-ok mx-auto mb-4" />
              <h3 className="text-sm font-bold text-text-primary">No Tasks Assigned</h3>
              <p className="text-xs text-text-secondary mt-2">
                Shifts and operations tasks will sync in real time when assigned by administrators.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* OPEN COLUMN */}
              <div className="space-y-4">
                <div className="border-b border-border-subtle pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider text-text-secondary uppercase">Waiting (Open)</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-bg-elevated rounded">{tasks.filter(t => t.status === 'open').length}</span>
                </div>
                <div className="space-y-4">
                  {tasks.filter(t => t.status === 'open').map(task => (
                    <div key={task.id} className="bg-bg-surface border border-border-subtle rounded p-4 space-y-3">
                      <div>
                        <h4 className="font-bold text-sm text-text-primary">{task.title}</h4>
                        {task.description && <p className="text-xs text-text-secondary mt-1">{task.description}</p>}
                      </div>
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'in-progress')}
                        className="w-full py-1.5 bg-accent-primary hover:opacity-90 text-white rounded text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Start Work</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* IN PROGRESS COLUMN */}
              <div className="space-y-4">
                <div className="border-b border-border-subtle pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider text-status-warning uppercase">In Progress</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-bg-elevated rounded text-status-warning">{tasks.filter(t => t.status === 'in-progress').length}</span>
                </div>
                <div className="space-y-4">
                  {tasks.filter(t => t.status === 'in-progress').map(task => (
                    <div key={task.id} className="bg-bg-surface border border-status-warning/20 rounded p-4 space-y-3">
                      <div>
                        <h4 className="font-bold text-sm text-text-primary">{task.title}</h4>
                        {task.description && <p className="text-xs text-text-secondary mt-1">{task.description}</p>}
                      </div>
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'done')}
                        className="w-full py-1.5 bg-status-ok hover:opacity-90 text-white rounded text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Completed</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* DONE COLUMN */}
              <div className="space-y-4">
                <div className="border-b border-border-subtle pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider text-status-ok uppercase">Done (Completed)</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-bg-elevated rounded text-status-ok">{tasks.filter(t => t.status === 'done').length}</span>
                </div>
                <div className="space-y-4">
                  {tasks.filter(t => t.status === 'done').map(task => (
                    <div key={task.id} className="bg-bg-surface border border-status-ok/25 rounded p-4 opacity-75">
                      <h4 className="font-semibold text-sm text-text-secondary line-through">{task.title}</h4>
                      {task.description && <p className="text-xs text-text-secondary/60 mt-1 line-through">{task.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Shifts column (right 1/3) */}
        <section className="bg-bg-surface border border-border-subtle rounded-md p-6 space-y-6 h-fit">
          <div>
            <h3 className="text-base font-bold text-text-primary">My Shift Rosters</h3>
            <p className="text-xs text-text-secondary mt-0.5">Assigned sector deployments</p>
          </div>

          {isLoading ? (
            <div className="h-24 bg-bg-elevated border border-border-subtle animate-pulse rounded"></div>
          ) : shifts.length === 0 ? (
            <div className="border border-dashed border-border-subtle rounded p-6 text-center">
              <Calendar className="w-8 h-8 text-text-secondary mx-auto mb-2" />
              <p className="text-xs text-text-secondary">No scheduled shifts allocated.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shifts.map(shift => (
                <div key={shift.id} className="bg-bg-elevated p-4 border border-border-subtle rounded space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Roster Zone:</span>
                    <span className="text-text-primary font-bold px-2 py-0.5 bg-bg-surface border border-border-subtle rounded">
                      {shift.zone}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Start Time:</span>
                    <span className="text-text-primary">{new Date(shift.start_time).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">End Time:</span>
                    <span className="text-text-primary">{new Date(shift.end_time).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ChatWidget role="staff" />
    </div>
  );
}