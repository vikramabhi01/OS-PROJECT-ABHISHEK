const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const si = require('systeminformation');
const cors = require('cors');
<<<<<<< HEAD
const { exec } = require('child_process');
=======
>>>>>>> efbdeb7c43f75d576986abd4211cda642cd7b2ab
const os = require('os');

const app = express();
app.use(cors());
<<<<<<< HEAD
app.use(express.json());

=======
>>>>>>> efbdeb7c43f75d576986abd4211cda642cd7b2ab
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });
const PORT = 4000;

<<<<<<< HEAD
// --- API CONTROLS ---
app.post('/api/run-task', (req, res) => {
    const { command } = req.body;
    exec(`start ${command}`, (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/kill-task/:pid', (req, res) => {
    const pid = req.params.pid;
    exec(`taskkill /F /T /PID ${pid}`, (err, stdout, stderr) => {
        if (err) {
            if (stderr.includes('not found')) return res.json({ success: true });
            return res.status(500).json({ success: false, error: 'Access Denied' });
        }
        res.json({ success: true });
    });
});

// --- DATA ENGINE ---
let staticDataCache = null;
let servicesCache = [];
let lastServiceFetch = 0;

// Mock Data
const MOCK_STARTUP = [
    { name: 'Microsoft Edge', publisher: 'Microsoft Corporation', status: 'Enabled', impact: 'High' },
    { name: 'Spotify', publisher: 'Spotify AB', status: 'Enabled', impact: 'Medium' },
    { name: 'Windows Security', publisher: 'Microsoft Corporation', status: 'Enabled', impact: 'Low' },
    { name: 'Realtek Audio', publisher: 'Realtek', status: 'Enabled', impact: 'High' }
];

const getStaticData = async () => {
    if (staticDataCache) return staticDataCache;
    try {
        const [cpu, mem, disk, net, gpu] = await Promise.all([
            si.cpu(), si.memLayout(), si.diskLayout(), si.networkInterfaces(), si.graphics()
        ]);
        staticDataCache = {
            cpuName: cpu.brand,
            ramName: mem[0]?.type || 'DDR4',
            diskName: disk[0]?.name || 'SSD',
            netName: net.find(n => !n.internal && n.mac)?.ifaceName || 'Ethernet',
            gpuName: gpu.controllers[0]?.model || 'GPU',
            cores: cpu.physicalCores,
            threads: cpu.cores
        };
    } catch (e) {
        staticDataCache = { cpuName: 'Generic CPU', ramName: 'RAM', diskName: 'Disk', netName: 'Ethernet', gpuName: 'GPU', cores: 4, threads: 8 };
    }
    return staticDataCache;
};

const getDynamicData = async () => {
    try {
        // Fetch only lightweight metrics every second
        const [cpuLoad, cpuSpeed, mem, netStats, procs] = await Promise.all([
            si.currentLoad(), 
            si.cpuCurrentSpeed(), 
            si.mem(), 
            si.networkStats(), 
            si.processes()
        ]);

        // OPTIMIZATION: Fetch heavy Services only every 10 seconds to lower CPU usage
        const now = Date.now();
        if (now - lastServiceFetch > 10000) {
            si.services('*').then(s => servicesCache = s.slice(0, 100)).catch(()=>{});
            lastServiceFetch = now;
        }

        const sortedProcs = procs.list.sort((a, b) => b.cpu - a.cpu).slice(0, 50);

        // Simulated App History
        const appHistory = sortedProcs.slice(0, 15).map(p => ({
            name: p.name,
            cpuTime: (p.cpu * 0.5).toFixed(0) + ' min',
            network: (Math.random() * 2).toFixed(1) + ' MB',
            metered: '0 MB',
            tile: '0 MB'
        }));

        // Handle missing users
        let users = [];
        try { users = await si.users(); } catch(e) {}
        if (users.length === 0) users = [{ user: os.userInfo().username || 'Admin' }];

        return {
            performance: {
                cpu: { load: cpuLoad.currentLoad, speed: cpuSpeed.avg, procs: procs.all, handles: procs.all * 15, uptime: os.uptime() },
                mem: { total: mem.total, used: mem.active },
                net: { send: netStats[0]?.tx_sec || 0, recv: netStats[0]?.rx_sec || 0 }
            },
            processes: sortedProcs,
            users: users,
            services: servicesCache,
            startup: MOCK_STARTUP,
            appHistory: appHistory
        };
    } catch (error) { return null; }
};

io.on('connection', async (socket) => {
    const staticD = await getStaticData();
    socket.emit('static-data', staticD);

    const timer = setInterval(async () => {
        const dynamicD = await getDynamicData();
        if(dynamicD) socket.emit('dynamic-data', dynamicD);
=======
// 1. LIGHTWEIGHT Static Data (Hardcoded names to prevent freezing)
const getStaticData = async () => {
    // We only fetch CPU details because they are fast.
    // We skip GPU/Disk scanning which causes the freeze.
    const cpu = await si.cpu();
    
    return {
        cpu: {
            brand: cpu.brand,
            speedBase: cpu.speed,
            cores: cpu.physicalCores,
            logical: cpu.cores,
            l1: 0, l2: 0, l3: 0,
            sockets: cpu.processors
        },
        ram: {
            type: 'DDR4',
            slots: 2,
            formFactor: 'DIMM'
        },
        // Hardcoded names to make it load instantly
        diskName: 'Primary SSD', 
        netName: 'Ethernet / Wi-Fi',
        gpuName: 'Graphics Card' 
    };
};

// 2. Dynamic Data (Only fetching CPU/RAM)
const getDynamicData = async () => {
    // Only fetch CPU and MEM. These are very fast.
    const [cpuLoad, cpuSpeed, mem] = await Promise.all([
        si.currentLoad(), 
        si.cpuCurrentSpeed(), 
        si.mem()
    ]);
    
    // Uptime Calculation
    const sec = os.uptime();
    const d = Math.floor(sec / (3600*24));
    const h = Math.floor(sec % (3600*24) / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = Math.floor(sec % 60);

    return {
        cpu: { 
            load: cpuLoad.currentLoad, 
            speed: cpuSpeed.avg, 
            procs: 150, // Dummy value to save time
            threads: 800, 
            handles: 12000, 
            uptime: `${d}:${h}:${m}:${s}` 
        },
        mem: { 
            total: mem.total, 
            used: mem.active, 
            available: mem.available, 
            committed: mem.used, 
            cached: mem.buffcache 
        },
        disk: { usage: 5 }, // Dummy value
        net: { send: 1024, recv: 2048 }, // Dummy value
        gpu: { util: 15, temp: 45 } // Dummy value
    };
};

io.on('connection', async (socket) => {
    console.log('Client connected. Sending data...');
    
    try {
        const staticData = await getStaticData();
        socket.emit('static-data', staticData);
        console.log('Static Data Sent!'); // Check if you see this log
    } catch (e) {
        console.error('Error sending static:', e);
    }

    const timer = setInterval(async () => {
        try {
            const data = await getDynamicData();
            socket.emit('dynamic-data', data);
        } catch (e) { console.error(e); }
>>>>>>> efbdeb7c43f75d576986abd4211cda642cd7b2ab
    }, 1000);

    socket.on('disconnect', () => clearInterval(timer));
});

server.listen(PORT, () => console.log(`Backend running on ${PORT}`));