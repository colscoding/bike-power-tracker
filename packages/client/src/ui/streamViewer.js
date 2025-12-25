/**
 * Stream viewer UI - displays available streams and allows viewing live data
 */
import { listStreams, listenToStream, listenToAllStreams } from '../api/streamClient.js';

export class StreamViewer {
    constructor() {
        this.modal = null;
        this.currentConnection = null;
        this.streamMetricsSection = null;
        this.allStreamsMetricsSection = null;
        this.allStreamsConnection = null;
        this.streamCards = new Map();
        this.initModal();
        this.initInlineViewer();
        this.initAllStreamsViewer();
    }

    /**
     * Initialize the inline stream viewer in main content
     */
    initInlineViewer() {
        this.streamMetricsSection = document.getElementById('streamMetrics');
        if (!this.streamMetricsSection) {
            console.warn('Stream metrics section not found in DOM');
            return;
        }
        const closeBtn = document.getElementById('closeStreamView');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.disconnectFromStream());
        }
    }

    /**
     * Initialize the all streams viewer
     */
    initAllStreamsViewer() {
        this.allStreamsMetricsSection = document.getElementById('allStreamsMetrics');
        if (!this.allStreamsMetricsSection) {
            console.warn('All streams metrics section not found in DOM');
            return;
        }
        const closeBtn = document.getElementById('closeAllStreamsView');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.disconnectFromAllStreams());
        }
    }

    /**
     * Initialize the stream viewer modal
     */
    initModal() {
        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'streamViewerModal';
        modal.className = 'stream-modal';
        modal.innerHTML = `
            <div class="stream-modal-content">
                <div class="stream-modal-header">
                    <h2>🌐 Live Streams</h2>
                    <button id="closeStreamModal" class="close-button">&times;</button>
                </div>
                <div class="stream-modal-body">
                    <div class="stream-list-container">
                        <div class="stream-list-controls" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <button id="refreshStreamList" class="refresh-button">🔄 Refresh List</button>
                            <button id="viewAllStreamsBtn" class="connect-button" style="background-color: #4CAF50;">👁️ View All Streams</button>
                        </div>
                        <div id="streamsList" class="streams-list">
                            <p class="loading">Loading streams...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for modal controls
     */
    setupEventListeners() {
        const closeBtn = document.getElementById('closeStreamModal');
        const refreshBtn = document.getElementById('refreshStreamList');
        const viewAllBtn = document.getElementById('viewAllStreamsBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshStreamList());
        }
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => this.connectToAllStreams());
        }

        // Close modal when clicking outside
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }
    }

    /**
     * Open the stream viewer modal
     */
    async open() {
        this.modal.style.display = 'flex';
        await this.refreshStreamList();
    }

    /**
     * Close the stream viewer modal
     */
    close() {
        this.modal.style.display = 'none';
        // Don't disconnect - user might be viewing a stream
    }

    /**
     * Refresh the list of available streams
     */
    async refreshStreamList() {
        const streamsList = document.getElementById('streamsList');
        streamsList.innerHTML = '<p class="loading">Loading streams...</p>';

        try {
            const { streams } = await listStreams();

            if (streams.length === 0) {
                streamsList.innerHTML = '<p class="no-streams">No active streams found</p>';
                return;
            }

            streamsList.innerHTML = '';
            streams.forEach(stream => {
                const streamItem = this.createStreamItem(stream);
                streamsList.appendChild(streamItem);
            });
        } catch (error) {
            console.error('Failed to load streams:', error);
            streamsList.innerHTML = `<p class="error">Failed to load streams: ${error.message}</p>`;
        }
    }

    /**
     * Create a stream list item element
     */
    createStreamItem(stream) {
        const div = document.createElement('div');
        div.className = 'stream-item';

        const isWorkoutStream = stream.name.startsWith('workout-');
        const icon = isWorkoutStream ? '🚴' : '💬';

        div.innerHTML = `
            <div class="stream-item-info">
                <div class="stream-item-name">${icon} ${stream.name}</div>
                <div class="stream-item-meta">
                    ${stream.length} message${stream.length !== 1 ? 's' : ''}
                </div>
            </div>
            <button class="connect-button" data-stream="${stream.name}">
                👁️ View
            </button>
        `;

        const connectBtn = div.querySelector('.connect-button');
        connectBtn.addEventListener('click', () => {
            this.connectToStream(stream.name);
        });

        return div;
    }

    /**
     * Connect to a stream and view live data
     */
    connectToStream(streamName) {
        // Disconnect from any existing stream
        this.disconnectFromStream();

        // Show stream metrics in main content
        if (!this.streamMetricsSection) {
            console.error('Stream metrics section not available');
            return;
        }
        this.streamMetricsSection.style.display = 'flex';

        // Sync menu toggle
        const toggleStream = document.getElementById('toggleStreamMetrics');
        if (toggleStream) toggleStream.checked = true;

        const streamTitle = document.getElementById('streamTitle');
        const statusEl = document.getElementById('streamStatus');

        if (streamTitle) {
            streamTitle.textContent = streamName;
        }
        if (statusEl) {
            statusEl.textContent = 'Connecting...';
            statusEl.className = 'status-badge connecting';
        }

        // Close the modal
        this.close();

        // Connect to the stream
        this.currentConnection = listenToStream(
            streamName,
            (data) => this.handleStreamMessage(data),
            () => this.handleStreamConnected(),
            (error) => this.handleStreamError(error)
        );
    }

    /**
     * Connect to all streams and view live data
     */
    connectToAllStreams() {
        // Disconnect from any existing stream
        this.disconnectFromStream();
        this.disconnectFromAllStreams();

        // Show all streams metrics section
        if (!this.allStreamsMetricsSection) {
            console.error('All streams metrics section not available');
            return;
        }
        this.allStreamsMetricsSection.style.display = 'flex';

        // Close the modal
        this.close();

        // Clear existing cards
        const grid = document.getElementById('allStreamsGrid');
        if (grid) grid.innerHTML = '';
        this.streamCards.clear();

        // Update status indicator if exists
        const allStreamsStatus = document.getElementById('allStreamsStatus');
        if (allStreamsStatus) {
            allStreamsStatus.textContent = 'Connecting...';
            allStreamsStatus.className = 'status-badge connecting';
        }

        // Connect to all streams
        this.allStreamsConnection = listenToAllStreams(
            (data) => this.handleAllStreamsMessage(data),
            () => this.handleAllStreamsConnected(),
            (error) => this.handleAllStreamsError(error)
        );
    }

    /**
     * Handle all streams connected event
     */
    handleAllStreamsConnected() {
        console.log('Connected to all streams');
        const statusEl = document.getElementById('allStreamsStatus');
        if (statusEl) {
            statusEl.textContent = '🟢 Connected';
            statusEl.className = 'status-badge connected';
        }
    }

    /**
     * Handle all streams error
     */
    handleAllStreamsError(error) {
        console.error('All streams error:', error);
        const statusEl = document.getElementById('allStreamsStatus');
        if (!statusEl) return;

        if (this.allStreamsConnection) {
            const state = this.allStreamsConnection.readyState;
            if (state === EventSource.CONNECTING) {
                statusEl.textContent = '🔄 Reconnecting...';
                statusEl.className = 'status-badge reconnecting';
            } else if (state === EventSource.CLOSED) {
                statusEl.textContent = '⚠️ Disconnected';
                statusEl.className = 'status-badge disconnected';
            } else {
                statusEl.textContent = '🔴 Error';
                statusEl.className = 'status-badge error';
            }
        } else {
            statusEl.textContent = '🔴 Error';
            statusEl.className = 'status-badge error';
        }
    }

    /**
     * Disconnect from all streams
     */
    disconnectFromAllStreams() {
        if (this.allStreamsConnection) {
            this.allStreamsConnection.close();
            this.allStreamsConnection = null;
        }

        // Hide all streams metrics section
        if (this.allStreamsMetricsSection) {
            this.allStreamsMetricsSection.style.display = 'none';
        }

        // Ensure your metrics is visible
        const yourMetricsSection = document.getElementById('yourMetrics');
        if (yourMetricsSection) {
            yourMetricsSection.style.display = 'flex';
        }
    }

    /**
     * Handle incoming message for all streams view
     */
    handleAllStreamsMessage(data) {
        try {
            const streamName = data.stream;
            const messageData = typeof data.data === 'string'
                ? JSON.parse(data.data)
                : data.data;

            this.updateStreamCard(streamName, messageData);
        } catch (error) {
            console.error('Error parsing stream message:', error, data);
        }
    }

    /**
     * Update or create a stream card
     */
    updateStreamCard(streamName, data) {
        const grid = document.getElementById('allStreamsGrid');
        if (!grid) return;

        let card = this.streamCards.get(streamName);

        if (!card) {
            // Create new card
            card = document.createElement('div');
            card.className = 'stream-card';
            card.innerHTML = `
                <div class="stream-card-name" title="${streamName}">${streamName}</div>
                <div class="stream-card-power">--</div>
                <div class="stream-card-secondary">
                    <div class="stream-card-metric">
                        <span>CAD</span>
                        <span class="card-cadence">--</span>
                    </div>
                    <div class="stream-card-metric">
                        <span>HR</span>
                        <span class="card-heartrate">--</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
            this.streamCards.set(streamName, card);
        }

        let messageData = {};
        try {
            messageData = JSON.parse(data.message)
        } catch (error) {

        }
        // Update values
        if (messageData.power !== undefined && messageData.power !== null) {
            const powerEl = card.querySelector('.stream-card-power');
            if (powerEl) powerEl.textContent = messageData.power;
        }

        if (messageData.cadence !== undefined && messageData.cadence !== null) {
            const cadenceEl = card.querySelector('.card-cadence');
            if (cadenceEl) cadenceEl.textContent = messageData.cadence;
        }

        if (messageData.heartrate !== undefined && messageData.heartrate !== null) {
            const hrEl = card.querySelector('.card-heartrate');
            if (hrEl) hrEl.textContent = messageData.heartrate;
        }
    }

    /**
     * Disconnect from the current stream
     */
    disconnectFromStream() {
        // Also disconnect from all streams if active
        this.disconnectFromAllStreams();

        if (this.currentConnection) {
            this.currentConnection.close();
            this.currentConnection = null;
        }

        // Hide stream metrics section
        if (this.streamMetricsSection) {
            this.streamMetricsSection.style.display = 'none';

            // Sync menu toggle
            const toggleStream = document.getElementById('toggleStreamMetrics');
            if (toggleStream) toggleStream.checked = false;
        }

        // Ensure your metrics is visible
        const yourMetricsSection = document.getElementById('yourMetrics');

        if (yourMetricsSection) {
            yourMetricsSection.style.display = 'flex';
        }

        // Reset viewer
        this.resetViewer();
    }

    /**
     * Handle stream connected event
     */
    handleStreamConnected() {
        const statusEl = document.getElementById('streamStatus');
        statusEl.textContent = '🟢 Connected';
        statusEl.className = 'status-badge connected';
    }

    /**
     * Handle incoming stream message
     */
    handleStreamMessage(data) {
        try {
            // Parse the message data
            const messageData = typeof data.data.message === 'string'
                ? JSON.parse(data.data.message)
                : data.data;
            // Update metrics display
            if (messageData.dataType === 'workout_metrics' || messageData?.power !== undefined || messageData?.cadence !== undefined || messageData?.heartrate !== undefined) {
                this.updateMetrics(messageData);
            }

            // Update last update time
            const lastUpdateEl = document.getElementById('streamLastUpdate');
            if (lastUpdateEl) {
                const now = new Date();
                lastUpdateEl.textContent = `Last update: ${now.toLocaleTimeString()}`;
            }
        } catch (error) {
            console.error('Error parsing stream message:', error, data);
        }
    }

    /**
     * Update metrics display with new data
     */
    updateMetrics(data) {
        const powerEl = document.getElementById('streamPower');
        const cadenceEl = document.getElementById('streamCadence');
        const heartrateEl = document.getElementById('streamHeartrate');
        const elapsedEl = document.getElementById('streamElapsed');

        if (powerEl && data.power !== null && data.power !== undefined) {
            powerEl.textContent = `${data.power}`;
        }
        if (cadenceEl && data.cadence !== null && data.cadence !== undefined) {
            cadenceEl.textContent = `${data.cadence}`;
        }
        if (heartrateEl && data.heartrate !== null && data.heartrate !== undefined) {
            heartrateEl.textContent = `${data.heartrate}`;
        }
        if (elapsedEl && data.elapsed) {
            elapsedEl.textContent = data.elapsed;
        }
    }

    /**
     * Handle stream error
     */
    handleStreamError(error) {
        console.error('Stream error:', error);
        const statusEl = document.getElementById('streamStatus');

        // Check if this is a connection/network error (EventSource fires error on disconnect)
        if (this.currentConnection) {
            const state = this.currentConnection.readyState;
            if (state === EventSource.CONNECTING) {
                // Browser is trying to reconnect
                statusEl.textContent = '🔄 Reconnecting...';
                statusEl.className = 'status-badge reconnecting';
            } else if (state === EventSource.CLOSED) {
                // Connection is closed
                statusEl.textContent = '⚠️ Disconnected';
                statusEl.className = 'status-badge disconnected';
            } else {
                statusEl.textContent = '🔴 Error';
                statusEl.className = 'status-badge error';
            }
        } else {
            statusEl.textContent = '🔴 Error';
            statusEl.className = 'status-badge error';
        }
    }

    /**
     * Reset viewer display
     */
    resetViewer() {
        const streamPower = document.getElementById('streamPower');
        const streamCadence = document.getElementById('streamCadence');
        const streamHeartrate = document.getElementById('streamHeartrate');
        const streamElapsed = document.getElementById('streamElapsed');
        const streamLastUpdate = document.getElementById('streamLastUpdate');

        if (streamPower) streamPower.textContent = '--';
        if (streamCadence) streamCadence.textContent = '--';
        if (streamHeartrate) streamHeartrate.textContent = '--';
        if (streamElapsed) streamElapsed.textContent = '--';
        if (streamLastUpdate) streamLastUpdate.textContent = 'Waiting for data...';
    }
}

/**
 * Initialize stream viewer UI
 */
export function initStreamViewer() {
    const viewer = new StreamViewer();

    const viewStreamsBtn = document.getElementById('viewStreamsButton');
    if (viewStreamsBtn) {
        viewStreamsBtn.addEventListener('click', () => viewer.open());
    }

    return viewer;
}
