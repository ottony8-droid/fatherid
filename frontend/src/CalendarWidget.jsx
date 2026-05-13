import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export default function CalendarWidget({ pipelineState, getPageName }) {
  const [hoverKey, setHoverKey] = useState(null);
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  
  let nums = [];
  // Ghost previous month
  for(let i=0; i<firstDay; i++) nums.push({ day: daysInPrevMonth - firstDay + i + 1, dim: true, month: currentMonth - 1 });
  // Active month
  for(let i=1; i<=daysInMonth; i++) nums.push({ day: i, dim: false, month: currentMonth });
  // Ghost next month
  const remaining = (nums.length > 35 ? 42 : 35) - nums.length;
  for(let i=1; i<=remaining; i++) nums.push({ day: i, dim: true, month: currentMonth + 1 });
  
  const getDotsCount = (dayInfo) => {
     let count = 0;
     pipelineState.forEach(item => {
        const d = new Date(parseInt(item.scheduled_time));
        if(!isNaN(d.getTime())) {
           const t = new Date(currentYear, dayInfo.month, dayInfo.day);
           if(d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()) count++;
        }
     });
     return count > 3 ? 3 : count;
  }

  const getDayDetails = (dayInfo) => {
     let items = [];
     pipelineState.forEach(item => {
        const d = new Date(parseInt(item.scheduled_time));
        if(!isNaN(d.getTime())) {
           const t = new Date(currentYear, dayInfo.month, dayInfo.day);
           if(d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()) {
             items.push({
                time: d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                name: item.message,
                pageName: getPageName ? getPageName(item.page_id) : (item.page_id || 'Unknown Page')
             });
           }
        }
     });
     
     // Intelligent Grouping By Page Name
     const grouped = {};
     items.forEach(itm => {
        if(!grouped[itm.pageName]) grouped[itm.pageName] = [];
        grouped[itm.pageName].push(itm);
     });
     
     return { total: items.length, grouped };
  }

  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', marginTop: 32}}>
       {/* CALENDAR BLOCK */}
       <div style={{background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '24px 32px', width: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position:'relative', zIndex: 10}}>
           
           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 24}}>
              <ChevronLeft size={16} color="var(--text-muted)" style={{cursor:'pointer'}} />
              <div style={{fontWeight: 600, fontSize: '0.95rem'}}>{monthNames[currentMonth]} {currentYear}</div>
              <ChevronRight size={16} color="var(--text-muted)" style={{cursor:'pointer'}} />
           </div>

           <div className="cal-grid" style={{marginTop: 0}}>
              {days.map(d=><div key={d} className="cal-head">{d}</div>)}
              {nums.map((item, i) => {
                 const isDim = item.dim; 
                 const dots = getDotsCount(item);
                 const isToday = !item.dim && item.day === today.getDate() && item.month === today.getMonth();
                 const hasDots = dots > 0;
                 const dayItems = getDayDetails(item);
                 return (
                  <div 
                     key={i} 
                     className="cal-cell" 
                     style={{color: isDim ? 'var(--text-dim)' : 'var(--text-main)', background: hasDots ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                     onMouseEnter={() => setHoverKey(i)}
                     onMouseLeave={() => setHoverKey(null)}
                  >
                     {item.day}
                     {dots > 0 && (
                        <div style={{display:'flex', gap:3, justifyContent:'center', position:'absolute', bottom:4, left:0, right:0}}>
                          {Array.from({length: dots}).map((_,x)=><div key={x} className="cal-dot" style={{position:'static', transform:'none', background:(isToday && x===1)?'#111':'var(--blue-accent)'}}/>)}
                        </div>
                     )}

                     {/* HOVER TOOLTIP */}
                     {hoverKey === i && dayItems.total > 0 && (
                        <div style={{
                           position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
                           background: '#fff', color: '#000', padding: '12px', borderRadius: '8px',
                           width: 'max-content', minWidth: '180px', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                           textAlign: 'left'
                        }}>
                           <div style={{fontWeight: 700, fontSize: '0.85rem', marginBottom: 8, borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: 6}}>
                              {monthNames[item.month % 12]} {item.day} — {dayItems.total} Videos
                           </div>
                           <div style={{maxHeight: '160px', overflowY: 'auto'}}>
                              {Object.keys(dayItems.grouped).map((pName, gIdx) => {
                                 const pItems = dayItems.grouped[pName];
                                 return (
                                    <div key={gIdx} style={{marginBottom: 8}}>
                                       <div style={{fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 2}}>
                                          {pName} <span style={{color:'var(--text-dim)', fontWeight: 'normal'}}>({pItems.length})</span>
                                       </div>
                                       <div style={{display:'flex', flexWrap:'wrap', gap: 6}}>
                                          {pItems.map((v, idx) => (
                                             <div key={idx} style={{display:'flex', alignItems:'center', gap: 4, fontSize: '0.7rem', fontWeight: 500, background:'rgba(0,0,0,0.05)', padding:'2px 6px', borderRadius:4}}>
                                                <Clock size={10} color="var(--primary)"/> {v.time}
                                             </div>
                                          ))}
                                       </div>
                                    </div>
                                 )
                              })}
                           </div>
                           {/* Little pointer triangle */}
                           <div style={{position:'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #fff'}}></div>
                        </div>
                     )}
                  </div>
                 )
              })}
           </div>
       </div>
       <div style={{fontSize:'0.75rem', color:'var(--text-dim)', marginTop: 12}}>Hover over days to see specific times and links.</div>
    </div>
  );
}
