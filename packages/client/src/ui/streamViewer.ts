/**
 * Stream Viewer UI
 * 
 * Displays available streams and allows viewing live workout data.
 * 
 * @module streamViewer
 */

import { listStreams, listenToStream, listenToAllStreams } from '../api/streamClient.js';
import type { StreamInfo, SSEMessageData, SSEConnection } from '../api/streamClient.js';

/**
 * Workout metrics data from stream message
 */
interface WorkoutMetrics {
    power?: number | null;
    cadence?: number | null;
    heartrate?: number | null;
    speed?: number | null;
    distance?: number | null;
    altitude?: number | null;
    elapsed?: string;
    dataType?: string;
}

/**
 * All streams message data
 */
interface AllStreamsMessageData {
    stream: string;
    data: {
        message: string;
    } | WorkoutMetrics;
}

/**
 * Stream viewer class that manages the stream viewing UI
 */
export class StreamViewer {
    private modal: HTMLDivElement | null = null;
    private currentConnection: SSEConnection | null = null;
    private streamMetricsSection: HTMLElement | null = null;
    private allStreamsMetricsSection: HTMLElement | null = null;
    private allStreamsConnection: SSEConnection | null = null;
    private streamCards: Map<string, HTMLElement> = new Map();
    private streamRows: Map<string, HTMLElement> = new Map();
    private isCompactView: boolean = false;

    constructor() {
        this.initModal();
        this.initInlineViewer();
        this.initAllStreamsViewer();
    }

    /**
     * Initialize the inline stream viewer in main content
     */
    private initInlineViewer(): void {
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
    private initAllStreamsViewer(): void {
        this.allStreamsMetricsSection = document.getElementById('allStreamsMetrics');
        if (!this.allStreamsMetricsSection) {
            console.warn('All streams metrics section not found in DOM');
            return;
        }

        const closeBtn = document.getElementById('closeAllStreamsView');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.disconnectFromAllStreams());
        }

