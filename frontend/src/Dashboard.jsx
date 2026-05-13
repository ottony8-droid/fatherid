import React, { useState, useEffect } from 'react';
import { Facebook, Trash2, Plus, Shield, CheckCircle2, XCircle, Activity, Search, ChevronDown, ChevronUp, RefreshCw, Key, Eye, EyeOff, FileVideo, TrendingUp, Zap, BarChart3 } from 'lucide-react';

const API = '/api';

export default function Dashboard({ pages, pipelineState, token, setToken, handleAuth, isSyncing, handleDeletePage }) {
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [pageStats, setPageStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [expandedPage, setExpandedPage] = useState(null);
  const [tokens, setTokens] = useState([]);

  // Fetch page stats and tokens
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, tokensRes] = await Promise.all([
          fetch(`${API}/autopilot/page-stats`).then(r => r.json()),
          fetch(`${API}/tokens`).then(r => r.json())
        ]);
        if (statsRes.stats) setPageStats(statsRes.stats);
        if (tokensRes.tokens) setTokens(tokensRes.tokens);
      } catch (e) { console.error(e); }
    };
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, []);

  // Compute overall today stats
  const todaySuccess = Object.values(pageStats).reduce((a, s) => a + (s.today_success || 0), 0);
  const todayFailed = Object.values(pageStats).reduce((a, s) => a + (s.today_failed || 0), 0);
  const totalAllTime = Object.values(pageStats).reduce((a, s) => a + (s.total_posts || 0), 0);

  const handleDeleteToken = async (id) => {
    if (window.confirm("Are you sure you want to delete this token and all its synced pages?")) {
      try {
        await fetch(`${API}/tokens/${id}`, { method: 'DELETE' });
        setTokens(tokens.filter(t => t.id !== id));
        window.location.reload(); // Reload to refresh pages list
      } catch (e) {
        console.error('Error deleting token:', e);
      }
    }
  };

  // Filter and sort pages
  const filteredPages = pages
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const aS = pageStats[a.id]?.today_success || 0;
      const bS = pageStats[b.id]?.today_success || 0;
      if (sortBy === 'posted') return bS - aS;
      const aF = pageStats[a.id]?.today_failed || 0;
      const bF = pageStats[b.id]?.today_failed || 0;
      if (sortBy === 'failed') return bF - aF;
      return 0;
    });

  const getPageStatus = (pageId) => {
    const s = pageStats[pageId];
    if (!s || (!s.today_success && !s.today_failed)) return 'waiting';
    if (s.today_failed > 0 && !s.today_success) return 'failed';
    if (s.today_success > 0) return 'active';
    return 'waiting';
  };

  return (
    <div className="content-wrapper">

      {/* ═══ HEADER ═══ */}
      <div className="db-hero">
        <div>
          <h1 className="db-title">Dashboard</h1>
          <p className="db-subtitle">Your command center — see all connected pages, today's progress, and manage Facebook API tokens.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="db-refresh-btn" style={{ borderColor: 'rgba(244,63,94,0.3)', color: '#f43f5e' }} onClick={async () => {
            if (window.confirm("Are you sure you want to completely RESET all analytics and post logs? This clears all test data.")) {
              try { await fetch(`${API}/autopilot/reset`, { method: 'POST' }); } catch(e){}
              window.location.reload();
            }
          }}>
            <Trash2 size={14}/> Reset Analytics
          </button>
          <button className="db-refresh-btn" onClick={() => window.location.reload()}>
            <RefreshCw size={14}/> Refresh
          </button>
        </div>
      </div>

      {/* ═══ STATS ROW ═══ */}
      <div className="db-stats-grid">
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}><Facebook size={18}/></div>
          <div>
            <div className="db-stat-val" style={{ color: '#6366f1' }}>{pages.length}</div>
            <div className="db-stat-label">Connected Pages</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}><CheckCircle2 size={18}/></div>
          <div>
            <div className="db-stat-val" style={{ color: '#10b981' }}>{todaySuccess}</div>
            <div className="db-stat-label">Posted Today</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}><XCircle size={18}/></div>
          <div>
            <div className="db-stat-val" style={{ color: '#f43f5e' }}>{todayFailed}</div>
            <div className="db-stat-label">Failed Today</div>
          </div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}><BarChart3 size={18}/></div>
          <div>
            <div className="db-stat-val" style={{ color: '#8b5cf6' }}>{totalAllTime}</div>
            <div className="db-stat-label">All-Time Posts</div>
          </div>
        </div>
      </div>

      {/* ═══ TOKEN SECTION ═══ */}
      <div className="db-section">
        <div className="db-section-header">
          <div>
            <h2 className="db-section-title"><Key size={16}/> API Tokens</h2>
            <p className="db-section-desc">Your Facebook Graph API tokens. Add multiple tokens to connect pages from different accounts.</p>
          </div>
          <button className="db-action-btn" onClick={() => setShowTokenInput(!showTokenInput)}>
            {showTokenInput ? <><XCircle size={14}/> Cancel</> : <><Plus size={14}/> Add Token</>}
          </button>
        </div>

        {showTokenInput && (
          <div className="db-token-form">
            <div className="db-token-input-group">
              <Key size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }}/>
              <input 
                type={showToken ? 'text' : 'password'} 
                value={token} 
                onChange={e => setToken(e.target.value)} 
                placeholder="Paste your Facebook Graph API Access Token here (EAAQ...)" 
                style={{ flex: 1 }} 
              />
              <button className="db-token-eye" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
              <button className="db-token-add-btn" onClick={handleAuth} disabled={isSyncing}>
                {isSyncing ? <><RefreshCw size={14} className="spin"/> Syncing...</> : <><Zap size={14}/> Connect</>}
              </button>
            </div>
            <p className="db-token-tip">Get your token from <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener" style={{ color: '#6366f1' }}>Graph API Explorer</a>. Make sure to select all pages during permission dialog.</p>
          </div>
        )}

        {tokens.length > 0 && (
          <div className="db-token-list">
            {tokens.map(t => (
              <div key={t.id} className="db-token-item" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'}}>
                <div className="db-token-info" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                  <div style={{width: 40, height: 40, borderRadius: '50%', background: 'rgba(24,119,242,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                     <Facebook size={20} color="#1877f2" />
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                     <span style={{fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem'}}>{t.name || 'Fetching Name...'}</span>
                     <span style={{fontSize: '0.8rem', color: 'var(--text-dim)'}}>
                        <Key size={10} style={{display:'inline', marginRight:4}}/> 
                        {t.access_token.substring(0, 15)}... • ID: {t.fb_id || 'Unknown'}
                     </span>
                  </div>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginRight: '16px'}}>
                     <span className="db-token-status" style={{fontSize: '0.8rem', color: '#10b981', fontWeight: 600, display:'flex', alignItems:'center', gap:4}}><div style={{width:6,height:6,borderRadius:'50%',background:'#10b981'}}></div> Active</span>
                     <span style={{fontSize: '0.75rem', color: 'var(--text-dim)'}}>{t.pageCount || pages.filter(p => p.user_token === t.access_token).length} Pages Synced</span>
                  </div>
                  <button onClick={() => handleDeleteToken(t.id)} className="db-token-delete" style={{background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'}}>
                     <Trash2 size={16}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ PAGES GRID ═══ */}
      <div className="db-section">
        <div className="db-section-header">
          <div>
            <h2 className="db-section-title"><Facebook size={16}/> Connected Pages <span className="db-count-badge">{pages.length}</span></h2>
            <p className="db-section-desc">All your Facebook pages. Each card shows today's posting progress — green for success, red for failed.</p>
          </div>
          <div className="db-page-controls">
            <div className="db-search-box">
              <Search size={14}/>
              <input type="text" placeholder="Search pages..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <select className="db-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name">Sort: A-Z</option>
              <option value="posted">Sort: Most Posted</option>
              <option value="failed">Sort: Most Failed</option>
            </select>
          </div>
        </div>

        {filteredPages.length === 0 && pages.length === 0 && (
          <div className="db-empty">
            <Facebook size={36}/>
            <div>No pages connected</div>
            <span>Add a Facebook API token above to sync your pages.</span>
          </div>
        )}

        {filteredPages.length === 0 && pages.length > 0 && (
          <div className="db-empty">
            <Search size={36}/>
            <div>No results for "{searchTerm}"</div>
            <span>Try a different search term.</span>
          </div>
        )}

        <div style={{ overflowX: 'auto', marginTop: '16px' }}>
          <table className="pps-table" style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <th style={{textAlign: 'left', padding: '16px 20px', fontWeight: 600}}>Page Name</th>
                <th style={{padding: '16px 20px', fontWeight: 600}}>Total Posts</th>
                <th style={{padding: '16px 20px', fontWeight: 600}}>Successful</th>
                <th style={{padding: '16px 20px', fontWeight: 600}}>Failed</th>
                <th style={{padding: '16px 20px', fontWeight: 600}}>Success Rate</th>
                <th style={{padding: '16px 20px', fontWeight: 600}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.map((p) => {
                const stats = pageStats[p.id] || {};
                const total = (stats.total_posts || 0);
                const succ = (stats.total_success || 0);
                const fail = (stats.total_failed || 0);
                const rate = total > 0 ? Math.round((succ/total)*100) : 0;
                
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{textAlign: 'left', padding: '14px 20px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem'}}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                          <Facebook size={14}/>
                        </div>
                        {p.name}
                      </div>
                    </td>
                    <td style={{padding: '14px 20px', textAlign: 'center', fontWeight: 600, color: '#6366f1', fontSize: '0.9rem'}}>{total}</td>
                    <td style={{padding: '14px 20px', textAlign: 'center', fontWeight: 600, color: '#10b981', fontSize: '0.9rem'}}>{succ}</td>
                    <td style={{padding: '14px 20px', textAlign: 'center', fontWeight: 600, color: fail > 0 ? '#f43f5e' : 'var(--text-dim)', fontSize: '0.9rem'}}>{fail}</td>
                    <td style={{padding: '14px 20px', textAlign: 'center', fontWeight: 600, color: rate >= 90 ? '#10b981' : rate > 0 ? '#f59e0b' : 'var(--text-dim)', fontSize: '0.9rem'}}>
                      {total > 0 ? `${rate}%` : '-'}
                    </td>
                    <td style={{padding: '14px 20px', textAlign: 'center'}}>
                      <button onClick={(e) => { e.stopPropagation(); handleDeletePage(p.id); }} style={{background: 'rgba(244,63,94,0.1)', border: 'none', color: '#f43f5e', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600}}>
                        <Trash2 size={12}/> Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
