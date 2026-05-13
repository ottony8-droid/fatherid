import React, { useState, useEffect } from 'react';
import { Target, Activity, CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react';

const API = '/api/autopilot';

export default function Analytics({ pages }) {
  const [selectedPage, setSelectedPage] = useState('All');
  const [days, setDays] = useState(1); // Default to Today
  
  const [totals, setTotals] = useState({ total_posted: 0, total_success: 0, total_failed: 0 });
  const [dailyTrend, setDailyTrend] = useState([]);

  const fetchAnalytics = async () => {
    try {
      const u = new URL(`${API}/analytics`);
      u.searchParams.append('days', days);
      if (selectedPage && selectedPage !== 'All') {
          u.searchParams.append('page_name', selectedPage);
      }
      
      const res = await fetch(u);
      const data = await res.json();
      setTotals(data.totals || { total_posted: 0, total_success: 0, total_failed: 0 });
      setDailyTrend(data.dailyTrend || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const iv = setInterval(fetchAnalytics, 15000);
    return () => clearInterval(iv);
  }, [days, selectedPage]);

  const safeNum = (n) => parseInt(n || 0);

  return (
    <div className="content-wrapper">
      <div className="ap-header" style={{ marginBottom: 30 }}>
        <div>
          <h1 className="ap-title"><Activity size={24} style={{ color: 'var(--success)' }} /> Exact Page Analytics</h1>
          <p className="ap-subtitle">No estimations. 100% accurate posting performance data directly from your database.</p>
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 30, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="ap-field" style={{ flex: 1, minWidth: 250, marginBottom: 0 }}>
          <label>Target Page</label>
          <select 
            className="digital-number" 
            style={{ width: '100%', padding: '12px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none' }}
            value={selectedPage}
            onChange={e => setSelectedPage(e.target.value)}
          >
            <option value="All">All Connected Pages</option>
            {pages && pages.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="ap-field" style={{ marginBottom: 0 }}>
          <label>Timeframe</label>
          <div style={{ display: 'flex', gap: 10, background: 'var(--bg-card)', padding: '6px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button 
              className={days === 1 ? 'ap-submit-btn' : 'ap-btn-secondary'} 
              style={{ margin: 0, padding: '8px 16px', background: days === 1 ? 'var(--blue-accent)' : 'transparent', border: 'none' }}
              onClick={() => setDays(1)}
            >
               Today
            </button>
            <button 
              className={days === 7 ? 'ap-submit-btn' : 'ap-btn-secondary'} 
              style={{ margin: 0, padding: '8px 16px', background: days === 7 ? 'var(--blue-accent)' : 'transparent', border: 'none' }}
              onClick={() => setDays(7)}
            >
               7 Days
            </button>
            <button 
              className={days === 28 ? 'ap-submit-btn' : 'ap-btn-secondary'} 
              style={{ margin: 0, padding: '8px 16px', background: days === 28 ? 'var(--blue-accent)' : 'transparent', border: 'none' }}
              onClick={() => setDays(28)}
            >
               28 Days
            </button>
          </div>
        </div>
      </div>

      {/* ── METRICS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 30 }}>
        
        <div className="ap-engine-card" style={{ marginBottom: 0 }}>
          <div className="ap-engine-inner">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Posted</div>
                <Target size={20} color="var(--blue-accent)" />
             </div>
             <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {safeNum(totals.total_success) + safeNum(totals.total_failed)}
             </div>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 10 }}>Overall upload attempts made</div>
          </div>
        </div>

        <div className="ap-engine-card" style={{ marginBottom: 0 }}>
          <div className="ap-engine-inner">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Successfully Published</div>
                <CheckCircle2 size={20} color="var(--success)" />
             </div>
             <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success)' }}>
                {safeNum(totals.total_success)}
             </div>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 10 }}>Confirmed live on Facebook</div>
          </div>
        </div>

        <div className="ap-engine-card" style={{ marginBottom: 0 }}>
          <div className="ap-engine-inner">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Failed Uploads</div>
                <XCircle size={20} color="var(--danger)" />
             </div>
             <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                {safeNum(totals.total_failed)}
             </div>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 10 }}>Failed even after retries</div>
          </div>
        </div>

      </div>

      {/* ── DAILY BREAKDOWN ── */}
      <div className="ap-engine-card">
        <div className="ap-engine-inner">
           <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '15px' }}>
              <Calendar size={18} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--text-dim)' }} />
              Volume History
           </h3>
           
           {dailyTrend.length === 0 ? (
             <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
               No data found for this period.
             </div>
           ) : (
             <div style={{ width: '100%', overflowX: 'auto' }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                     <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Date</th>
                     <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Successfully Posted</th>
                     <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Failed Attempts</th>
                   </tr>
                 </thead>
                 <tbody>
                   {dailyTrend.map((day, idx) => (
                     <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                       <td style={{ padding: '16px', color: 'var(--text-main)', fontWeight: 500 }}>
                         {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                       </td>
                       <td style={{ padding: '16px', color: 'var(--success)' }}>{day.success}</td>
                       <td style={{ padding: '16px', color: day.failed > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>{day.failed}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
