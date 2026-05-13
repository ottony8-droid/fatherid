import React, { useState, useEffect } from 'react';
import { Settings, LayoutDashboard, Zap, LogOut, Rocket, TrendingUp, Sun, Moon, Monitor, Shield } from 'lucide-react';
import Dashboard from './Dashboard';
import AutoPilot from './AutoPilot';
import ProxyManager from './ProxyManager';

const API_URL = '/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('fb_token') || '');
  const [pages, setPages] = useState([]);
  
  // UI Tabs Control
  const [activeTopTab, setActiveTopTab] = useState('autopilot');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pipelineState, setPipelineState] = useState([]);
  
  // Settings Token Input
  const [tokenInput, setTokenInput] = useState('');
  const [systemTokens, setSystemTokens] = useState([]);

  // Theme Switcher
  const [theme, setTheme] = useState(localStorage.getItem('app_theme') || 'dark');
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const showAlert = (msg, type = 'info') => {
    alert(msg);
  };

  const loadPages = async () => {
    try {
      const res = await fetch(`${API_URL}/pages`, { headers: { 'Authorization': token } });
      const data = await res.json();
      if(data.pages) setPages(data.pages);
    } catch(e) { console.error(e); }
  };

  const handleDeletePage = async (pageId) => {
    if(!window.confirm("Remove this page from your Dashboard?")) return;
    try {
       await fetch(`${API_URL}/pages/${pageId}`, { method: 'DELETE' });
       loadPages(); // reload pages automatically
    } catch(err) {
       showAlert("Failed to delete page", "error");
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API_URL}/queue`);
      const data = await res.json();
      if(data.queue) setPipelineState(data.queue);
    } catch(e) {}
  };

  const fetchTokens = async () => {
    try {
      const res = await fetch(`${API_URL}/tokens`);
      const data = await res.json();
      if(data.tokens) setSystemTokens(data.tokens);
    } catch(e) {}
  };

  useEffect(() => {
    loadPages();
    fetchQueue();
    fetchTokens();
    const iv = setInterval(fetchQueue, 5000);
    return () => clearInterval(iv);
  }, []);

  const handleDeleteToken = async (id) => {
    if(!window.confirm("Delete this tied Token? Associated pages will be dropped!")) return;
    try {
      await fetch(`${API_URL}/tokens/${id}`, { method: 'DELETE' });
      fetchTokens();
      loadPages();
    } catch(e) {}
  };

  const handleAuth = async () => {
    if(!tokenInput) return showAlert("Please paste a Graph API Token first.", "error");
    try {
      setIsSyncing(true);
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: tokenInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      showAlert('Account connected & backend sync completed!');
      localStorage.setItem('fb_token', tokenInput);
      setToken(tokenInput);
      setTokenInput(''); // Auto clear box
      fetchTokens(); // Auto refresh the token list visually
      loadPages(); // Auto pull new pages
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };



  return (
    <div className="app-container">
      
      {/* SIDEBAR */}
      <div className="sidebar">
        <div style={{height: 60, display:'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid var(--border-color)'}}>
           <div className="sidebar-header" style={{padding:0, color:'var(--text-main)', fontSize: '0.9rem'}}>VPS AutoPilot</div>
        </div>
        
        <div style={{paddingTop: 20}}>
           <div className={`nav-item ${activeTopTab === 'autopilot' ? 'active' : ''}`} onClick={()=>setActiveTopTab('autopilot')}>
             <Rocket size={16} color={activeTopTab === 'autopilot' ? 'var(--primary)' : 'var(--text-muted)'} style={{marginRight:8}} /> AutoPilot
           </div>
           <div className={`nav-item ${activeTopTab === 'dash' ? 'active' : ''}`} onClick={()=>setActiveTopTab('dash')}>
             <LayoutDashboard size={16} color={activeTopTab === 'dash' ? 'var(--blue-accent)' : 'var(--text-muted)'} style={{marginRight:8}} /> Dashboard
           </div>
           <div className={`nav-item ${activeTopTab === 'proxy' ? 'active' : ''}`} onClick={()=>setActiveTopTab('proxy')}>
             <Shield size={16} color={activeTopTab === 'proxy' ? '#f59e0b' : 'var(--text-muted)'} style={{marginRight:8}} /> Proxies
           </div>
        </div>

        <div style={{marginTop: 'auto', padding: 24, borderTop: '1px solid var(--border-color)'}}>
             <div style={{color: 'var(--success)', fontSize: '0.85rem', fontWeight:600, display:'flex', alignItems:'center', gap:8, marginBottom: 12}}>
                 <div style={{width:8, height:8, borderRadius:4, background:'var(--success)', boxShadow:'0 0 8px var(--success)', animation: 'pulse 2s infinite'}}></div>
                 REEL BLASTER ACTIVE
             </div>
             
             <div style={{marginTop: 16, color: 'var(--text-dim)', fontSize: '0.8rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                AutoPilot v4.0
                <LogOut size={14}/>
             </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-content">
        
        {/* TOPBAR */}
        <div className="topbar">
           <div className="brand">
              <div className="brand-btn"><Zap size={16} fill="var(--primary)" color="var(--primary)"/></div>
              AutoReel Post by Bittu
           </div>
           <div className="top-tabs">
              <div className={`top-tab ${activeTopTab === 'autopilot' ? 'active' : ''}`} onClick={()=>setActiveTopTab('autopilot')}><Rocket size={14}/> AutoPilot</div>
              <div className={`top-tab ${activeTopTab === 'dash' ? 'active' : ''}`} onClick={()=>setActiveTopTab('dash')}><LayoutDashboard size={14}/> Dashboard</div>
              <div className={`top-tab ${activeTopTab === 'proxy' ? 'active' : ''}`} onClick={()=>setActiveTopTab('proxy')}><Shield size={14}/> Proxies</div>
           </div>

           {/* THEME SWITCHER */}
           <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4}}>
             <button onClick={() => setTheme('dark')} className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} title="Dark">
               <Moon size={14}/>
             </button>
             <button onClick={() => setTheme('midnight')} className={`theme-btn ${theme === 'midnight' ? 'active' : ''}`} title="Midnight">
               <Monitor size={14}/>
             </button>
             <button onClick={() => setTheme('light')} className={`theme-btn ${theme === 'light' ? 'active' : ''}`} title="Light">
               <Sun size={14}/>
             </button>
           </div>
        </div>

        {/* TAB ROUTING */}
        {activeTopTab === 'autopilot' && <AutoPilot />}

        {activeTopTab === 'dash' && (
           <Dashboard 
              pages={pages} 
              pipelineState={pipelineState} 
              token={tokenInput} setToken={setTokenInput}
              handleAuth={handleAuth} isSyncing={isSyncing}
              handleDeletePage={handleDeletePage}
           />
        )}

        {activeTopTab === 'proxy' && (
           <ProxyManager pages={pages} />
        )}


        {activeTopTab === 'settings' && (
           <div style={{padding: 48, color: 'var(--text-main)'}}>
              <h2>System Settings</h2>
              <p style={{color: 'var(--text-muted)', marginTop: 12}}>App Version: 4.0.0 (AutoPilot Reel Blaster by Bittu)</p>
              
              <div className="segment-box" style={{marginTop: 32, maxWidth: 600}}>
                 <h3 style={{marginBottom: 16}}>Facebook API Token Settings</h3>
                 <p style={{color:'var(--text-dim)', fontSize:'0.85rem', marginBottom:20}}>Add multiple User Access Tokens below. They automatically unify ALL pages in your dashboard.</p>
                 
                 <div style={{display:'flex', gap:10}}>
                   <input type="password" value={tokenInput} onChange={e=>setTokenInput(e.target.value)} placeholder="EAAQ... Your Graph API Access Token Here" style={{flex:1}} />
                   <button className="btn-primary" onClick={handleAuth}>{isSyncing ? 'Authenticating...' : 'Add Account'}</button>
                 </div>
              </div>

              <div className="segment-box" style={{marginTop: 32, maxWidth: 600}}>
                 <h3 style={{marginBottom: 16}}>Active Connected Tokens</h3>
                 {systemTokens.length === 0 && <div style={{fontSize:'0.85rem', color:'var(--text-dim)'}}>No tokens found.</div>}
                 
                 {systemTokens.map((t) => {
                    return (
                    <div key={t.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginBottom: 8}}>
                       <div>
                          <div style={{fontSize:'0.85rem', fontFamily:'monospace', color:'var(--blue-accent)'}}>
                            {t.access_token.substring(0,15)}...{t.access_token.substring(t.access_token.length-5)}
                          </div>
                          <div style={{fontSize:'0.75rem', color:'var(--success)', marginTop: 4, display:'flex', gap:12}}>
                             <span>{t.pageCount} Pages Authorized</span>
                             <span style={{color:'var(--text-dim)'}}>• Exact Expiry: ~60 Days (Requires Refresh)</span>
                          </div>
                       </div>
                       <button className="icon-btn" onClick={()=>handleDeleteToken(t.id)} style={{color:'var(--danger)'}}>Remove</button>
                    </div>
                 )})}
              </div>
           </div>
        )}

      </div>
    </div>
  );
}

export default App;
