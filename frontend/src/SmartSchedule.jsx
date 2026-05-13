import React, { useState } from 'react';
import { CalendarClock, FolderOpen, ExternalLink, Scan, Clock, RefreshCcw, Layers, Trash2, AlertTriangle, ChevronDown, ChevronRight, ChevronsUpDown, Edit2, Check, X } from 'lucide-react';
import CalendarWidget from './CalendarWidget';

export default function SmartSchedule({
  token, pages, pipelineState, fetchQueue, showAlert,
  targetPages, setTargetPages,
  startDate, setStartDate, startTime, setStartTime,
  rootFolder, setRootFolder, includeSubs, setIncludeSubs,
  scannedFiles, setScannedFiles,
  distType, setDistType, distValue, setDistValue,
  distGap, setDistGap, customTimesArray, setCustomTimesArray,
  skipDays, setSkipDays, instantFirstPost, setInstantFirstPost,
  isGenerating, setIsGenerating, handleScan, handleBrowse, handleGenerate
}) {

  const [isConfirming, setIsConfirming] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState({}); // default all collapsed (omitted keys block render)
  
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemTime, setEditingItemTime] = useState('');

  const handlePreGenerate = () => {
     if(!rootFolder) return showAlert("Select Folder Path", "error");
     if(!startDate) return showAlert("Select the Initial Start Date", "error");
     if(distType !== 'custom_times' && !startTime) return showAlert("Set First Post Start Time", "error");
     if(scannedFiles.length === 0) return showAlert("Run the Scan first to verify identified lines.", "error");
     if(targetPages.length === 0) return showAlert("Select at least one Target Facebook Page.", "error");
     setIsConfirming(true);
  };

  const togglePageSelection = (id) => {
     if(targetPages.includes(id)) {
        setTargetPages(targetPages.filter(p => p !== id));
     } else {
        setTargetPages([...targetPages, id]);
     }
  };

  const selectAllPages = () => setTargetPages(pages.map(p => p.id));
  const deselectAllPages = () => setTargetPages([]);

  const toggleSkipDay = (day) => {
    if(skipDays.includes(day)) setSkipDays(skipDays.filter(d => d !== day));
    else setSkipDays([...skipDays, day]);
  };

  const clearQueue = async (pageId = null) => {
    const msg = pageId ? "Are you sure you want to completely wipe the scheduled batch for this specific page?" : "⚠️ WARNING: Are you sure you want to clear the ENTIRE scheduled queue for ALL pages?";
    if(!window.confirm(msg)) return;
    try {
      const url = pageId ? `/api/queue?page_id=${pageId}` : `/api/queue`;
      await fetch(url, { method: 'DELETE' });
      fetchQueue();
      showAlert(pageId ? "Page batch cleared." : "Entire batch cleared.");
    } catch(err) {
      showAlert("Failed to clear queue", "error");
    }
  };

  const deleteItem = async (id) => {
    if(!window.confirm("Delete this scheduled post?")) return;
    try {
      await fetch(`/api/queue/${id}`, { method: 'DELETE' });
      fetchQueue();
    } catch(err) {
      showAlert("Failed to delete item", "error");
    }
  };

  const updateItemTime = async (id) => {
    if(!editingItemTime) return;
    try {
      const ms = new Date(editingItemTime).getTime();
      const res = await fetch(`/api/queue/${id}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ scheduled_time: ms })
      });
      if(res.ok) {
         showAlert("Time updated successfully!");
         setEditingItemId(null);
         fetchQueue();
      } else {
         showAlert("Failed to update time", "error");
      }
    } catch(err) {
       showAlert("Error processing update", "error");
    }
  };

  const getPageName = (id) => {
     const p = pages.find(p => p.id === id);
     return p ? p.name : id.substring(0,8) + '...';
  };

  const groupedTasks = pipelineState.reduce((acc, task) => {
     if(!acc[task.page_id]) acc[task.page_id] = [];
     acc[task.page_id].push(task);
     return acc;
  }, {});

  return (
    <div className="content-wrapper">
      
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
         <div>
            <h1>Smart Bulk Schedule</h1>
            <div className="subtitle">Paste raw links or provide local directories and let the algorithm automatically map out your post calendar.</div>
         </div>
         <div className="segment-box" style={{margin:0, padding: '12px 16px', display:'flex', alignItems:'center', gap: 16}}>
            <div style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing:1}}>
              BULK SOURCE TYPE
            </div>
            <div className="segment-btn active" style={{margin:0, padding:'6px 16px', fontSize:'0.85rem'}}>
               <FolderOpen size={16}/> LOCAL PATHS
            </div>
         </div>
      </div>

      <div className="grid-2col">
         {/* LEFT COLUMN */}
         <div>
            <div style={{marginBottom: 24}}>
               <label>First Post Starts <span style={{color:'var(--danger)', fontSize:'0.75rem', marginLeft:4}}>(*Min 20m from now)</span></label>
               <div className="digital-input-group" style={{maxWidth: '400px', marginBottom: 12}}>
                  <input type="date" className="digital-date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  {distType !== 'custom_times' && (
                     <input type="time" className="digital-time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  )}
               </div>
               
               <div className="skip-label" onClick={() => setInstantFirstPost(!instantFirstPost)} style={{display:'inline-flex', alignItems:'center', padding:'8px 12px', borderRadius:'6px', cursor:'pointer', background: instantFirstPost ? 'rgba(74, 222, 128, 0.1)' : 'rgba(0,0,0,0.2)', border: instantFirstPost ? '1px solid var(--success)' : '1px solid var(--border-color)', marginBottom: 8}}>
                  <input type="checkbox" checked={instantFirstPost} readOnly style={{marginRight: 8, cursor:'pointer'}} />
                  <span style={{fontSize:'0.85rem', color: instantFirstPost ? 'var(--success)' : 'var(--text-main)', fontWeight: instantFirstPost ? 600 : 400}}>🚀 Fire 1st Video Instantly! (Bypass 20m Wait)</span>
               </div>

               <div style={{fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4}}>
                  {instantFirstPost ? 
                     "The first video of every page batch will bypass the schedule buffer and be pushed completely instantly. The remaining videos will securely resume their normal timeline assignments." : 
                     (distType === 'custom_times' ? 
                     "Since you are using Custom Times, simply pick the Date. The system will use your exact first specified Custom Time slot below!" : 
                     "Facebook requires your first post to be at least 20 minutes in the future from the moment of dispatch.")
                  }
               </div>
            </div>

            <div>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
                  <label>Target Facebook Pages <span style={{color:'var(--primary)', marginLeft:4}}>({targetPages.length} Selected)</span></label>
                  <div style={{fontSize:'0.7rem', color:'var(--primary)', cursor:'pointer', marginBottom:6}} onClick={targetPages.length === pages.length ? deselectAllPages : selectAllPages}>
                     {targetPages.length === pages.length ? 'Deselect All' : 'Select All'}
                  </div>
               </div>
               
               <div className="multi-select-box" style={{maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding:'12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignContent: 'start'}}>
                  {pages.length === 0 && <div style={{fontSize:'0.8rem', color:'var(--text-dim)', padding:8, gridColumn: '1 / -1'}}>No pages synced. Add an API token first!</div>}
                  {pages.map(p => (
                     <div key={p.id} className="skip-label" onClick={() => togglePageSelection(p.id)} style={{display:'flex', alignItems:'center', padding:'6px 8px', borderRadius:'4px', cursor:'pointer', margin:0, minWidth:0}}>
                        <input type="checkbox" checked={targetPages.includes(p.id)} readOnly style={{marginRight: 8, cursor:'pointer', flexShrink:0}} />
                        <span style={{fontSize:'0.85rem', color: targetPages.includes(p.id) ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={p.name}>{p.name}</span>
                     </div>
                  ))}
               </div>

               <div style={{fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 8}}>
                  <b>Multi-Select Magic:</b> Select 50 pages and we'll automatically schedule to identically named subfolders for all of them instantly!
               </div>
            </div>

            <div style={{marginTop: 24}}>
              <label>Skip Days (Don't post on)</label>
              <div className="skip-days">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="skip-label" onClick={() => toggleSkipDay(day)}>
                       <input type="checkbox" checked={skipDays.includes(day)} readOnly />
                       {day}
                    </div>
                 ))}
              </div>
            </div>
         </div>

         {/* RIGHT COLUMN */}
         <div>
            <div style={{display:'flex', justifyContent:'space-between'}}>
               <h3 style={{fontSize: '0.9rem', marginBottom: 8}}>Detected Media Files</h3>
               <div style={{fontSize:'0.75rem', color: 'var(--text-muted)'}}>{scannedFiles.length} lines identified</div>
            </div>
            
            <div className="segment-box" style={{padding:0, border:'none', backgroundColor:'transparent'}}>
               <div style={{border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, backgroundColor: 'var(--bg-card)', marginBottom: -4, position:'relative', zIndex:5, borderBottomLeftRadius:0, borderBottomRightRadius:0}}>
                   <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, letterSpacing:1}}>FOLDER SCANNER</div>
                   <div style={{display:'flex', gap: 12}}>
                      <input type="text" value={rootFolder} onChange={e=>setRootFolder(e.target.value)} placeholder="C:\videos" style={{flex: 1, height: 40}}/>
                      <button className="btn-orange" onClick={handleBrowse} style={{backgroundColor:'transparent', border:'1px solid var(--primary)', color:'var(--text-main)', height:40, display:'flex', alignItems:'center', padding:'0 16px', gap:8}}>
                         <FolderOpen size={16}/> Select
                      </button>
                      <button className="btn-orange" onClick={handleScan} style={{height:40, padding:'0 24px', display:'flex', alignItems:'center'}}>Scan</button>
                   </div>
                   <div style={{marginTop: 12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div className="skip-label" onClick={()=>setIncludeSubs(!includeSubs)}>
                        <input type="checkbox" checked={includeSubs} readOnly /> Include Subfolders
                      </div>
                      <div style={{fontSize: '0.7rem', color: 'var(--success)', fontWeight: 'bold'}}>&bull; ONLINE</div>
                   </div>
               </div>

               <textarea 
                 className="terminal" 
                 value={scannedFiles.length > 0 ? scannedFiles.map(path => "✓ " + path.split('\\').pop() + " (Queued)").join('\n') : ''}
                 readOnly
                 placeholder="Awaiting Folder Scan..."
                 style={{height: 140, paddingTop: 20}}
               />
            </div>

            <div style={{marginTop: 24}}>
               <label>Distribution Frequency</label>
               <div className="dist-tabs" style={{display:'flex', gap:8}}>
                  <div className={`dist-tab ${distType === 'daily_pattern' ? 'active' : ''}`} onClick={()=>setDistType('daily_pattern')} style={{flex:1}}>
                     Daily Pattern
                     {distType === 'daily_pattern' && (
                        <div className="dist-content" style={{display:'flex', gap:12, marginTop:12}}>
                           <div>
                              <div style={{fontSize:'0.65rem', color:'var(--text-dim)', marginBottom:4}}>POSTS PER DAY</div>
                              <input type="number" value={distValue} onChange={e=>setDistValue(e.target.value)} style={{textAlign:'center', width:'100%'}}/>
                           </div>
                           <div>
                              <div style={{fontSize:'0.65rem', color:'var(--text-dim)', marginBottom:4}}>HOUR GAP</div>
                              <input type="number" value={distGap} onChange={e=>setDistGap(e.target.value)} style={{textAlign:'center', width:'100%'}}/>
                           </div>
                        </div>
                     )}
                  </div>
                  <div className={`dist-tab ${distType === 'custom_times' ? 'active' : ''}`} onClick={()=>setDistType('custom_times')} style={{flex:1}}>
                     Custom Times
                     {distType === 'custom_times' && (
                        <div className="dist-content" style={{marginTop:12}}>
                           <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                              {customTimesArray.map((t, idx) => (
                                 <input key={idx} type="time" value={t} onChange={e => {
                                    const newArr = [...customTimesArray];
                                    newArr[idx] = e.target.value;
                                    setCustomTimesArray(newArr);
                                 }} style={{width:'auto', padding:'4px 8px'}}/>
                              ))}
                           </div>
                           <div style={{display:'flex', gap:8, marginTop:8}}>
                              <button className="icon-btn" style={{fontSize:'0.75rem', padding:'4px 8px'}} onClick={()=>setCustomTimesArray([...customTimesArray, '00:00'])}>+ Add Slot</button>
                              <button className="icon-btn" style={{fontSize:'0.75rem', padding:'4px 8px', color:'#f87171'}} onClick={()=>{
                                 if(customTimesArray.length > 1) setCustomTimesArray(customTimesArray.slice(0,-1))
                              }}>- Remove</button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
               
               <div style={{marginTop: 12, fontSize: '0.75rem', color: 'var(--text-dim)', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'}}>
                  {distType === 'daily_pattern' && <span><b>Daily Pattern:</b> Posts a specific amount of videos per day, separated by your chosen hour gap. It automatically starts fresh at your original Start Time the next valid day!</span>}
                  {distType === 'custom_times' && <span><b>Custom Times:</b> Hand Pick specific clock slots for your posts precisely! Each video goes into the next available slot!</span>}
               </div>
            </div>

            {!isConfirming ? (
               <button className="btn-dispatch" disabled={isGenerating} onClick={handlePreGenerate} style={{marginTop: 24}}>
                  <Scan size={18} /> {isGenerating ? 'Processing...' : 'Generate Smart Schedule'}
               </button>
            ) : (
               <div className="segment-box" style={{marginTop: 24, border: '2px solid var(--primary)', position: 'relative', overflow: 'hidden'}}>
                  <div style={{position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary)'}}></div>
                  <h3 style={{color: 'var(--primary)', display:'flex', alignItems:'center', gap: 8, fontSize: '1.2rem'}}><AlertTriangle size={20}/> Final Confirmation</h3>
                  <div style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: 12, lineHeight: '1.5'}}>
                     You are about to perfectly map <b style={{color:'var(--text-main)'}}>{scannedFiles.length} videos</b> across <b style={{color:'var(--text-main)'}}>{targetPages.length} active targeted pages</b> simultaneously.
                     <br/><br/>
                     <div style={{background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'}}>
                        <div style={{fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 4}}>First Sequence Starts At</div>
                        <div style={{color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8}}>
                           <Clock size={16} color="var(--primary)" /> {startDate && (distType === 'custom_times' || startTime) ? new Date(`${startDate}T${distType === 'custom_times' ? customTimesArray[0] : startTime}:00`).toLocaleString(undefined, {weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : ''}
                        </div>
                     </div>
                  </div>
                  <div style={{display: 'flex', gap: 12, marginTop: 24}}>
                     <button className="btn-dispatch" onClick={() => { setIsConfirming(false); handleGenerate(); }} style={{flex: 1, height: 48, fontSize: '1rem'}}>
                        <Scan size={18} /> Confirm & Deploy
                     </button>
                     <button className="btn-orange" onClick={() => setIsConfirming(false)} style={{width: '120px', height: 48, backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '1rem', padding: 0}}>
                        Cancel
                     </button>
                  </div>
               </div>
            )}
            
            <div style={{marginTop: 24}}>
               <CalendarWidget pipelineState={pipelineState} getPageName={getPageName} />
            </div>
         </div>
      </div>

      {/* NEW SCHEDULED QUEUE TABLE */}
      <div className="v-table-wrapper">
         <div className="v-table-header">
            <div className="v-table-title">
               <Clock size={20} color="var(--primary)" /> Scheduled Queue 
               <span className="badge">{pipelineState.length}</span>
            </div>
            <div style={{display:'flex', gap: '8px'}}>
               <button className="icon-btn" onClick={() => {
                  const allExpanded = Object.keys(expandedBatches).length === Object.keys(groupedTasks).length && Object.values(expandedBatches).every(v => v === true);
                  if (allExpanded) setExpandedBatches({});
                  else {
                     const fresh = {};
                     Object.keys(groupedTasks).forEach(k => fresh[k] = true);
                     setExpandedBatches(fresh);
                  }
               }} style={{marginRight: 16}} title="Toggle Accordions">
                  <ChevronsUpDown size={18}/> <span style={{marginLeft:8, fontSize:'0.85rem', fontWeight:600}}>Toggle All</span>
               </button>
               <button className="icon-btn" onClick={() => clearQueue(null)} style={{color: '#f87171'}} title="Wipe all pages">
                  <AlertTriangle size={18}/> <span style={{marginLeft:8, fontSize:'0.85rem', fontWeight:600}}>Wipe DB</span>
               </button>
               <button className="icon-btn" onClick={fetchQueue}>
                  <RefreshCcw size={18}/> <span style={{marginLeft:8, fontSize:'0.85rem', fontWeight:600}}>Refresh</span>
               </button>
            </div>
         </div>
         
         <table className="v-table">
            <thead>
               <tr>
                  <th style={{width:'40%'}}>Video</th>
                  <th style={{width:'20%'}}>Page</th>
                  <th style={{width:'20%'}}>Scheduled</th>
                  <th style={{width:'10%'}}>Status</th>
                  <th style={{width:'10%', textAlign:'center'}}>Action</th>
               </tr>
            </thead>
            <tbody>
               {pipelineState.length === 0 ? (
                 <tr>
                    <td colSpan="5" style={{textAlign:'center', color:'var(--text-dim)', padding:'40px 0'}}>
                       No tasks found. Pipeline is empty!
                    </td>
                 </tr>
               ) : (
                  <>
                   {Object.keys(groupedTasks).map(pageId => {
                      const pageTasks = groupedTasks[pageId];
                      const pageName = getPageName(pageId);
                      
                      const isExpanded = expandedBatches[pageId] === true;
                      
                      return (
                         <React.Fragment key={pageId}>
                           {/* Parent Batch Row Specific to Page */}
                           <tr className="parent-row" style={{cursor: 'pointer'}} onClick={() => setExpandedBatches(p => ({...p, [pageId]: !p[pageId]}))}>
                              <td colSpan="5" style={{padding:0}}>
                                 <div style={{display:'flex', width:'100%'}}>
                                    <div className="parent-indicator" style={{background: 'var(--primary)'}}></div>
                                    <div style={{flex:1, padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                                       <div className="row-icon-cell" style={{display:'flex', alignItems:'center', gap: 12}}>
                                           {isExpanded ? <ChevronDown size={20} color="var(--primary)"/> : <ChevronRight size={20} color="var(--text-muted)"/>}
                                           <Layers size={18} color="var(--primary)"/> 
                                           <span>📺 {pageName} Batch ({pageTasks.length} Videos)</span>
                                       </div>
                                       <div style={{color:'var(--text-muted)', fontSize:'0.85rem', width:'20%'}}>Targeted Page</div>
                                       <div style={{color:'var(--text-main)', fontSize:'0.85rem', width:'20%'}}>
                                          {pageTasks.length > 0 && new Date(parseInt(pageTasks[0].scheduled_time)).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})} <span style={{color:'var(--text-muted)'}}>(Start)</span>
                                       </div>
                                       <div style={{width:'10%'}}>
                                          <span className="badge" style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)'}}>{pageTasks.length} items</span>
                                       </div>
                                       <div style={{width:'10%', textAlign:'center'}}>
                                          <button className="icon-btn" style={{margin:'0 auto', color: '#f87171'}} onClick={(e) => { e.stopPropagation(); clearQueue(pageId); }} title={`Wipe ${pageName} Batch`}>
                                             <Trash2 size={16}/>
                                          </button>
                                       </div>
                                    </div>
                                 </div>
                              </td>
                           </tr>

                           {/* Child Items for this Page */}
                           {isExpanded && pageTasks.map((j) => (
                              <tr key={j.id} className="child-row">
                                 <td>
                                    <div style={{display:'flex', alignItems:'center'}}>
                                       <div className="dot-connector"></div>
                                       <div>
                                          <div className="child-file-name">{j.message.substring(0, 40)}{j.message.length > 40 ? '...' : ''}</div>
                                          <div className="child-file-path">Folder: {j.media_path.split('\\').slice(-2, -1)}</div>
                                       </div>
                                    </div>
                                 </td>
                                 <td style={{fontSize:'0.85rem', fontWeight: 500, color: 'var(--text-dim)'}}>{pageName}</td>
                                 <td style={{color:'var(--text-main)', fontSize:'0.85rem', fontWeight:500}}>
                                    {editingItemId === j.id ? (
                                       <input 
                                          type="datetime-local" 
                                          value={editingItemTime} 
                                          onChange={(e) => setEditingItemTime(e.target.value)}
                                          style={{
                                             padding:'6px 10px', 
                                             fontSize:'0.85rem', 
                                             background:'rgba(255,255,255,0.05)', 
                                             color: '#ffffff',
                                             border: '1px solid var(--primary)',
                                             borderRadius: '6px',
                                             outline: 'none',
                                             colorScheme: 'dark'
                                          }}
                                       />
                                    ) : (
                                       new Date(parseInt(j.scheduled_time)).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})
                                    )}
                                 </td>
                                 <td>
                                    <div className={`status-badge status-${j.status === 'scheduled' ? 'pending' : (j.status === 'published' ? 'published' : 'error')}`} title={j.error_msg || ''}>
                                       <Clock size={12}/> {j.status === 'failed' ? (j.error_msg && j.error_msg.length < 25 ? `Failed: ${j.error_msg}` : 'Failed') : j.status}
                                    </div>
                                    {j.status === 'failed' && j.error_msg && j.error_msg.length >= 25 && (
                                       <div style={{fontSize: '0.65rem', color: '#f87171', marginTop: '4px', maxWidth: '150px'}}>{j.error_msg}</div>
                                    )}
                                 </td>
                                 <td style={{textAlign:'center'}}>
                                    {editingItemId === j.id ? (
                                       <div style={{display:'flex', gap: 8, justifyContent:'center'}}>
                                          <button className="icon-btn" style={{color:'var(--success)'}} onClick={() => updateItemTime(j.id)}><Check size={16}/></button>
                                          <button className="icon-btn" style={{color:'var(--text-muted)'}} onClick={() => setEditingItemId(null)}><X size={16}/></button>
                                       </div>
                                    ) : (
                                       <div style={{display:'flex', gap: 8, justifyContent:'center'}}>
                                          <button className="icon-btn" style={{color:'var(--primary)'}} onClick={() => {
                                             const tzOffset = (new Date()).getTimezoneOffset() * 60000;
                                             const localISOTime = (new Date(parseInt(j.scheduled_time) - tzOffset)).toISOString().slice(0,16);
                                             setEditingItemTime(localISOTime);
                                             setEditingItemId(j.id);
                                          }}><Edit2 size={16}/></button>
                                          <button className="icon-btn" style={{color:'#f87171'}} onClick={() => deleteItem(j.id)}><Trash2 size={16}/></button>
                                       </div>
                                    )}
                                 </td>
                              </tr>
                           ))}
                         </React.Fragment>
                      );
                   })}
                 </>
               )}
            </tbody>
         </table>
      </div>

    </div>
  );
}
