import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { VscListFlat, VscGraph, VscHistory, VscExtensions, VscAccount, VscListSelection, VscGear, VscMenu, VscSettingsGear, VscPlay, VscChromeClose, VscChromeMaximize, VscChromeMinimize, VscEllipsis } from "react-icons/vsc";
import { MdMemory, MdOutlineSdStorage, MdOutlineWifi, MdDeveloperBoard, MdSearch } from "react-icons/md";
import { RiCpuLine } from "react-icons/ri";
import taskIcon from './task.png'; 

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);
const socket = io('http://localhost:4000');

const fmtBytes = (b) => {
    if (!b || b === 0) return '0 MB';
    if (b > 1024*1024*1024) return (b / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
};

function App() {
  const [staticD, setStaticD] = useState(null);
  const [data, setData] = useState(null);
  const [activePage, setActivePage] = useState('processes');
  const [perfTab, setPerfTab] = useState('cpu');
  const [selectedRow, setSelectedRow] = useState(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runCommand, setRunCommand] = useState('');
  
  // History Buffers (60 seconds)
  const hist = useRef({ cpu: new Array(60).fill(0), mem: new Array(60).fill(0) });
  const [, forceUpdate] = useState({});

  useEffect(() => {
    socket.on('static-data', setStaticD);
    socket.on('dynamic-data', (d) => {
        setData(d);
        // Shift and Push logic for smooth scrolling
        hist.current.cpu.push(d.performance.cpu.load);
        hist.current.cpu.shift();
        
        const memPercent = (d.performance.mem.used / d.performance.mem.total) * 100;
        hist.current.mem.push(memPercent);
        hist.current.mem.shift();
        
        forceUpdate({});
    });
    return () => { socket.off('static-data'); socket.off('dynamic-data'); };
  }, []);

  // --- GRAPH SETTINGS ---
  const getGraphData = (key, color) => ({
      labels: Array(60).fill(''),
      datasets: [{
          data: hist.current[key],
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0, // No dots, just line
          fill: true,
          tension: 0.35, // Smooth curves
          backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 300);
              gradient.addColorStop(0, color + '66'); // 40% opacity at top
              gradient.addColorStop(1, 'transparent'); // 0% opacity at bottom
              return gradient;
          },
      }]
  });

  const graphOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 }, // Instant update for real-time feel
      scales: {
          x: { display: false },
          y: { min: 0, max: 100, grid: { color: '#333' }, ticks: { display: false } }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      interaction: { mode: 'none' } // Disable hover tooltips for speed
  };

  const handleEndTask = async () => {
    if (!selectedRow) return;
    try {
        const res = await fetch(`http://localhost:4000/api/kill-task/${selectedRow}`, { method: 'POST' });
        const json = await res.json();
        if (json.success) setSelectedRow(null);
        else alert("Access Denied: System Process");
    } catch (e) { alert("Connection Failed"); }
  };

  const handleRunTask = async () => {
      if (!runCommand) return;
      await fetch('http://localhost:4000/api/run-task', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: runCommand })
      });
      setShowRunModal(false); setRunCommand('');
  };

  if (!staticD || !data) return <div style={styles.loading}>Connecting to System...</div>;

  // --- RENDERERS ---

  const renderProcesses = () => (
      <div style={styles.tableContainer} onClick={() => setSelectedRow(null)}>
          <div style={styles.tableHeader}>
              <div style={{...styles.colName, flex: 3}}>Name</div>
              <div style={styles.col}>Status</div>
              <div style={styles.col}>CPU</div>
              <div style={styles.col}>Memory</div>
              <div style={styles.col}>Disk</div>
              <div style={styles.col}>Network</div>
          </div>
          {data.processes.map((proc) => {
              const isSel = selectedRow === proc.pid;
              return (
                 <div key={proc.pid} onClick={(e) => { e.stopPropagation(); setSelectedRow(proc.pid); }}
                    style={{...styles.tableRow, background: isSel ? '#0078d4' : 'transparent', color: isSel ? 'white' : 'inherit'}}>
                    <div style={{...styles.colName, flex: 3, color:'inherit'}}><span style={styles.iconBox}></span> {proc.name}</div>
                    <div style={styles.col}>{proc.state === 'running' ? '' : 'Suspended'}</div>
                    <div style={{...styles.col, background: (!isSel && proc.cpu > 5) ? '#4d2a00' : 'transparent', color: (!isSel && proc.cpu > 5) ? '#ffaa00' : 'inherit'}}>{proc.cpu.toFixed(1)}%</div>
                    <div style={{...styles.col, background: (!isSel && proc.mem > 5) ? '#363636' : 'transparent'}}>{fmtBytes(proc.memRss)}</div>
                    <div style={styles.col}>0 MB/s</div><div style={styles.col}>0 Mbps</div>
                 </div>
              );
          })}
      </div>
  );

  const renderPerformance = () => {
      const isCpu = perfTab === 'cpu';
      const color = isCpu ? '#00b7c3' : '#8661c5';
      
      return (
        <div style={{display:'flex', height:'100%'}}>
            <div style={styles.perfSidebar}>
                <PerfItem active={isCpu} onClick={()=>setPerfTab('cpu')} title="CPU" sub={staticD.cpuName} val={`${data.performance.cpu.load.toFixed(0)}%`} color="#00b7c3" Icon={RiCpuLine} />
                <PerfItem active={!isCpu} onClick={()=>setPerfTab('mem')} title="Memory" sub={`${(data.performance.mem.used / 1024 / 1024 / 1024).toFixed(1)} GB`} val={`${((data.performance.mem.used / data.performance.mem.total)*100).toFixed(0)}%`} color="#8661c5" Icon={MdMemory} />
                <PerfItem active={false} title="Disk 0 (C:)" sub={staticD.diskName} val="0%" color="#4cc94c" Icon={MdOutlineSdStorage} />
                <PerfItem active={false} title="Wi-Fi" sub={staticD.netName} val={`R: 0 Kbps`} color="#d13438" Icon={MdOutlineWifi} />
            </div>
            <div style={{flex:1, padding:'20px', display:'flex', flexDirection:'column'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', alignItems:'baseline'}}>
                    <h2 style={{margin:0, fontWeight:400}}>{isCpu ? 'CPU' : 'Memory'}</h2>
                    <div style={{color:'#aaa', fontSize:'14px'}}>{isCpu ? staticD.cpuName : staticD.ramName}</div>
                </div>
                {/* GRAPH BOX */}
                <div style={{flex:1, border:'1px solid #333', background:'#191919', padding:'10px', borderRadius:'4px', position:'relative'}}>
                    <div style={{position:'absolute', top:10, right:10, color}}>{isCpu ? '100% Usage' : fmtBytes(data.performance.mem.total)}</div>
                    <Line data={getGraphData(isCpu?'cpu':'mem', color)} options={graphOptions} />
                </div>
                {/* METRICS */}
                <div style={styles.metricsGrid}>
                    {isCpu ? (
                        <>
                            <MetricBox label="Utilization" val={`${data.performance.cpu.load.toFixed(0)}%`} />
                            <MetricBox label="Speed" val={`${data.performance.cpu.speed.toFixed(2)} GHz`} />
                            <MetricBox label="Processes" val={data.performance.cpu.procs} />
                            <MetricBox label="Threads" val={data.performance.cpu.procs * 9} />
                            <MetricBox label="Up time" val={(data.performance.cpu.uptime / 3600).toFixed(0) + ":14:22"} />
                        </>
                    ) : (
                        <>
                            <MetricBox label="In use" val={fmtBytes(data.performance.mem.used)} />
                            <MetricBox label="Available" val={fmtBytes(data.performance.mem.available)} />
                            <MetricBox label="Committed" val={`${fmtBytes(data.performance.mem.used)} / ${fmtBytes(data.performance.mem.total + 2e9)}`} />
                        </>
                    )}
                </div>
            </div>
        </div>
      );
  };

  // Reusing Logic for other tabs
  const renderSimpleTable = (items, cols) => (
      <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
              {cols.map((c, i) => <div key={i} style={i===0?{...styles.colName, flex:3}:styles.col}>{c}</div>)}
          </div>
          {items.map((item, i) => (
             <div key={i} style={styles.tableRow}>
                {Object.values(item).map((v, j) => <div key={j} style={j===0?{...styles.colName, flex:3}:styles.col}>{v}</div>)}
             </div>
          ))}
      </div>
  );

  return (
    <div style={styles.appContainer}>
      {showRunModal && (
        <div style={styles.modalOverlay}>
            <div style={styles.modal}>
                <div style={styles.modalHeader}>Run new task <VscChromeClose style={{cursor:'pointer'}} onClick={()=>setShowRunModal(false)}/></div>
                <div style={{padding:'20px'}}>
                    <p style={{fontSize:'12px', marginBottom:'10px'}}>Type the name of a program to open it.</p>
                    <input autoFocus type="text" style={styles.runInput} value={runCommand} onChange={(e)=>setRunCommand(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRunTask()}/>
                    <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'20px'}}>
                        <button style={styles.btnSecondary} onClick={()=>setShowRunModal(false)}>Cancel</button>
                        <button style={styles.btnPrimary} onClick={handleRunTask}>OK</button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {/* TITLE BAR */}
      <div style={styles.titleBar}>
          <div style={styles.titleLeft}><img src={taskIcon} width="16" style={{marginRight:'10px'}} alt="icon" /> Task Manager</div>
          <div style={styles.windowControls}>
              <VscChromeMinimize style={styles.winBtn} /><VscChromeMaximize style={styles.winBtn} /><VscChromeClose style={{...styles.winBtn, ':hover':{background:'red'}}} />
          </div>
      </div>

      <div style={{display:'flex', flex:1, overflow:'hidden'}}>
          {/* SIDEBAR */}
          <div style={styles.sidebar}>
              <div style={{padding:'15px', marginBottom:'5px'}}><VscMenu size={18} /></div>
              <SideBtn id="processes" Icon={VscListFlat} active={activePage} onClick={setActivePage} />
              <SideBtn id="performance" Icon={VscGraph} active={activePage} onClick={setActivePage} />
              <SideBtn id="apphistory" Icon={VscHistory} active={activePage} onClick={setActivePage} />
              <SideBtn id="startup" Icon={VscExtensions} active={activePage} onClick={setActivePage} />
              <SideBtn id="users" Icon={VscAccount} active={activePage} onClick={setActivePage} />
              <SideBtn id="details" Icon={VscListSelection} active={activePage} onClick={setActivePage} />
              <SideBtn id="services" Icon={VscGear} active={activePage} onClick={setActivePage} />
          </div>

          {/* CONTENT */}
          <div style={styles.content}>
              <h2 style={styles.pageTitle}>{activePage.charAt(0).toUpperCase() + activePage.slice(1)}</h2>
              <TopBar onRun={()=>setShowRunModal(true)} onKill={handleEndTask} canKill={!!selectedRow} />
              <div style={styles.contentBody}>
                  {activePage === 'processes' && renderProcesses()}
                  {activePage === 'performance' && renderPerformance()}
                  {/* Reuse renderSimpleTable for static tabs to save space */}
                  {activePage === 'startup' && renderSimpleTable(data.startup, ['Name','Publisher','Status','Impact'])}
                  {activePage === 'apphistory' && renderSimpleTable(data.appHistory, ['Name','CPU Time','Network','Metered','Tile'])}
                  {activePage === 'users' && renderSimpleTable(data.users.map(u=>({u:u.user,s:'Active',c:'1%',m:'200MB',d:'0',n:'0'})), ['User','Status','CPU','Memory','Disk','Network'])}
                  {activePage === 'details' && renderProcesses()} 
                  {activePage === 'services' && renderSimpleTable(data.services.map(s=>({n:s.name,p:s.pid,d:s.caption,s:s.running?'Running':'Stopped',g:'LocalSystem'})), ['Name','PID','Description','Status','Group'])}
              </div>
          </div>
      </div>
    </div>
  );
}

// --- SUB COMPONENTS ---
const TopBar = ({ onRun, onKill, canKill }) => (
    <div style={styles.topBar}>
        <div style={styles.searchContainer}>
            <MdSearch size={20} color="#a0a0a0" style={{marginLeft:'10px'}} />
            <input type="text" placeholder="Type name, publisher, or PID" style={styles.searchInput} />
        </div>
        <div style={styles.commandBar}>
            <CommandBtn Icon={VscPlay} text="Run new task" onClick={onRun} />
            <div style={styles.divider}></div>
            <CommandBtn text="End task" disabled={!canKill} onClick={onKill} />
            <div style={styles.divider}></div>
            <VscEllipsis size={20} style={{padding:'0 10px', cursor:'pointer'}} />
        </div>
    </div>
);

const SideBtn = ({ id, Icon, active, onClick }) => (
    <div onClick={()=>onClick(id)} style={{...styles.sideBtn, borderLeft: active===id ? '3px solid #00b7c3' : '3px solid transparent', background: active===id ? '#3c3c3c' : 'transparent'}}>
        <Icon size={20} color={active===id ? '#00b7c3' : '#e0e0e0'} />
    </div>
);

const PerfItem = ({ active, title, sub, val, color, Icon, onClick }) => (
    <div onClick={onClick} style={{padding:'12px 10px', marginBottom:'2px', cursor:'pointer', background: active ? '#2d2d2d' : 'transparent', borderRadius:'4px', display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', alignItems:'center', marginBottom:'4px'}}>
            <div style={{width:'4px', height:'16px', background: active ? color : 'transparent', marginRight:'8px', borderRadius:'2px'}}></div>
            <Icon color={color} size={18} style={{marginRight:'8px'}}/> <span style={{fontWeight:'600', fontSize:'13px'}}>{title}</span>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', paddingLeft:'20px'}}>
             <div style={{fontSize:'12px', color:'#aaa'}}>{sub?.substring(0, 15)}</div>
             <div style={{fontSize:'13px'}}>{val}</div>
        </div>
    </div>
);

const CommandBtn = ({ Icon, text, disabled, onClick }) => (
    <div onClick={!disabled?onClick:null} style={{display:'flex', alignItems:'center', padding:'6px 12px', margin:'0 2px', cursor: disabled?'default':'pointer', opacity: disabled?0.4:1, borderRadius:'4px', ':hover':{background:'#3c3c3c'}}}>
        {Icon && <Icon style={{marginRight:'6px'}} />}<span style={{fontSize:'13px'}}>{text}</span>
    </div>
);

const MetricBox = ({ label, val }) => (<div style={{marginBottom:'15px'}}><div style={{fontSize:'12px', color:'#aaa', marginBottom:'2px'}}>{label}</div><div style={{fontSize:'18px'}}>{val}</div></div>);

const styles = {
    loading: { height: '100vh', background: '#202020', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center' },
    appContainer: { display: 'flex', flexDirection:'column', height: '100vh', background: '#202020', color: '#ffffff', fontFamily: '"Segoe UI Variable", "Segoe UI", sans-serif', overflow:'hidden', userSelect:'none' },
    titleBar: { height: '32px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'12px', background:'#202020' },
    titleLeft: { display:'flex', alignItems:'center', paddingLeft:'10px' },
    windowControls: { display:'flex' }, winBtn: { padding:'8px 15px', cursor:'pointer' },
    sidebar: { width: '48px', background: '#2c2c2c', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '5px' },
    sideBtn: { width: '40px', height:'40px', margin:'2px 0', display: 'flex', justifyContent: 'center', alignItems:'center', cursor: 'pointer', borderRadius:'4px' },
    content: { flex: 1, padding: '0', display: 'flex', flexDirection: 'column', background:'#202020' },
    pageTitle: { fontSize: '20px', fontWeight: '600', margin: '15px 0 10px 20px' },
    topBar: { display:'flex', justifyContent:'space-between', padding:'0 20px 10px 20px', alignItems:'center' },
    searchContainer: { display:'flex', alignItems:'center', background:'#2d2d2d', borderRadius:'4px', width:'300px', height:'32px', border:'1px solid #3c3c3c' },
    searchInput: { background:'transparent', border:'none', color:'white', marginLeft:'10px', outline:'none', width:'100%', fontSize:'13px' },
    commandBar: { display:'flex', alignItems:'center' }, divider: { width:'1px', height:'16px', background:'#444', margin:'0 10px' },
    contentBody: { flex: 1, overflow: 'hidden', background:'#202020', borderTop:'1px solid #2d2d2d' },
    tableContainer: { height: '100%', overflowY: 'auto', fontSize: '12px' },
    tableHeader: { display: 'flex', borderBottom: '1px solid #2d2d2d', background:'#202020', position:'sticky', top:0, zIndex:10 },
    colName: { padding:'8px 10px', borderRight:'1px solid #2d2d2d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color:'#a0a0a0', fontWeight:'400' },
    col: { flex: 1, textAlign: 'right', padding:'8px 10px', borderRight:'1px solid #2d2d2d', color:'#e0e0e0' },
    tableRow: { display: 'flex', borderBottom: '1px solid #2a2a2a', alignItems:'center', cursor:'default', height:'36px' },
    iconBox: { display:'inline-block', width:'16px', height:'16px', background:'#0078d4', borderRadius:'2px', marginRight:'8px', verticalAlign:'middle'},
    perfSidebar: { width:'260px', overflowY:'auto', borderRight:'1px solid #2a2a2a', paddingRight:'5px' },
    metricsGrid: { marginTop:'20px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:'20px' },
    modalOverlay: { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', justifyContent:'center', alignItems:'center' },
    modal: { width:'400px', background:'#2b2b2b', borderRadius:'8px', border:'1px solid #454545', boxShadow:'0 10px 30px rgba(0,0,0,0.5)', color:'white' },
    modalHeader: { padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'14px', fontWeight:'600' },
    runInput: { width:'100%', padding:'8px', background:'#202020', border:'1px solid #454545', color:'white', borderRadius:'4px', outline:'none', marginTop:'5px' },
    btnPrimary: { padding:'6px 20px', background:'#0078d4', border:'none', borderRadius:'4px', color:'white', cursor:'pointer' },
    btnSecondary: { padding:'6px 20px', background:'#3c3c3c', border:'1px solid #454545', borderRadius:'4px', color:'white', cursor:'pointer' }
};

export default App;