        const toggleViewBtn = document.getElementById('toggleViewBtn');
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', () => this.toggleAllStreamsView());
        }
    }

    /**
     * Toggle between grid and compact list view
     */
    private toggleAllStreamsView(): void {
        this.isCompactView = !this.isCompactView;
        const grid = document.getElementById('allStreamsGrid');
        const list = document.getElementById('allStreamsList');
        const toggleBtn = document.getElementById('toggleViewBtn');

        if (this.isCompactView) {
            if (grid) grid.style.display = 'none';
            if (list) list.style.display = 'flex';
            if (toggleBtn) {
                toggleBtn.textContent = '🔲';
                toggleBtn.title = 'Toggle grid view';
                toggleBtn.classList.add('active');
            }
        } else {
            if (grid) grid.style.display = 'grid';
            if (list) list.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.textContent = '📋';
                toggleBtn.title = 'Toggle compact view';
                toggleBtn.classList.remove('active');
            }
        }
    }

    /**
     * Initialize the stream viewer modal
     */
    private initModal(): void {
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
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for modal controls
     */
    private setupEventListeners(): void {
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

        if (this.modal) {
            this.modal.addEventListener('click', (e: MouseEvent) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }
    }

    /**
     * Open the stream viewer modal
     */
    async open(): Promise<void> {
        if (this.modal) {
            this.modal.style.display = 'flex';
        }
        await this.refreshStreamList();
    }

    /**
     * Close the stream viewer modal
     */
    close(): void {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    /**
     * Refresh the list of available streams
     */
    async refreshStreamList(): Promise<void> {
        const streamsList = document.getElementById('streamsList');
        if (!streamsList) return;

        streamsList.innerHTML = '<p class="loading">Loading streams...</p>';

        try {
            const { streams } = await listStreams();

            if (streams.length === 0) {
                streamsList.innerHTML = '<p class="no-streams">No active streams found</p>';
                return;
            }

            streamsList.innerHTML = '';
            streams.forEach((stream: StreamInfo) => {
                const streamItem = this.createStreamItem(stream);
                streamsList.appendChild(streamItem);
            });
        } catch (error) {
            console.error('Failed to load streams:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            streamsList.innerHTML = `<p class="error">Failed to load streams: ${message}</p>`;
        }
    }

    /**
     * Create a stream list item element
     */
    private createStreamItem(stream: StreamInfo): HTMLElement {
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
        connectBtn?.addEventListener('click', () => {
            this.connectToStream(stream.name);
        });

        return div;
    }

    /**
     * Connect to a stream and view live data
     */
    connectToStream(streamName: string): void {
        this.disconnectFromStream();

        if (!this.streamMetricsSection) {
            console.error('Stream metrics section not available');
            return;
        }

        this.streamMetricsSection.style.display = 'flex';

        const toggleStream = document.getElementById('toggleStreamMetrics') as HTMLInputElement | null;
        if (toggleStream) toggleStream.checked = true;

        const streamTitle = document.getElementById('streamTitle');
        const statusEl = document.getElementById('streamStatus');

        if (streamTitle) streamTitle.textContent = streamName;
        if (statusEl) {
            statusEl.textContent = 'Connecting...';
            statusEl.className = 'status-badge connecting';
        }

        this.close();

        this.currentConnection = listenToStream(
            streamName,
            (data: SSEMessageData) => this.handleStreamMessage(data),
            () => this.handleStreamConnected(),
            (error: Error | Event) => this.handleStreamError(error)
        );
    }

    /**
     * Connect to all streams
     */
    connectToAllStreams(): void {
        this.disconnectFromStream();
        this.disconnectFromAllStreams();

        if (!this.allStreamsMetricsSection) {
            console.error('All streams metrics section not available');
            return;
        }

        this.allStreamsMetricsSection.style.display = 'flex';
        this.close();

        const grid = document.getElementById('allStreamsGrid');
        const list = document.getElementById('allStreamsList');
        if (grid) grid.innerHTML = '';
        if (list) list.innerHTML = '';
        this.streamCards.clear();
        this.streamRows.clear();

        const allStreamsStatus = document.getElementById('allStreamsStatus');
        if (allStreamsStatus) {
            allStreamsStatus.textContent = 'Connecting...';
            allStreamsStatus.className = 'status-badge connecting';
        }

        this.allStreamsConnection = listenToAllStreams(
            (data: SSEMessageData) => this.handleAllStreamsMessage(data as unknown as AllStreamsMessageData),
            () => this.handleAllStreamsConnected(),
            (error: Error | Event) => this.handleAllStreamsError(error)
        );
    }

    /**
     * Handle all streams connected event
     */
    private handleAllStreamsConnected(): void {
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
    private handleAllStreamsError(error: Error | Event): void {
        console.error('All streams error:', error);
        const statusEl = document.getElementById('allStreamsStatus');
        if (!statusEl) return;

        if (this.allStreamsConnection && this.allStreamsConnection.active) {
            statusEl.textContent = '🔄 Reconnecting...';
            statusEl.className = 'status-badge reconnecting';
        } else {
            statusEl.textContent = '🔴 Error';
            statusEl.className = 'status-badge error';
        }
    }

    /**
     * Disconnect from all streams
     */
    disconnectFromAllStreams(): void {
        if (this.allStreamsConnection) {
            this.allStreamsConnection.close();
            this.allStreamsConnection = null;
        }

        if (this.allStreamsMetricsSection) {
            this.allStreamsMetricsSection.style.display = 'none';
        }

        const yourMetricsSection = document.getElementById('yourMetrics');
        if (yourMetricsSection) {
            yourMetricsSection.style.display = 'flex';
        }
    }

    /**
     * Handle incoming message for all streams view
     */
    private handleAllStreamsMessage(data: AllStreamsMessageData): void {
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
    private updateStreamCard(streamName: string, data: { message?: string } & WorkoutMetrics): void {
        const grid = document.getElementById('allStreamsGrid');
        const list = document.getElementById('allStreamsList');

        let messageData: WorkoutMetrics = {};
        try {
            if (data.message) {
                messageData = JSON.parse(data.message);
            } else {
                messageData = data;
            }
        } catch {
            // Ignore parse errors
        }

        if (grid) {
            let card = this.streamCards.get(streamName);

            if (!card) {
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

            if (messageData.power !== undefined && messageData.power !== null) {
                const powerEl = card.querySelector('.stream-card-power');
                if (powerEl) powerEl.textContent = String(messageData.power);
            }

            if (messageData.cadence !== undefined && messageData.cadence !== null) {
                const cadenceEl = card.querySelector('.card-cadence');
                if (cadenceEl) cadenceEl.textContent = String(messageData.cadence);
            }

            if (messageData.heartrate !== undefined && messageData.heartrate !== null) {
                const hrEl = card.querySelector('.card-heartrate');
                if (hrEl) hrEl.textContent = String(messageData.heartrate);
            }
        }

        if (list) {
            let row = this.streamRows.get(streamName);

            if (!row) {
                row = document.createElement('div');
                row.className = 'stream-row';
                row.innerHTML = `
          <span class="stream-row-name" title="${streamName}">${streamName}</span>
          <span class="stream-row-power">--</span>
        `;
                list.appendChild(row);
                this.streamRows.set(streamName, row);
            }

            if (messageData.power !== undefined && messageData.power !== null) {
                const powerEl = row.querySelector('.stream-row-power');
                if (powerEl) powerEl.textContent = String(messageData.power);
            }
        }
    }

    /**
     * Disconnect from the current stream
     */
    disconnectFromStream(): void {
        this.disconnectFromAllStreams();

        if (this.currentConnection) {
            this.currentConnection.close();
            this.currentConnection = null;
        }

        if (this.streamMetricsSection) {
            this.streamMetricsSection.style.display = 'none';

            const toggleStream = document.getElementById('toggleStreamMetrics') as HTMLInputElement | null;
            if (toggleStream) toggleStream.checked = false;
        }

        const yourMetricsSection = document.getElementById('yourMetrics');
        if (yourMetricsSection) {
            yourMetricsSection.style.display = 'flex';
        }

        this.resetViewer();
    }

    /**
     * Handle stream connected event
     */
    private handleStreamConnected(): void {
        const statusEl = document.getElementById('streamStatus');
        if (statusEl) {
            statusEl.textContent = '🟢 Connected';
            statusEl.className = 'status-badge connected';
        }
    }

    /**
     * Handle incoming stream message
     */
    private handleStreamMessage(data: SSEMessageData): void {
        try {
            const messageStr = (data as unknown as { data: { message: string } }).data?.message;
            const messageData: WorkoutMetrics = typeof messageStr === 'string'
                ? JSON.parse(messageStr)
                : (data as unknown as { data: WorkoutMetrics }).data;

            if (
                messageData.dataType === 'workout_metrics' ||
                messageData.power !== undefined ||
                messageData.cadence !== undefined ||
                messageData.heartrate !== undefined
            ) {
                this.updateMetrics(messageData);
            }

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
    private updateMetrics(data: WorkoutMetrics): void {
        const powerEl = document.getElementById('streamPower');
        const cadenceEl = document.getElementById('streamCadence');
        const heartrateEl = document.getElementById('streamHeartrate');
        const speedEl = document.getElementById('streamSpeed');
        const distanceEl = document.getElementById('streamDistance');
        const altitudeEl = document.getElementById('streamAltitude');
        const elapsedEl = document.getElementById('streamElapsed');

        if (powerEl && data.power !== null && data.power !== undefined) {
            powerEl.textContent = String(data.power);
        }
        if (cadenceEl && data.cadence !== null && data.cadence !== undefined) {
            cadenceEl.textContent = String(data.cadence);
        }
        if (heartrateEl && data.heartrate !== null && data.heartrate !== undefined) {
            heartrateEl.textContent = String(data.heartrate);
        }
        if (speedEl && data.speed !== null && data.speed !== undefined) {
            speedEl.textContent = String(data.speed);
        }
        if (distanceEl && data.distance !== null && data.distance !== undefined) {
            distanceEl.textContent = String(data.distance);
        }
        if (altitudeEl && data.altitude !== null && data.altitude !== undefined) {
            altitudeEl.textContent = String(data.altitude);
        }
        if (elapsedEl && data.elapsed) {
            elapsedEl.textContent = data.elapsed;
        }
    }

    /**
     * Handle stream error
     */
    private handleStreamError(error: Error | Event): void {
        console.error('Stream error:', error);
        const statusEl = document.getElementById('streamStatus');
        if (!statusEl) return;

        if (this.currentConnection && this.currentConnection.active) {
            statusEl.textContent = '🔄 Reconnecting...';
            statusEl.className = 'status-badge reconnecting';
        } else {
            statusEl.textContent = '🔴 Error';
            statusEl.className = 'status-badge error';
        }
    }

    /**
     * Reset viewer display
     */
    private resetViewer(): void {
        const elements = [
            'streamPower',
            'streamCadence',
            'streamHeartrate',
            'streamSpeed',
            'streamDistance',
            'streamAltitude',
            'streamElapsed',
        ];

        elements.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });

        const streamLastUpdate = document.getElementById('streamLastUpdate');
        if (streamLastUpdate) streamLastUpdate.textContent = 'Waiting for data...';
    }
}

/**
 * Initialize stream viewer UI
 */
export function initStreamViewer(): StreamViewer {
    const viewer = new StreamViewer();

    const viewStreamsBtn = document.getElementById('viewStreamsButton');
    if (viewStreamsBtn) {
        viewStreamsBtn.addEventListener('click', () => viewer.open());
    }

    return viewer;
}
