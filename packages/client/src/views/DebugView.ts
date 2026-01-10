import { View } from '../router/View.js';
import { BluetoothFactory } from '../services/bluetooth/factory.js';
import { BluetoothDebugService } from '../services/debug/BluetoothDebugService.js';
import { ViewId } from '../router/view-ids.js';

export class DebugView implements View {
    public id = ViewId.Debug;
    private logArea: HTMLTextAreaElement | null = null;
    private boundOnLog = this.onLog.bind(this);
    private logBuffer: Array<{ timestamp: string, sensor: string, data: string }> = [];

    public init(container: HTMLElement): void {
        const template = document.getElementById('debugTemplate') as HTMLTemplateElement;

        if (template) {
            const content = template.content.cloneNode(true);
            container.appendChild(content);
            this.setupEvents(container);
        } else {
            console.error('Debug template not found');
            container.innerHTML = '<p>Error loading debug view</p>';
        }
    }

    public onEnter(): void {
        BluetoothDebugService.addListener(this.boundOnLog);
    }

    public onLeave(): void {
        BluetoothDebugService.removeListener(this.boundOnLog);
    }

    private onLog(sensor: string, hex: string) {
        const timestamp = new Date().toISOString();
        this.logBuffer.push({ timestamp, sensor, data: hex });

        if (this.logArea) {
            const timeDisplay = timestamp.split('T')[1].slice(0, -1);
            this.logArea.value += `[${timeDisplay}] ${sensor}: ${hex}\n`;
            this.logArea.scrollTop = this.logArea.scrollHeight;
        }
    }

    private setupEvents(container: HTMLElement): void {
        this.logArea = container.querySelector('#debugLog');

        const btnTreadmill = container.querySelector('#connectTreadmillDebug');
        const btnRower = container.querySelector('#connectRowerDebug');
        const btnDownload = container.querySelector('#downloadLogs');

        btnTreadmill?.addEventListener('click', async () => {
            try {
                this.log('System', 'Connecting to Treadmill...');
                await BluetoothFactory.connectTreadmill();
                this.log('System', 'Connected to Treadmill');
            } catch (e) {
                this.log('System', `Treadmill connection failed: ${e}`);
            }
        });

        btnRower?.addEventListener('click', async () => {
            try {
                this.log('System', 'Connecting to Rower...');
                await BluetoothFactory.connectRowing();
                this.log('System', 'Connected to Rower');
            } catch (e) {
                this.log('System', `Rower connection failed: ${e}`);
            }
        });

        btnDownload?.addEventListener('click', () => {
            this.downloadLocalLogs();
        });
    }

    private downloadLocalLogs() {
        const blob = new Blob([JSON.stringify(this.logBuffer, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bpt-debug-session-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private log(source: string, message: string) {
        if (this.logArea) {
            const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
            this.logArea.value += `[${timestamp}] ${source}: ${message}\n`;
            this.logArea.scrollTop = this.logArea.scrollHeight;
        }
    }
}
