import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, FolderOpen, Plus, Trash2, Clock, Zap, FileVideo, AlertTriangle, CheckCircle2, XCircle, Loader2, Coffee, RotateCcw, Edit3, Save, X, Info, ChevronDown, ChevronUp, Timer, Layers, Target, Activity, RefreshCw, BarChart3, Search } from 'lucide-react';

const API = '/api/autopilot';

// Helper for time math (outputs 12-hr format for UI readability)
const addMinsToHM = (hm, addMins) => {
  if (!hm || typeof hm !== 'string') return '';
  let parts = hm.split(':');
  if (parts.length !== 2) return '';
  let [h, m] = parts.map(Number);
  m += addMins;
  h += Math.floor(m / 60);
  h = h % 24;
  m = m % 60;
  
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

const format12h = (hm) => {
  if (!hm || typeof hm !== 'string') return '--:--';
  const parts = hm.split(':');
  if (parts.length !== 2) return hm;
  let [h, m] = parts.map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

const getUsaTimeFromHM = (hm, serverTz) => {
  if (!hm || !serverTz) return '';
  try {
    const [h, m] = hm.split(':').map(Number);
    const now = new Date();
    const sTzTime = new Date(now.toLocaleString('en-US', { timeZone: serverTz }));
    const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const diffMs = nyTime.getTime() - sTzTime.getTime();
    
    const targetDate = new Date();
    targetDate.setHours(h, m, 0, 0);
    const usaDate = new Date(targetDate.getTime() + diffMs);
    
    const usaH = usaDate.getHours();
    const usaM = usaDate.getMinutes();
    const ampm = usaH >= 12 ? 'PM' : 'AM';
    let h12 = usaH % 12;
    if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, '0')}:${String(usaM).padStart(2, '0')} ${ampm} EST`;
  } catch(e) { return '' }
};

export default function AutoPilot() {
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState({});
  const [logs, setLogs] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [expandedLog, setExpandedLog] = useState(true);
  const logBoxRef = useRef(null);
  const [pageStats, setPageStats] = useState({});
  const [pages, setPages] = useState([]);
  const [gapCountdown, setGapCountdown] = useState(null);

  // Live countdown for resting state between page posts
  useEffect(() => {
    if (status.status !== 'resting' || !status.nextPostAt) {
      setGapCountdown(null);
      return;
    }
    const interval = setInterval(() => {
      const ms = status.nextPostAt - Date.now();
      if (ms <= 0) {
        setGapCountdown('00:00');
        clearInterval(interval);
      } else {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const secs = (totalSecs % 60).toString().padStart(2, '0');
        setGapCountdown(`${mins}:${secs}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status.status, status.nextPostAt]);

  const [errorMsg, setErrorMsg] = useState(null);
  const [firstPostDelay, setFirstPostDelay] = useState(10); // minutes before first post after start
  const [showDelayOption, setShowDelayOption] = useState(null); // taskId showing delay options

  // New task form focused on Custom Phases
  const [form, setForm] = useState({
    name: '', folder_path: '', custom_times: ['10:00', '20:00'], gap_minutes: 7, gap_max: 15
  });

  const fetchAll = async () => {
    try {
      const [tasksRes, statusRes, logsRes, statsRes, pagesRes] = await Promise.all([
        fetch(`${API}/tasks`).then(r => r.json()),
        fetch(`${API}/status`).then(r => r.json()),
        fetch(`${API}/logs?limit=50`).then(r => r.json()),
        fetch(`/api/autopilot/page-stats`).then(r => r.json()),
        fetch(`/api/pages`).then(r => r.json())
      ]);
      if (tasksRes.tasks) setTasks(tasksRes.tasks);
      setStatus(statusRes);
      if (logsRes.logs) setLogs(logsRes.logs);
      if (statsRes.stats) setPageStats(statsRes.stats);
      if (pagesRes.pages) setPages(pagesRes.pages);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 3000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScan = async () => {
    if (!form.folder_path) return alert('Please enter a folder path first.');
    try {
      const res = await fetch(`${API}/scan-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: form.folder_path })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else alert(`Scanned successfully! Found ${data.count} videos ready to post.`);
    } catch (e) { alert('Could not scan folder.'); }
  };

  const handleBrowse = async () => {
    try {
      const res = await fetch('/api/browse');
      const data = await res.json();
      if (data.path) {
        setForm(f => ({ ...f, folder_path: data.path }));
      }
    } catch (e) {
      console.error('Failed to browse', e);
    }
  };

  const handleCreateTask = async () => {
    setErrorMsg(null);
    if (!form.name || !form.folder_path) return setErrorMsg('Name and folder path are required!');
    if (!form.custom_times || form.custom_times.length === 0) return setErrorMsg('You must have at least one Phase Time.');
    
    try {
      const res = await fetch(`${API}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreate(false);
      setForm({ name: '', folder_path: '', custom_times: ['10:00', '20:00'], gap_minutes: 7, gap_max: 15 });
      fetchAll();
    } catch (e) { setErrorMsg(e.message); }
  };

  const handleUpdateTask = async (task) => {
    try {
      await fetch(`${API}/tasks/${task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      setEditingTask(null);
      fetchAll();
    } catch (e) { setErrorMsg('Update failed: ' + e.message); }
  };

  const handleDeleteTask = async (id) => {
    try {
      await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (e) { console.error('Delete failed', e); }
  };

  const handleStart = async (taskId, useDelay = false) => {
    setErrorMsg(null);
    setShowDelayOption(null);
    try {
      const res = await fetch(`${API}/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, first_post_delay: useDelay ? firstPostDelay : 0 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchAll();
    } catch (e) { setErrorMsg(e.message); }
  };

  // Calculate countdown to next phase from server localTime
  const getNextPhaseCountdown = () => {
    if (!status.isRunning || !status.customTimes || !status.localTime) return null;
    try {
      const times = JSON.parse(status.customTimes);
      const [nowH, nowM] = status.localTime.split(':').map(Number);
      const nowMins = nowH * 60 + nowM;
      let closest = Infinity;
      let closestTime = '';
      for (const t of times) {
        const [h, m] = t.split(':').map(Number);
        let diff = (h * 60 + m) - nowMins;
        if (diff <= 0) diff += 1440;
        if (diff < closest) { closest = diff; closestTime = t; }
      }
      if (closest === Infinity) return null;
      const hrs = Math.floor(closest / 60);
      const mins = closest % 60;
      return { time: closestTime, countdown: hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`, totalMins: closest };
    } catch (e) { return null; }
  };

  const handleStop = async () => {
    await fetch(`${API}/stop`, { method: 'POST' });
    fetchAll();
  };

  const handleClearLogs = async () => {
    await fetch(`${API}/logs`, { method: 'DELETE' });
    fetchAll();
  };

  const isRunning = status.isRunning;

  const statusMap = {
    idle:      { color: '#64748b', glow: 'rgba(100,116,139,0.15)', label: 'IDLE', icon: <Clock size={18} />, desc: 'Waiting for a task to start' },
    running:   { color: '#6366f1', glow: 'rgba(99,102,241,0.2)',   label: 'RUNNING', icon: <Zap size={18} />, desc: 'Engine is active' },
    posting:   { color: '#f59e0b', glow: 'rgba(245,158,11,0.2)',   label: 'POSTING', icon: <Loader2 size={18} className="spin" />, desc: 'Uploading reel to page' },
    resting:   { color: '#3b82f6', glow: 'rgba(59,130,246,0.2)',   label: 'RESTING', icon: <Timer size={18} />, desc: 'Waiting for next page' },
    waiting:   { color: '#8b5cf6', glow: 'rgba(139,92,246,0.2)',   label: 'WAITING PHASE', icon: <Coffee size={18} />, desc: 'Waiting for next scheduled Custom Phase' },
    completed: { color: '#10b981', glow: 'rgba(16,185,129,0.2)',   label: 'COMPLETED', icon: <CheckCircle2 size={18} />, desc: 'All rounds finished' },
    stopped:   { color: '#ef4444', glow: 'rgba(239,68,68,0.2)',    label: 'STOPPED', icon: <XCircle size={18} />, desc: 'Manually stopped' },
  };
  
  const st = statusMap[status.status] || statusMap.idle;

  const progressPercent = status.totalPages > 0
    ? Math.round((status.currentPageIndex / status.totalPages) * 100)
    : 0;

  const successCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const totalPosts = successCount + failedCount;
  const successRate = totalPosts > 0 ? Math.round((successCount / totalPosts) * 100) : 0;

  return (
    <div className="content-wrapper ap-wrapper">
      <div className="ap-header">
        <div>
          <h1 className="ap-title"><Zap size={24} style={{ color: 'var(--blue-accent)' }} /> <span>VPS</span> AutoPilot 01</h1>
          <p className="ap-subtitle">Fully autonomous daily phase scheduling. Set your custom times and relax.</p>
          {status.serverInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', width: 'fit-content' }}>
              <span style={{ fontSize: '1.2rem' }}>{status.serverInfo.flag}</span>
              <strong style={{ color: 'var(--text-main)' }}>{status.serverInfo.ip}</strong>
              <span>({status.serverInfo.location})</span>
            </div>
          )}
        </div>
        {!isRunning && (
          <button className="ap-btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close Form' : <><Plus size={16} /> New Task</>}
          </button>
        )}
      </div>

      {/* ═══ TOP STATS CARDS ═══ */}
      <div className="ap-top-stats">
        <div className="ap-top-stat-card">
          <div className="ap-top-stat-num" style={{color: '#6366f1'}}>{totalPosts}</div>
          <div className="ap-top-stat-label">TOTAL POSTS</div>
        </div>
        <div className="ap-top-stat-card">
          <div className="ap-top-stat-num" style={{color: '#10b981'}}>{successCount}</div>
          <div className="ap-top-stat-label">SUCCESSFUL</div>
        </div>
        <div className="ap-top-stat-card">
          <div className="ap-top-stat-num" style={{color: '#8b5cf6'}}>{logs.length}</div>
          <div className="ap-top-stat-label">TODAY</div>
        </div>
        <div className="ap-top-stat-card">
          <div className="ap-top-stat-num" style={{color: failedCount > 0 ? '#f43f5e' : '#10b981'}}>{successRate}%</div>
          <div className="ap-top-stat-label">SUCCESS RATE</div>
        </div>
      </div>

      <div className="ap-layout">
        {/* ═══ LIVE ENGINE STATUS STATUS ═══ */}
        <div className="ap-engine-card">
          <div className="ap-engine-glow" style={{ background: st.glow }}></div>
          <div className="ap-engine-inner">
            <div className="ap-engine-top">
              <div>
                <div className="ap-status-badge" style={{ color: st.color }}>
                  {st.icon} {st.label}
                </div>
                {isRunning && status.taskName && (
                  <div className="ap-active-task-name">Working on: <strong>{status.taskName}</strong></div>
                )}
              </div>
              <div>
                <div className="ap-stats-mini">
                  <Target size={14}/> {successCount} Success <div className="ap-divider"></div> <AlertTriangle size={14}/> {failedCount} Failed
                </div>
              </div>
            </div>

            {isRunning ? (
              <div className="ap-engine-body">
                {status.status === 'posting' || status.status === 'resting' ? (
                  <>
                    {/* ── LIVE ENGINE VIEW ── */}
                    <div className="ap-timeline-box">
                      <div className="ap-step">
                        <div className="ap-step-label">Status:</div>
                        <div className="ap-step-val" style={{color: status.status === 'posting' ? '#f59e0b' : '#3b82f6', fontWeight: 600}}>
                          {status.status === 'posting' ? '🔴 LIVE POSTING' : '⏸️ GAP DELAY'}
                        </div>
                      </div>
                      <div className="ap-step">
                        <div className="ap-step-label">Page Progress:</div>
                        <div className="ap-step-val">{status.currentPageIndex} / {status.totalPages || '?'}</div>
                      </div>
                      <div className="ap-step">
                        <div className="ap-step-label">Videos Left:</div>
                        <div className="ap-step-val">{status.videosRemaining} videos</div>
                      </div>
                    </div>

                    {status.status === 'resting' && gapCountdown && (
                      <div style={{ marginTop: '20px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                         <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Waiting Time Counting</div>
                         <div style={{ fontSize: '3rem', fontWeight: 800, color: '#3b82f6', letterSpacing: '3px', fontFamily: 'monospace' }}>{gapCountdown}</div>
                         {status.nextPageName && (
                           <div style={{ marginTop: '12px', fontSize: '0.95rem', color: 'var(--text-main)' }}>Next Page Waiting List: <strong style={{color: '#6366f1'}}>{status.nextPageName}</strong></div>
                         )}
                      </div>
                    )}

                    {status.status === 'posting' && (
                      <div className="ap-progress-area">
                        <div className="ap-progress-meta">
                          <span>{status.currentPageName || 'Preparing...'}</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="ap-progress-bar">
                          <div className="ap-progress-fill" style={{ width: `${progressPercent}%`, background: '#f59e0b' }}></div>
                        </div>
                        {status.currentVideoName && (
                          <div className="ap-current-video">
                            <Zap size={12} color="var(--warning)"/> Uploading: <span>{status.currentVideoName}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* ── WAITING VIEW — Show schedule info ── */}
                    <div className="ap-timeline-box">
                      <div className="ap-step">
                        <div className="ap-step-label">Status:</div>
                        <div className="ap-step-val" style={{color: '#8b5cf6'}}>⏳ Waiting for Phase Time</div>
                      </div>
                      <div className="ap-step">
                        <div className="ap-step-label">System Local Time:</div>
                        <div className="ap-step-val" style={{color: '#10b981', fontWeight: 600, fontFamily: 'monospace', fontSize: '1rem'}}>
                          🕐 {format12h(status.localTime)}
                        </div>
                      </div>
                      <div className="ap-step">
                        <div className="ap-step-label">Connected Pages:</div>
                        <div className="ap-step-val">{status.totalPages || status.connectedPages || 0}</div>
                      </div>
                      <div className="ap-step">
                        <div className="ap-step-label">Videos Ready:</div>
                        <div className="ap-step-val">{status.videosRemaining} videos</div>
                      </div>
                      {(() => {
                        const next = getNextPhaseCountdown();
                        return next ? (
                          <div className="ap-step">
                            <div className="ap-step-label">Next Phase:</div>
                            <div className="ap-step-val" style={{color: '#f59e0b', fontWeight: 600}}>
                              ⏱️ {format12h(next.time)} (in {next.countdown})
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    <div style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8, padding: '16px 20px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                        <Coffee size={14} style={{verticalAlign: 'middle', marginRight: 6}} />
                        Engine is armed and sleeping. Posts will start automatically at the next scheduled phase time.
                      </div>
                      {status.firstPostAt && (
                        <div style={{ fontSize: '0.85rem', color: '#10b981', marginBottom: 8, fontWeight: 600 }}>
                          🚀 First post scheduled at: {status.firstPostAt}
                        </div>
                      )}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {status.currentPageIndex > 0 
                          ? `📌 Will resume from page ${status.currentPageIndex + 1} (${status.currentPageIndex} already posted)`
                          : '📌 Will start fresh from page 1'
                        }
                      </div>
                    </div>
                  </>
                )}

                <div className="ap-engine-controls">
                  <button className="ap-stop-btn hoverable" onClick={handleStop}><Square size={16} /> Stop Engine</button>
                </div>
              </div>
            ) : (
              <div className="ap-engine-body empty">
                <Coffee size={32} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.5 }} />
                <h3>Engine is sleeping</h3>
                <p>Select a task from below and click Start to begin automation.</p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ CREATE NEW TASK ═══ */}
        {showCreate && !isRunning && (
          <div className="ap-create-box">
            <h2 className="ap-section-title"><Layers size={20} /> Create Daily AutoPilot Task</h2>
            {errorMsg && <div className="ap-alert err"><AlertTriangle size={16} /> {errorMsg}</div>}
            
            <div className="ap-form-grid" style={{ marginTop: 24 }}>
              <div className="ap-field">
                <label>Task Name</label>
                <div className="digital-input-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <input type="text" className="digital-number" style={{ color: 'var(--text-main)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', textAlign: 'left' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mexico 2026" />
                </div>
                <span className="ap-field-tip">A friendly name to identify this task</span>
              </div>
              <div className="ap-field span-2">
                <label>Video Folder Path</label>
                <div className="ap-field-row" style={{ display: 'flex', gap: '8px' }}>
                  <div className="digital-input-wrap" style={{ flex: 1, background: 'rgba(255,255,255,0.02)' }}>
                    <input type="text" className="digital-number" style={{ color: 'var(--text-main)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', textAlign: 'left', width: '100%', border: 'none', background: 'transparent', outline: 'none' }} value={form.folder_path} onChange={e => setForm(f => ({ ...f, folder_path: e.target.value }))} placeholder="/root/Videos/MyReels" />
                  </div>
                  <button type="button" className="ap-browse-btn" onClick={handleBrowse} style={{ height: 42, padding: '0 16px', background: 'var(--bg-hover)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                    <FolderOpen size={14} /> Browse PC
                  </button>
                  <button type="button" className="ap-browse-btn" onClick={handleScan} style={{ height: 42, padding: '0 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                    <Search size={14} /> Scan
                  </button>
                </div>
                <span className="ap-field-tip">Type path manually for Linux, or use "Browse PC" on Windows.</span>
              </div>

              <div className="ap-field">
                <label>Gap Time (Random Range)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div className="digital-input-wrap" style={{ flex: 1 }}>
                    <input type="number" className="digital-number" value={form.gap_minutes} onChange={e => { const v = e.target.value === '' ? '' : Math.max(parseInt(e.target.value) || 7, 7); setForm(f => ({ ...f, gap_minutes: v })); }} min={7} max={120} />
                    <span className="digital-unit">MIN</span>
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>~</span>
                  <div className="digital-input-wrap" style={{ flex: 1 }}>
                    <input type="number" className="digital-number" value={form.gap_max} onChange={e => { const v = e.target.value === '' ? '' : Math.max(parseInt(e.target.value) || 7, parseInt(form.gap_minutes) || 7); setForm(f => ({ ...f, gap_max: v })); }} min={form.gap_minutes || 7} max={120} />
                    <span className="digital-unit">MAX</span>
                  </div>
                </div>
                <span className="ap-field-tip" style={{color: 'var(--warning)'}}>Random {form.gap_minutes || 7}-{form.gap_max || 15} min gap per page (min 7 locked)</span>
              </div>

              <div className="ap-field span-3">
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Daily Custom Phases</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' , gap: '20px' }}>
                  {form.custom_times.map((ct, idx) => {
                    const dur = (status.connectedPages || 0) * (parseInt(form.gap_max) || parseInt(form.gap_minutes) || 0);
                    const minSafeText = idx === 0 ? '' : `SAFE LIMIT: ${addMinsToHM(form.custom_times[idx-1], dur)}`;
                    return (
                        <div className="ap-field" key={idx} style={{marginBottom: 0}}>
                            <label style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                              <span>Phase {idx + 1} Time {idx > 0 && <span style={{fontSize: '0.7rem', color:'var(--success)', marginLeft: 8}}>{minSafeText}</span>}</span>
                              {form.custom_times.length > 1 && (
                                <button onClick={() => { const newT = [...form.custom_times]; newT.splice(idx, 1); setForm(f => ({...f, custom_times: newT})); }} type="button" className="ap-icon-btn danger" style={{height: 24, width: 24, minWidth: 24, padding: 0, fontSize: '0.7rem'}}><Trash2 size={12}/></button>
                              )}
                            </label>
                            <div className="digital-input-wrap">
                                <input type="time" className="digital-number" style={{letterSpacing: '1px', fontSize: '1rem'}} value={ct} onChange={e => {
                                    const newT = [...form.custom_times];
                                    newT[idx] = e.target.value;
                                    setForm(f => ({...f, custom_times: newT}));
                                }} />
                            </div>
                        </div>
                    )
                  })}
                  <div className="ap-field" style={{display: 'flex', gap: 10, alignItems: 'center', marginTop: '22px'}}>
                    <button onClick={() => setForm(f => ({...f, custom_times: [...f.custom_times, '00:00']}))} type="button" className="ap-submit-btn" style={{padding: '0 15px', height: 42, flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)'}}>+ Add Phase</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="ap-form-bottom" style={{marginTop: 20}}>
              <button className="ap-submit-btn" onClick={handleCreateTask}>
                <Zap size={16} /> Create Schedule Task
              </button>
            </div>
          </div>
        )}

        {/* TASK CARDS */}
        {tasks.length === 0 && !showCreate && (
          <div className="ap-empty">
            <FileVideo size={32} />
            <div>No tasks yet</div>
            <span>Click "New Task" above to create your first posting schedule</span>
          </div>
        )}

        <div className="ap-tasks-list">
          {tasks.map(task => (
            <div key={task.id} className={`ap-task-item ${isRunning && status.taskId === task.id ? 'active' : ''}`}>
              {editingTask === task.id ? (
                <EditTaskForm task={task} onSave={handleUpdateTask} onCancel={() => setEditingTask(null)} connectedPages={status.connectedPages} />
              ) : (
                <>
                  <div className="ap-task-top">
                    <div className="ap-task-info">
                      <div className="ap-task-name-row">
                        <span className="ap-task-name">{task.name}</span>
                        {isRunning && status.taskId === task.id && (
                          <span className="ap-badge-running">● LIVE</span>
                        )}
                      </div>
                      <div className="ap-task-path">
                        <FolderOpen size={11} /> {task.folder_path}
                      </div>
                    </div>
                    <div className="ap-task-actions">
                      {!isRunning && (
                        <>
                          {showDelayOption === task.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', background: 'var(--bg-hover)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                <span style={{fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600}}>Start Options</span>
                                <button className="ap-icon-btn" onClick={() => setShowDelayOption(null)} style={{ height: 24, width: 24, border: 'none' }}><X size={12} /></button>
                              </div>
                              <button className="ap-start-btn" onClick={() => handleStart(task.id, false)} style={{ fontSize: '0.8rem', padding: '6px 12px', width: '100%', justifyContent: 'center' }}>
                                <Play size={12} /> Start Immediately
                              </button>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between', marginTop: 4 }}>
                                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Delay first post by:</span>
                                <div style={{display: 'flex', alignItems: 'center'}}>
                                   <input type="number" min={1} max={120} value={firstPostDelay} onChange={e => setFirstPostDelay(parseInt(e.target.value) || 10)} style={{ width: 40, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem', padding: '2px' }} />
                                   <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginLeft: 4 }}>min</span>
                                </div>
                              </div>
                              <button className="ap-start-btn" onClick={() => handleStart(task.id, true)} style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'rgba(16,185,129,0.15)', color: '#10b981', width: '100%', justifyContent: 'center' }}>
                                <Timer size={12} /> Start with Delay
                              </button>
                            </div>
                          ) : (
                            <button className="ap-start-btn" onClick={() => setShowDelayOption(task.id)}>
                              <Play size={13} /> Start
                            </button>
                          )}
                        </>
                      )}
                      <button className="ap-icon-btn" onClick={() => setEditingTask(task.id)}><Edit3 size={13} /></button>
                      <button className="ap-icon-btn danger" onClick={() => handleDeleteTask(task.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="ap-task-tags">
                    <span className="ap-tag">⏱️ {task.gap_minutes}min gap</span>
                    <span className={`ap-tag ${task.folder_missing ? 'err' : 'ok'}`}>
                      📁 {task.folder_missing ? 'MISSING' : `${task.video_count} videos left`}
                    </span>
                  </div>
                  <div className="ap-task-tags" style={{marginTop: 12, display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    {(() => {
                        let parsed = [];
                        try { parsed = JSON.parse(task.custom_times || '[]'); }catch(e){}
                        return parsed.map((t, idx) => (
                           <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                             <span className="ap-tag" style={{background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', margin: 0}}>
                               📍 Phase {idx+1}: {format12h(t)}
                             </span>
                             <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 500, letterSpacing: '0.5px' }}>
                               🇺🇸 {getUsaTimeFromHM(t, status.serverInfo?.timezone)}
                             </span>
                           </div>
                        ))
                    })()}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ LIVE ACTIVITY LOG ═══ */}
      <div className="ap-section">
        <div className="ap-section-header">
          <div>
            <h2 className="ap-section-title" style={{ cursor: 'pointer' }} onClick={() => setExpandedLog(!expandedLog)}>
              Activity Log
              {expandedLog ? <ChevronUp size={16} style={{ marginLeft: 8, verticalAlign: 'middle' }} /> : <ChevronDown size={16} style={{ marginLeft: 8, verticalAlign: 'middle' }} />}
            </h2>
            <p className="ap-section-desc">Real-time feed of every post action across daily phases.</p>
          </div>
          <button className="ap-icon-btn danger" onClick={handleClearLogs} style={{ fontSize: '0.78rem', gap: 4, display: 'flex', alignItems: 'center' }}>
            <Trash2 size={12} /> Clear
          </button>
        </div>

        {expandedLog && (
          <div className="ap-log-box" ref={logBoxRef}>
            {logs.length === 0 && (
              <div className="ap-empty small">
                <Activity size={24} />
                <span>No activity yet. Start a task to see live logs here.</span>
              </div>
            )}

            {logs.slice().reverse().map((log, i) => (
              <div key={log.id || i} className={`ap-log-entry ${log.status}`}>
                <div className="ap-log-time">
                  {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="ap-log-icon">
                  {log.status === 'success' ? <CheckCircle2 size={13} /> :
                    log.status === 'failed' ? <XCircle size={13} /> :
                      <AlertTriangle size={13} />}
                </div>
                <div className="ap-log-detail">
                  <span className="ap-log-video">{log.video_name}</span>
                  <span className="ap-log-arrow">→</span>
                  <span className="ap-log-page">{log.page_name}</span>
                  {log.error_msg && <span className="ap-log-err">({log.error_msg})</span>}
                </div>
                <div className="ap-log-round">Phase {log.round}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ PER-PAGE STATS TABLE ═══ */}
      {pages.length > 0 && (
        <div className="ap-section">
          <div className="ap-section-header">
            <div>
              <h2 className="ap-section-title"><BarChart3 size={16} style={{marginRight: 6}}/> Per-Page Stats</h2>
              <p className="ap-section-desc">Posting performance breakdown for each connected Facebook page.</p>
            </div>
            <button className="ap-icon-btn" onClick={fetchAll} style={{ fontSize: '0.78rem', gap: 4, display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={12}/> Refresh
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="pps-table">
              <thead>
                <tr>
                  <th style={{textAlign: 'left'}}>PAGE NAME</th>
                  <th>TOTAL</th>
                  <th>SUCCESS</th>
                  <th>FAILED</th>
                  <th>LAST POST</th>
                  <th>LAST FAILED</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(p => {
                  const s = pageStats[p.id] || {};
                  const total = (s.total_posts || 0);
                  const success = (s.total_success || 0);
                  const failed = (s.total_failed || 0);
                  const lastPost = s.last_post_time ? new Date(s.last_post_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '\u2014';
                  const lastFailed = s.last_failed_time ? new Date(s.last_failed_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '\u2014';
                  return (
                    <tr key={p.id}>
                      <td style={{textAlign: 'left', fontWeight: 600, color: 'var(--text-main)'}}>{'\u2022'} {p.name}</td>
                      <td><span className="pps-badge total">{total}</span></td>
                      <td><span className="pps-badge success">{success}</span></td>
                      <td><span className="pps-badge failed">{failed}</span></td>
                      <td style={{color: 'var(--text-muted)'}}>{lastPost}</td>
                      <td style={{color: failed > 0 ? '#f43f5e' : 'var(--text-dim)'}}>{lastFailed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline Edit Form Component ──
function EditTaskForm({ task, onSave, onCancel, connectedPages }) {
  const [t, setT] = useState({ 
     ...task, 
     custom_times: Array.isArray(task.custom_times) ? task.custom_times : JSON.parse(task.custom_times || '["10:00"]')
  });

  const handleEditScan = async () => {
    if (!t.folder_path) return alert('Please enter a folder path first.');
    try {
      const res = await fetch(`/api/autopilot/scan-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: t.folder_path })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else alert(`Scanned successfully! Found ${data.count} videos ready to post.`);
    } catch (e) { alert('Could not scan folder.'); }
  };

  return (
    <div className="ap-edit-inline">
      <div className="ap-form-grid compact">
        <div className="ap-field">
          <label>Name</label>
          <div className="digital-input-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <input type="text" className="digital-number" style={{ color: 'var(--text-main)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', textAlign: 'left' }} value={t.name} onChange={e => setT(x => ({ ...x, name: e.target.value }))} />
          </div>
        </div>
        <div className="ap-field span-2">
          <label>Folder Path</label>
          <div className="ap-field-row">
            <div className="digital-input-wrap" style={{ flex: 1, background: 'rgba(255,255,255,0.02)' }}>
              <input type="text" className="digital-number" style={{ color: 'var(--text-main)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', textAlign: 'left' }} value={t.folder_path} onChange={e => setT(x => ({ ...x, folder_path: e.target.value }))} placeholder="/root/Videos/MyReels" />
            </div>
            <button className="ap-browse-btn" onClick={handleEditScan} style={{ height: 42 }}>
              <FolderOpen size={14} /> Scan
            </button>
          </div>
        </div>
        <div className="ap-field"><label>Gap Range <span style={{fontSize: '0.65rem', color: 'var(--warning)'}}>min 7</span></label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div className="digital-input-wrap" style={{ flex: 1 }}>
              <input type="number" className="digital-number" value={t.gap_minutes} onChange={e => { const v = e.target.value === '' ? '' : Math.max(parseInt(e.target.value) || 7, 7); setT(x => ({ ...x, gap_minutes: v })); }} min={7} max={120} />
              <span className="digital-unit">MIN</span>
            </div>
            <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>~</span>
            <div className="digital-input-wrap" style={{ flex: 1 }}>
              <input type="number" className="digital-number" value={t.gap_max || 15} onChange={e => { const v = e.target.value === '' ? '' : Math.max(parseInt(e.target.value) || 7, parseInt(t.gap_minutes) || 7); setT(x => ({ ...x, gap_max: v })); }} min={t.gap_minutes || 7} max={120} />
              <span className="digital-unit">MAX</span>
            </div>
          </div>
        </div>
        
        <div className="ap-field span-3">
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Daily Custom Phases</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' , gap: '20px' }}>
            {t.custom_times.map((ct, idx) => {
              const dur = (connectedPages || 0) * (parseInt(t.gap_max) || parseInt(t.gap_minutes) || 0);
              const minSafeText = idx === 0 ? '' : `SAFE LIMIT: ${addMinsToHM(t.custom_times[idx-1], dur)}`;
              return (
                  <div className="ap-field" key={idx} style={{marginBottom: 0}}>
                      <label style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                        <span>Phase {idx + 1} Time {idx > 0 && <span style={{fontSize: '0.7rem', color:'var(--success)', marginLeft: 8}}>{minSafeText}</span>}</span>
                        {t.custom_times.length > 1 && (
                          <button type="button" onClick={() => { const newT = [...t.custom_times]; newT.splice(idx, 1); setT(f => ({...f, custom_times: newT})); }} className="ap-icon-btn danger" style={{height: 24, width: 24, minWidth: 24, padding: 0}}><Trash2 size={12}/></button>
                        )}
                      </label>
                      <div className="digital-input-wrap">
                          <input type="time" className="digital-number" style={{letterSpacing: '1px', fontSize: '1rem'}} value={ct} onChange={e => {
                              const newT = [...t.custom_times];
                              newT[idx] = e.target.value;
                              setT(f => ({...f, custom_times: newT}));
                          }} />
                      </div>
                  </div>
              )
            })}
            <div className="ap-field" style={{display: 'flex', gap: 10, alignItems: 'center', marginTop: '22px'}}>
              <button type="button" onClick={() => setT(f => ({...f, custom_times: [...f.custom_times, '00:00']}))} className="ap-submit-btn" style={{padding: '0 15px', height: 42, flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)'}}>+ Add</button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="ap-start-btn" onClick={() => onSave(t)}><Save size={13} /> Save</button>
        <button className="ap-icon-btn" onClick={onCancel}><X size={13} /> Cancel</button>
      </div>
    </div>
  );
}
