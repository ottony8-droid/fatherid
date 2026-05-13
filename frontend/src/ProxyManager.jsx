import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, Check, X, RefreshCw, Wifi, WifiOff, Globe, AlertTriangle, Edit3, Save, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = '/api';

export default function ProxyManager({ pages }) {
  const [proxies, setProxies] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [editingProxy, setEditingProxy] = useState(null);
  const [assignProxy, setAssignProxy] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [form, setForm] = useState({ name: '', type: 'socks5', host: '', port: '', username: '', password: '' });

  const fetchProxies = async () => {
    try {
      const res = await fetch(`${API_URL}/proxies`);
      const data = await res.json();
      if (data.proxies) setProxies(data.proxies);
    } catch (e) {}
  };

  const fetchMappings = async () => {
    try {
      const res = await fetch(`${API_URL}/proxies/mappings`);
      const data = await res.json();
      if (data.mappings) setMappings(data.mappings);
    } catch (e) {}
  };

  useEffect(() => { fetchProxies(); fetchMappings(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.host || !form.port) return alert('Name, Host, and Port are required.');
    try {
      const res = await fetch(`${API_URL}/proxies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setForm({ name: '', type: 'socks5', host: '', port: '', username: '', password: '' });
        setShowAdd(false);
        fetchProxies();
      } else alert(data.error);
    } catch (e) { alert('Failed to add proxy.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this proxy?')) return;
    try {
      await fetch(`${API_URL}/proxies/${id}`, { method: 'DELETE' });
      fetchProxies(); fetchMappings();
    } catch (e) {}
  };

  const handleTest = async (proxy) => {
    setTesting(proxy.id);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/proxies/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: proxy.type, host: proxy.host, port: proxy.port, username: proxy.username, password: proxy.password })
      });
      const data = await res.json();
      setTestResult({ id: proxy.id, ...data });
    } catch (e) { setTestResult({ id: proxy.id, success: false, error: e.message }); }
    setTesting(null);
  };

  const handleAssign = async () => {
    if (!assignProxy) return;
    try {
      const res = await fetch(`${API_URL}/proxies/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy_id: assignProxy, page_ids: selectedPages })
      });
      const data = await res.json();
      if (data.success) {
        setAssignProxy(null); setSelectedPages([]);
        fetchMappings();
        alert(`Proxy assigned to ${selectedPages.length} page(s).`);
      }
    } catch (e) { alert('Failed to assign proxy.'); }
  };

  const getPageProxy = (pageId) => mappings.find(m => m.page_id === pageId);

  const togglePage = (pageId) => {
    setSelectedPages(prev => prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]);
  };

  return (
    <div className="content-wrapper" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #f59e0b 30%, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 6 }}>
            <Shield size={22} style={{ color: '#f59e0b', verticalAlign: 'middle', marginRight: 8 }} />
            Proxy Manager
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', maxWidth: 500 }}>
            Configure proxies (SOCKS5, SOCKS4, HTTP/HTTPS) and assign them to specific Facebook pages for safe content distribution.
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="ap-btn-primary" style={{ background: showAdd ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)', borderColor: showAdd ? 'rgba(244,63,94,0.3)' : 'rgba(245,158,11,0.3)', color: showAdd ? '#f43f5e' : '#f59e0b' }}>
          {showAdd ? <><X size={14} /> Close</> : <><Plus size={14} /> Add Proxy</>}
        </button>
      </div>

      {/* ADD PROXY FORM */}
      {showAdd && (
        <div className="ap-create-box" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: 16 }}>Add New Proxy</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div className="ap-field">
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Proxy Name</label>
              <div className="digital-input-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <input type="text" className="digital-number" style={{ color: 'var(--text-main)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', textAlign: 'left' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. USA Proxy 1" />
              </div>
            </div>
            <div className="ap-field">
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ width: '100%', height: 42, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0 12px', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}>
                <option value="socks5">SOCKS5</option>
                <option value="socks4">SOCKS4</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            <div className="ap-field">
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Host</label>
              <div className="digital-input-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <input type="text" className="digital-number" style={{ color: 'var(--text-main)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', textAlign: 'left' }} value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="192.168.1.1" />
              </div>
            </div>
            <div className="ap-field">
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Port</label>
              <div className="digital-input-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <input type="number" className="digital-number" style={{ color: '#10b981', fontWeight: 700 }} value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="1080" />
              </div>
            </div>
            <div className="ap-field">
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Username <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <div className="digital-input-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <input type="text" className="digital-number" style={{ color: 'var(--text-main)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', textAlign: 'left' }} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="user" />
              </div>
            </div>
            <div className="ap-field">
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>Password <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <div className="digital-input-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <input type="password" className="digital-number" style={{ color: 'var(--text-main)', fontFamily: 'inherit', fontWeight: 500, fontSize: '0.85rem', textAlign: 'left' }} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="pass" />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="ap-submit-btn" onClick={handleAdd}><Plus size={14} /> Add Proxy</button>
          </div>
        </div>
      )}

      {/* PROXY LIST */}
      <div className="ap-section" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} /> Active Proxies <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8 }}>{proxies.length}</span>
          </h2>
          <button onClick={() => { fetchProxies(); fetchMappings(); }} className="ap-icon-btn" style={{ fontSize: '0.78rem', gap: 4 }}><RefreshCw size={12} /> Refresh</button>
        </div>

        {proxies.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-dim)' }}>
            <Shield size={36} style={{ opacity: 0.25, marginBottom: 12 }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>No proxies configured</div>
            <span style={{ fontSize: '0.78rem' }}>Click "Add Proxy" to add your SOCKS5/HTTP proxy servers.</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {proxies.map(proxy => {
            const tr = testResult?.id === proxy.id ? testResult : null;
            const assignedPages = mappings.filter(m => m.proxy_id === proxy.id);
            return (
              <div key={proxy.id} style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.015)', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{proxy.name}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase' }}>{proxy.type}</span>
                      {proxy.enabled ? (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><Wifi size={10} /> Active</span>
                      ) : (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 4 }}><WifiOff size={10} /> Disabled</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      {proxy.host}:{proxy.port} {proxy.username && `(${proxy.username}:***)`}
                    </div>
                    {assignedPages.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {assignedPages.map(ap => (
                          <span key={ap.page_id} style={{ fontSize: '0.68rem', color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.15)' }}>
                            {pages.find(p => p.id === ap.page_id)?.name || ap.page_id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="ap-start-btn" onClick={() => handleTest(proxy)} disabled={testing === proxy.id} style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
                      {testing === proxy.id ? '⏳' : <><Wifi size={11} /> Test</>}
                    </button>
                    <button className="ap-start-btn" onClick={() => { setAssignProxy(proxy.id); setSelectedPages(mappings.filter(m => m.proxy_id === proxy.id).map(m => m.page_id)); }} style={{ fontSize: '0.75rem', padding: '5px 10px', color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)' }}>
                      Assign Pages
                    </button>
                    <button className="ap-icon-btn danger" onClick={() => handleDelete(proxy.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
                {tr && (
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: tr.success ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)', border: `1px solid ${tr.success ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`, fontSize: '0.8rem' }}>
                    {tr.success ? (
                      <span style={{ color: '#10b981' }}><Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Connected! IP: <strong>{tr.ip}</strong> — {tr.location}</span>
                    ) : (
                      <span style={{ color: '#f43f5e' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Failed: {tr.error}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ASSIGN PROXY MODAL */}
      {assignProxy && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28, maxWidth: 500, width: '90%', maxHeight: '70vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--text-main)' }}>
              <Shield size={16} style={{ color: '#f59e0b', verticalAlign: 'middle', marginRight: 8 }} />
              Assign Proxy to Pages
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 16 }}>
              Select which pages should use this proxy for posting. Unselected pages will use direct connection.
            </p>
            {pages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)', fontSize: '0.85rem' }}>No pages connected. Add a Facebook token in Dashboard first.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => setSelectedPages(selectedPages.length === pages.length ? [] : pages.map(p => p.id))} style={{ fontSize: '0.75rem', color: '#6366f1', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600, padding: '4px 0' }}>
                  {selectedPages.length === pages.length ? 'Deselect All' : 'Select All'}
                </button>
                {pages.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${selectedPages.includes(p.id) ? 'rgba(99,102,241,0.3)' : 'var(--border-color)'}`, background: selectedPages.includes(p.id) ? 'rgba(99,102,241,0.04)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <input type="checkbox" checked={selectedPages.includes(p.id)} onChange={() => togglePage(p.id)} style={{ accentColor: '#6366f1' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="ap-icon-btn" onClick={() => { setAssignProxy(null); setSelectedPages([]); }}><X size={13} /> Cancel</button>
              <button className="ap-start-btn" onClick={handleAssign}><Save size={13} /> Save Assignment</button>
            </div>
          </div>
        </div>
      )}

      {/* PAGE-PROXY STATUS TABLE */}
      {pages.length > 0 && (
        <div className="ap-section" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 22, marginTop: 20 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Page Proxy Status
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="pps-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ textAlign: 'left' }}>PAGE</th>
                  <th>PROXY</th>
                  <th>TYPE</th>
                  <th>ENDPOINT</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(p => {
                  const proxyMapping = getPageProxy(p.id);
                  return (
                    <tr key={p.id}>
                      <td style={{ textAlign: 'left', fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</td>
                      <td>
                        {proxyMapping ? (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>{proxyMapping.proxy_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Direct</span>
                        )}
                      </td>
                      <td>
                        {proxyMapping ? (
                          <span className="pps-badge total" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>{proxyMapping.type}</span>
                        ) : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {proxyMapping ? `${proxyMapping.host}:${proxyMapping.port}` : '—'}
                      </td>
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
