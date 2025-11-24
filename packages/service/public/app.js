let currentStream = null;
let eventSource = null;

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

async function createStream() {
    const streamName = document.getElementById('newStreamName').value.trim();

    if (!streamName) {
        showStatus('Please enter a session name', 'error');
        return;
    }

    try {
        const response = await fetch('/api/streams/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streamName })
        });

        const data = await response.json();

        if (data.success) {
            showStatus(`Session "${streamName}" created successfully!`, 'success');
            document.getElementById('newStreamName').value = '';
            await loadStreams();
            selectStream(streamName);
        } else {
            showStatus(data.error || 'Failed to create session', 'error');
        }
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
}

async function loadStreams() {
    try {
        const response = await fetch('/api/streams');
        const data = await response.json();

        const streamList = document.getElementById('streamList');

        if (data.streams.length === 0) {
            streamList.innerHTML = '<div class="empty-state">No sessions yet</div>';
            return;
        }

        streamList.innerHTML = data.streams.map(stream => `
            <li class="stream-item ${currentStream === stream.name ? 'active' : ''}" 
                onclick="selectStream('${stream.name}')">
                <div class="stream-name">${stream.name}</div>
                <div class="stream-info">${stream.length} data points</div>
            </li>
        `).join('');
    } catch (error) {
        showStatus('Error loading sessions: ' + error.message, 'error');
    }
}

function selectStream(streamName) {
    currentStream = streamName;

    // Stop listening to previous stream
    if (eventSource) {
        eventSource.close();
        eventSource = null;
        document.getElementById('listeningBadge').style.display = 'none';
    }

    document.getElementById('currentStreamName').textContent = streamName;
    document.getElementById('streamDetails').style.display = 'block';
    document.getElementById('noStreamSelected').style.display = 'none';

    // Update active state in sidebar
    document.querySelectorAll('.stream-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.stream-item')?.classList.add('active');

    loadMessages();
}

async function loadMessages() {
    if (!currentStream) return;

    try {
        const response = await fetch(`/api/streams/${currentStream}/messages`);
        const data = await response.json();

        const container = document.getElementById('messagesContainer');

        if (data.messages.length === 0) {
            container.innerHTML = '<div class="empty-state">No data yet</div>';
            return;
        }

        container.innerHTML = data.messages.map(msg => `
            <div class="message">
                <div class="message-header">
                    <span class="message-author">Metrics</span>
                    <span>${new Date(parseInt(msg.data.timestamp)).toLocaleString()}</span>
                </div>
                <div class="message-content">
                    <strong>HR:</strong> ${msg.data.heartrate || 'N/A'} bpm | 
                    <strong>Cadence:</strong> ${msg.data.cadence || 'N/A'} rpm | 
                    <strong>Power:</strong> ${msg.data.power || 'N/A'} W
                </div>
            </div>
        `).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        showStatus('Error loading data: ' + error.message, 'error');
    }
}

async function sendMessage() {
    if (!currentStream) return;

    const heartrate = document.getElementById('heartrate').value.trim();
    const cadence = document.getElementById('cadence').value.trim();
    const power = document.getElementById('power').value.trim();

    if (!heartrate && !cadence && !power) {
        showStatus('Please enter at least one metric value', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/streams/${currentStream}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                heartrate: heartrate ? parseInt(heartrate) : null,
                cadence: cadence ? parseInt(cadence) : null,
                power: power ? parseInt(power) : null
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('heartrate').value = '';
            document.getElementById('cadence').value = '';
            document.getElementById('power').value = '';
            if (!eventSource) {
                await loadMessages();
            }
            showStatus('Metrics sent!', 'success');
        } else {
            showStatus(data.error || 'Failed to send metrics', 'error');
        }
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
}

function toggleListen() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
        document.getElementById('listeningBadge').style.display = 'none';
        showStatus('Stopped live view', 'info');
    } else {
        startListening();
    }
}

function startListening() {
    if (!currentStream) return;

    eventSource = new EventSource(`/api/streams/${currentStream}/listen`);
    document.getElementById('listeningBadge').style.display = 'inline-block';

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
            showStatus(`Connected to session: ${data.streamName}`, 'success');
        } else if (data.type === 'message') {
            addMessageToUI(data);
        }
    };

    eventSource.onerror = () => {
        showStatus('Connection error. Reconnecting...', 'error');
        eventSource.close();
        eventSource = null;
        document.getElementById('listeningBadge').style.display = 'none';
    };
}

function addMessageToUI(data) {
    const container = document.getElementById('messagesContainer');

    // Remove empty state if present
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        container.innerHTML = '';
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.innerHTML = `
        <div class="message-header">
            <span class="message-author">Metrics</span>
            <span>${new Date(parseInt(data.data.timestamp)).toLocaleString()}</span>
        </div>
        <div class="message-content">
            <strong>HR:</strong> ${data.data.heartrate || 'N/A'} bpm | 
            <strong>Cadence:</strong> ${data.data.cadence || 'N/A'} rpm | 
            <strong>Power:</strong> ${data.data.power || 'N/A'} W
        </div>
    `;

    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

// Load streams on page load
window.addEventListener('load', () => {
    loadStreams();
});

// Handle Enter key in inputs
document.getElementById('newStreamName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createStream();
});
