import './style.css';

type Tab = 'dashboard' | 'streams' | 'database' | 'users' | 'actions';

let currentTab: Tab = 'dashboard';

const SERVICE_URLS = [
    { name: 'Local', url: 'http://localhost:3000' },
    { name: 'Production', url: 'http://78.109.17.187' }
];
let selectedServiceUrl = localStorage.getItem('selectedServiceUrl') || SERVICE_URLS[0].url;
let apiKey = localStorage.getItem('apiKey') || '';

let postRender: (() => void) | null = null;

// Helper to add headers
function getHeaders() {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }
    return headers;
}

function renderHealthCard(title: string, status: any) {
    return `
        <div class="h-full p-6 rounded-lg shadow-md border ${status.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
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
            
             ${status.time ? `<p class="text-xs mt-2 text-gray-500 font-mono">Time: ${status.time}</p>` : ''}
        </div>
    `;
}

function renderLoadingCard(title: string) {
    return `
        <div class="p-6 rounded-lg shadow-md border bg-gray-50 border-gray-200 h-full flex flex-col justify-between">
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-bold text-lg text-gray-800">${title}</h3>
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
            <p class="text-sm text-gray-500">Check in progress...</p>
        </div>
    `;
}

async function performHealthCheck() {
    const serviceEl = document.getElementById('status-service');
    const redisEl = document.getElementById('status-redis');
    const dbEl = document.getElementById('status-db');

    if (!serviceEl || !redisEl || !dbEl) return;

    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${selectedServiceUrl}/health`, {
            headers: getHeaders(),
            signal: controller.signal
        });

        if (!res.ok) {
            throw new Error(`Status ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // Parse the unified response from service
        // Service returns: { status: 'ok', redis: 'connected', database: 'connected', timestamp: ... }

        serviceEl.innerHTML = renderHealthCard(`Service HTTP <span class="block text-xs font-normal text-gray-500 mt-1 truncate" title="${selectedServiceUrl}">${selectedServiceUrl}</span>`, {
            ok: data.status === 'ok' || data.status === 'degraded',
            time: data.timestamp,
            details: { url: selectedServiceUrl }
        });

        redisEl.innerHTML = renderHealthCard('Redis', {
            ok: data.redis === 'connected',
            details: { status: data.redis }
        });

        dbEl.innerHTML = renderHealthCard('Database', {
            ok: data.database === 'connected',
            details: { status: data.database }
        });

    } catch (e: any) {
        const err = { ok: false, error: e.message };
        serviceEl.innerHTML = renderHealthCard('Service HTTP', err);
        redisEl.innerHTML = renderHealthCard('Redis', { ok: false, error: 'Dependent on Service' });
        dbEl.innerHTML = renderHealthCard('Database', { ok: false, error: 'Dependent on Service' });
    }
}

