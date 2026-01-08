import './style.css';

type Tab = 'dashboard' | 'streams' | 'database';

let currentTab: Tab = 'dashboard';

async function fetchHealth() {
    const res = await fetch('/api/health');
    return res.json();
}

async function fetchStreams() {
    const res = await fetch('/api/streams');
    return res.json();
}

async function fetchWorkouts() {
    const res = await fetch('/api/db/workouts?limit=20');
    return res.json();
}

function renderSidebar() {
    return `
        <nav class="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
            <h1 class="text-2xl font-bold mb-8 text-blue-400">⚡ inspector</h1>
            <ul class="flex-1">
                <li class="mb-2">
                    <button onclick="window.setTab('dashboard')" class="w-full text-left px-4 py-2 rounded transition-colors ${currentTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">
                        📊 Dashboard
                    </button>
                </li>
                <li class="mb-2">
                    <button onclick="window.setTab('streams')" class="w-full text-left px-4 py-2 rounded transition-colors ${currentTab === 'streams' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">
                        🌊 Active Streams
                    </button>
                </li>
                <li class="mb-2">
                    <button onclick="window.setTab('database')" class="w-full text-left px-4 py-2 rounded transition-colors ${currentTab === 'database' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">
                        💾 Database
                    </button>
                </li>
            </ul>
            <div class="text-xs text-gray-500 mt-4">
                Bike Power Tracker<br>
                v1.0.0
            </div>
        </nav>
    `;
}

async function renderDashboard() {
    const health = await fetchHealth();

    const statusBox = (title: string, status: any) => `
        <div class="p-6 rounded-lg shadow-md border ${status.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-bold text-lg text-gray-800">${title}</h3>
                <span class="text-2xl">${status.ok ? '✅' : '❌'}</span>
            </div>
            
            ${status.error ? `<div class="text-red-700 text-sm bg-red-100 p-2 rounded mb-2">${status.error}</div>` : ''}
            
            ${status.details ? `
                <div class="bg-white p-2 rounded border text-xs overflow-auto max-h-32 text-gray-600 font-mono">
                    ${JSON.stringify(status.details, null, 2)}
                </div>
            ` : ''}
            
             ${status.time ? `<p class="text-xs mt-2 text-gray-500 font-mono">Server Time: ${status.time}</p>` : ''}
        </div>
    `;

    return `
        <header class="mb-8">
            <h2 class="text-3xl font-bold text-gray-800">System Health</h2>
            <p class="text-gray-500">Real-time status of service, database, and cache.</p>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            ${statusBox('Service HTTP', health.service)}
            ${statusBox('Redis', health.redis)}
            ${statusBox('Database', health.db)}
        </div>
    `;
}

async function renderStreams() {
    const streams = await fetchStreams();

    if (streams.length === 0) {
        return `
            <header class="mb-8">
                <h2 class="text-3xl font-bold text-gray-800">Active Streams</h2>
            </header>
            <div class="p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                No active streams found in Redis. Start a workout to see data here.
            </div>
        `;
    }

    const rows = streams.map((s: any) => `
        <tr class="border-b last:border-0 hover:bg-gray-50 transition-colors">
            <td class="p-4 font-mono text-blue-600 font-medium">${s.name}</td>
            <td class="p-4 text-gray-700">${s.length.toLocaleString()}</td>
            <td class="p-4 font-mono text-sm text-gray-500">${s.lastId}</td>
            <td class="p-4">
                 <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                </span>
            </td>
        </tr>
    `).join('');

    return `
        <header class="mb-8 flex justify-between items-center">
            <div>
                <h2 class="text-3xl font-bold text-gray-800">Active Streams</h2>
                <p class="text-gray-500">Real-time data streams from connected clients.</p>
            </div>
            <button onclick="window.setTab('streams')" class="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">
                🔄 Refresh
            </button>
        </header>
        <div class="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table class="w-full text-left border-collapse">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stream Name</th>
                        <th class="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Messages</th>
                        <th class="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last ID</th>
                        <th class="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

async function renderDatabase() {
    const workouts = await fetchWorkouts();

    if (workouts.length === 0) {
        return `
            <header class="mb-8">
                <h2 class="text-3xl font-bold text-gray-800">Database Inspection</h2>
            </header>
            <div class="p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                No active workouts found in database.
            </div>
        `;
    }

    const rows = workouts.map((w: any) => `
        <tr class="border-b last:border-0 hover:bg-gray-50 transition-colors">
            <td class="p-4 font-mono text-xs text-gray-500">${w.id}</td>
            <td class="p-4 font-medium text-gray-900">${new Date(w.start_time || w.startTime).toLocaleString()}</td>
            <td class="p-4 text-gray-700">${w.duration || w.totalDuration || '-'} s</td>
            <td class="p-4 text-gray-700">${w.total_distance || w.totalDistance || '-'} m</td>
        </tr>
    `).join('');

    return `
        <header class="mb-8 flex justify-between items-center">
            <div>
                 <h2 class="text-3xl font-bold text-gray-800">Recent Workouts</h2>
                 <p class="text-gray-500">Latest stored sessions from PostgreSQL.</p>
            </div>
            <button onclick="window.setTab('database')" class="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">
                🔄 Refresh
            </button>
        </header>
         <div class="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <table class="w-full text-left border-collapse">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                        <th class="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                        <th class="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Distance</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

async function render() {
    const app = document.getElementById('app');
    if (!app) return;

    // Helper to get loading state
    const loadingHtml = `
        <div class="flex items-center justify-center h-64">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span class="ml-3 text-gray-500">Loading...</span>
        </div>
    `;

    // Only during data fetch
    let contentHtml = loadingHtml;

    // Render the layout first with loading
    app.innerHTML = `
        <div class="flex min-h-screen bg-gray-100 font-sans">
            ${renderSidebar()}
            <main id="main-content" class="flex-1 p-8 overflow-auto">
                 ${contentHtml}
            </main>
        </div>
    `;

    // Fetch data and update content
    try {
        if (currentTab === 'dashboard') contentHtml = await renderDashboard();
        else if (currentTab === 'streams') contentHtml = await renderStreams();
        else if (currentTab === 'database') contentHtml = await renderDatabase();
    } catch (e: any) {
        contentHtml = `
            <div class="bg-red-50 border border-red-200 p-6 rounded-lg text-center">
                <h3 class="text-red-800 font-bold mb-2">Error Loading Data</h3>
                <p class="text-red-600">${e.message}</p>
                <button onclick="window.setTab('${currentTab}')" class="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200">Retry</button>
            </div>
        `;
    }

    // Update just the content area
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.innerHTML = contentHtml;
    }
}

// Global handler
(window as any).setTab = (tab: Tab) => {
    currentTab = tab;
    render();
};

// Initial render
render();