async function fetchStreams() {
    const res = await fetch(`${selectedServiceUrl}/api/streams`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}

async function fetchWorkouts() {
    const res = await fetch(`${selectedServiceUrl}/api/workouts?limit=20`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.workouts || data; // Handle pagination wrapper if exists
}

type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PATCH';

async function callApi(path: string, method: HttpMethod = 'GET', body?: any) {
    const url = `${selectedServiceUrl}${path}`;
    const options: RequestInit = {
        method,
        headers: getHeaders(),
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
}


function renderUsers() {
    return `
        <header class="mb-8">
            <h2 class="text-3xl font-bold text-gray-800">User Inspector</h2>
            <p class="text-gray-500">Lookup user profiles and statistics</p>
        </header>
        
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <div class="flex gap-4">
                <input type="text" id="user-id-input" placeholder="Enter User ID (UUID)" class="flex-1 border p-2 rounded">
                <button onclick="window.lookupUser()" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">Lookup</button>
            </div>
        </div>

        <div id="user-result" class="hidden space-y-6">
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="bg-gray-50 px-6 py-4 border-b">
                    <h3 class="text-lg font-medium text-gray-900">Profile</h3>
                </div>
                <div class="p-6">
                    <pre id="user-profile-data" class="bg-gray-900 text-green-400 p-4 rounded overflow-auto text-sm font-mono"></pre>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="bg-gray-50 px-6 py-4 border-b">
                     <h3 class="text-lg font-medium text-gray-900">Statistics</h3>
                </div>
                 <div class="p-6">
                    <pre id="user-stats-data" class="bg-gray-900 text-green-400 p-4 rounded overflow-auto text-sm font-mono"></pre>
                </div>
            </div>
        </div>
    `;
}

function renderActions() {
    return `
        <header class="mb-8">
            <h2 class="text-3xl font-bold text-gray-800">API Tester</h2>
            <p class="text-gray-500">Manually execute requests against the Service API</p>
        </header>

        <div class="bg-white rounded-lg shadow p-6 mb-8">
            <div class="grid grid-cols-12 gap-4 mb-4">
                <div class="col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Method</label>
                    <select id="api-method" class="w-full border p-2 rounded bg-gray-50">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
                <div class="col-span-10">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Path</label>
                    <div class="flex">
                        <span class="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                            /api
                        </span>
                        <input type="text" id="api-path" placeholder="/streams" class="flex-1 border p-2 rounded-r-md">
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Request Body (JSON)</label>
                <textarea id="api-body" rows="5" class="w-full border p-2 rounded font-mono text-sm" placeholder="{ &quot;key&quot;: &quot;value&quot; }"></textarea>
            </div>

            <button onclick="window.executeApiRequest()" class="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition-colors">
                Send Request 🚀
            </button>
        </div>

        <div id="api-result" class="hidden bg-white rounded-lg shadow overflow-hidden">
             <div class="bg-gray-800 px-6 py-2 flex justify-between items-center">
                <span class="text-gray-300 text-sm font-mono">Response</span>
                <span id="api-status-badge" class="px-2 py-1 rounded text-xs font-bold bg-gray-600 text-white">---</span>
            </div>
            <div class="p-0">
                <pre id="api-response-data" class="bg-gray-900 text-green-400 p-6 overflow-auto text-sm font-mono max-h-96"></pre>
            </div>
        </div>
    `;
}

function renderSidebar() {
    const options = SERVICE_URLS.map(s =>
        `<option value="${s.url}" ${s.url === selectedServiceUrl ? 'selected' : ''}>${s.name}</option>`
    ).join('');

    return `
        <nav class="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col overflow-y-auto">
            <h1 class="text-2xl font-bold mb-8 text-blue-400">⚡ inspector</h1>
            
            <div class="mb-6 space-y-4">
                 <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Service Target</label>
                    <select onchange="window.setServiceUrl(this.value)" class="w-full bg-gray-800 text-white text-sm rounded border border-gray-700 p-2 focus:border-blue-500 focus:outline-none">
                        ${options}
                    </select>
                 </div>
                 
                 <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-2">API Key (Optional)</label>
                    <input type="password" 
                           value="${apiKey}" 
                           onchange="window.setApiKey(this.value)" 
                           placeholder="Enter X-API-Key"
                           class="w-full bg-gray-800 text-white text-sm rounded border border-gray-700 p-2 focus:border-blue-500 focus:outline-none">
                 </div>
            </div>

            <ul class="flex-1 space-y-1">
                <li>
                    <button onclick="window.setTab('dashboard')" class="w-full text-left px-4 py-2 rounded transition-colors ${currentTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">
                        📊 Dashboard
                    </button>
                </li>
                 <li class="pt-4 pb-2">
                    <span class="px-4 text-xs font-bold text-gray-500 uppercase">Inspection</span>
                </li>
                <li>
                    <button onclick="window.setTab('streams')" class="w-full text-left px-4 py-2 rounded transition-colors ${currentTab === 'streams' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">
                        🌊 Active Streams
                    </button>
                </li>
                <li>
                    <button onclick="window.setTab('database')" class="w-full text-left px-4 py-2 rounded transition-colors ${currentTab === 'database' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">
                        💾 Database
                    </button>
                </li>
                <li>
                    <button onclick="window.setTab('users')" class="w-full text-left px-4 py-2 rounded transition-colors ${currentTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">
                        👤 Users
                    </button>
                </li>
                 <li class="pt-4 pb-2">
                    <span class="px-4 text-xs font-bold text-gray-500 uppercase">Actions</span>
                </li>
                <li>
                    <button onclick="window.setTab('actions')" class="w-full text-left px-4 py-2 rounded transition-colors ${currentTab === 'actions' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}">
                        ⚡ API Tester
                    </button>
                </li>
            </ul>
            <div class="text-xs text-gray-500 mt-4">
                Bike Power Tracker<br>
                v1.1.0 (Client Only)
            </div>
        </nav>
    `;
}

function renderDashboard() {
    // Set up post-render actions
    postRender = () => {
        performHealthCheck();
    };

    return `
        <header class="mb-8 flex justify-between items-center">
            <div>
                <h2 class="text-3xl font-bold text-gray-800">System Health</h2>
                <p class="text-gray-500">Real-time status from <span class="font-mono bg-gray-200 px-1 rounded">${selectedServiceUrl}</span></p>
            </div>
            <button onclick="window.performHealthCheck()" class="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 text-sm">
                🔄 Refresh
            </button>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div id="status-service" class="h-full">${renderLoadingCard('Service HTTP')}</div>
            <div id="status-redis" class="h-full">${renderLoadingCard('Redis')}</div>
            <div id="status-db" class="h-full">${renderLoadingCard('Database')}</div>
        </div>
    `;
}

async function renderStreams() {
    try {
        const streams = await fetchStreams();

        if (streams.length === 0) {
            return `
                <header class="mb-8">
                    <h2 class="text-3xl font-bold text-gray-800">Active Streams</h2>
                </header>
                <div class="p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                    No active streams found directly on Service.
                </div>
            `;
        }

        const rows = streams.map((s: any) => `
            <tr class="border-b last:border-0 hover:bg-gray-50 transition-colors">
                <td class="p-4 font-mono text-blue-600 font-medium">${s.name}</td>
                <td class="p-4 text-gray-700">${s.length?.toLocaleString() || '-'}</td>
                <td class="p-4 font-mono text-sm text-gray-500">${s.lastEntry?.[0]?.id || '-'}</td>
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
                    <p class="text-gray-500">Fetched via API from ${selectedServiceUrl}</p>
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
    } catch (e: any) {
        return `
            <div class="bg-red-50 border border-red-200 p-6 rounded-lg text-center">
                 <h3 class="text-red-800 font-bold mb-2">Error Fetching Streams</h3>
                 <p class="text-red-600">${e.message}</p>
                 <p class="text-sm mt-2 text-gray-500">Check your API Key if authentication is required.</p>
                 <button onclick="window.setTab('streams')" class="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200">Retry</button>
            </div>
        `;
    }
}

async function renderDatabase() {
    try {
        const workouts = await fetchWorkouts();

        if (workouts.length === 0) {
            return `
                <header class="mb-8">
                    <h2 class="text-3xl font-bold text-gray-800">Recent Workouts</h2>
                </header>
                <div class="p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                    No active workouts found in database via API.
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
                     <p class="text-gray-500">Latest stored sessions from ${selectedServiceUrl}</p>
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
    } catch (e: any) {
        return `
            <div class="bg-red-50 border border-red-200 p-6 rounded-lg text-center">
                 <h3 class="text-red-800 font-bold mb-2">Error Fetching Workouts</h3>
                 <p class="text-red-600">${e.message}</p>
                 <p class="text-sm mt-2 text-gray-500">Check your API Key if authentication is required.</p>
                 <button onclick="window.setTab('database')" class="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200">Retry</button>
            </div>
        `;
    }
}

async function render() {
    const app = document.getElementById('app');
    if (!app) return;

    postRender = null;

    // Helper to get loading state
    const loadingHtml = `
        <div class="flex items-center justify-center h-64">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span class="ml-3 text-gray-500">Loading...</span>
        </div>
    `;

    // Only during data fetch - but here we fetch async in render function so we don't block
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
        else if (currentTab === 'users') contentHtml = renderUsers();
        else if (currentTab === 'actions') contentHtml = renderActions();
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
        if (postRender) {
            (postRender as () => void)();
        }
    }
}

// Global handlers
(window as any).setTab = (tab: Tab) => {
    currentTab = tab;
    render();
};

(window as any).setServiceUrl = (url: string) => {
    selectedServiceUrl = url;
    localStorage.setItem('selectedServiceUrl', url);
    render();
};

(window as any).setApiKey = (key: string) => {
    apiKey = key;
    localStorage.setItem('apiKey', key);
    // Silent update, no re-render needed optionally, but good to refresh if on data tab
    if (currentTab !== 'dashboard') {
        render();
    }
};

(window as any).performHealthCheck = () => {
    // Reset to loading state before fetching
    const serviceEl = document.getElementById('status-service');
    const redisEl = document.getElementById('status-redis');
    const dbEl = document.getElementById('status-db');

    if (serviceEl) serviceEl.innerHTML = renderLoadingCard('Service HTTP');
    if (redisEl) redisEl.innerHTML = renderLoadingCard('Redis');
    if (dbEl) dbEl.innerHTML = renderLoadingCard('Database');

    performHealthCheck();
};

(window as any).lookupUser = async () => {
    const input = document.getElementById('user-id-input') as HTMLInputElement;
    const userId = input.value.trim();
    if (!userId) {
        alert('Please enter a User ID');
        return;
    }

    const resultDiv = document.getElementById('user-result');
    const profilePre = document.getElementById('user-profile-data');
    const statsPre = document.getElementById('user-stats-data');

    if (resultDiv) resultDiv.classList.remove('hidden');
    if (profilePre) profilePre.textContent = 'Loading...';
    if (statsPre) statsPre.textContent = 'Loading...';

    try {
        const [profile, stats] = await Promise.all([
            callApi(`/api/users/${userId}`),
            callApi(`/api/users/${userId}/stats`)
        ]);

        if (profilePre) {
            profilePre.textContent = JSON.stringify(profile.data, null, 2);
            if (!profile.ok) profilePre.className = 'bg-red-900 text-red-200 p-4 rounded overflow-auto text-sm font-mono';
            else profilePre.className = 'bg-gray-900 text-green-400 p-4 rounded overflow-auto text-sm font-mono';
        }

        if (statsPre) {
            statsPre.textContent = JSON.stringify(stats.data, null, 2);
            if (!stats.ok) statsPre.className = 'bg-red-900 text-red-200 p-4 rounded overflow-auto text-sm font-mono';
            else statsPre.className = 'bg-gray-900 text-green-400 p-4 rounded overflow-auto text-sm font-mono';
        }
    } catch (e: any) {
        if (profilePre) profilePre.textContent = 'Error: ' + e.message;
    }
};

(window as any).executeApiRequest = async () => {
    const methodEl = document.getElementById('api-method') as HTMLSelectElement;
    const pathEl = document.getElementById('api-path') as HTMLInputElement;
    const bodyEl = document.getElementById('api-body') as HTMLTextAreaElement;

    const method = methodEl.value as HttpMethod;
    const path = '/api' + (pathEl.value.startsWith('/') ? pathEl.value : '/' + pathEl.value);

    let body = undefined;
    if (bodyEl.value.trim() && method !== 'GET') {
        try {
            body = JSON.parse(bodyEl.value);
        } catch (e) {
            alert('Invalid JSON in request body');
            return;
        }
    }

    const resultDiv = document.getElementById('api-result');
    const statusBadge = document.getElementById('api-status-badge');
    const responsePre = document.getElementById('api-response-data');

    if (resultDiv) resultDiv.classList.remove('hidden');
    if (responsePre) responsePre.textContent = 'Sending...';

    const startTime = performance.now();
    try {
        const res = await callApi(path, method, body);
        const duration = Math.round(performance.now() - startTime);

        if (responsePre) responsePre.textContent = JSON.stringify(res.data, null, 2);

        if (statusBadge) {
            statusBadge.textContent = `${res.status} ${res.ok ? 'OK' : 'Error'} (${duration}ms)`;
            statusBadge.className = res.ok
                ? 'px-2 py-1 rounded text-xs font-bold bg-green-600 text-white'
                : 'px-2 py-1 rounded text-xs font-bold bg-red-600 text-white';
        }
    } catch (e: any) {
        if (responsePre) responsePre.textContent = 'Network Error: ' + e.message;
        if (statusBadge) {
            statusBadge.textContent = 'Network Error';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-red-600 text-white';
        }
    }
};

// Initial render
render();
