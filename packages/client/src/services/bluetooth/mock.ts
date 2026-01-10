import type {
  SensorConnection,
  ConnectionStatus
} from '../../types/bluetooth.js';
import type { Measurement } from '../../types/measurements.js';

// Aligning types with actual project types
// Project uses SensorConnection interface, not BluetoothSensor class

export class MockSensorConnection implements SensorConnection {
  public id: string;
  public deviceName?: string;
  public type: 'power' | 'heartrate' | 'cadence' | 'treadmill';

  private _disconnectCallbacks: (() => void)[] = [];
  private _statusCallbacks: ((status: ConnectionStatus) => void)[] = [];
  private _dataCallbacks: ((data: Measurement) => void)[] = [];
  private _interval: any;

  constructor(type: 'power' | 'heartrate' | 'cadence' | 'treadmill', name = 'Mock Sensor') {
    this.id = `mock-${type}-${Date.now()}`;
    this.type = type;
    this.deviceName = name;
  }

  async connect(): Promise<boolean> {
    await this.delay(100);
    this.notifyStatus('connected');
    this.startSimulation();
    return true;
  }

  disconnect(): void {
    this.stopSimulation();
    this.notifyStatus('disconnected');
    this._disconnectCallbacks.forEach(cb => cb());
  }

  startSimulation() {
    if (this._interval) return;
    this._interval = setInterval(() => this.emitRandomData(), 1000);
    this.emitRandomData(); // Emit one immediately
  }

  stopSimulation() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  emitRandomData() {
    // Base implementation does nothing
  }

  onDisconnect(callback: () => void): void {
    this._disconnectCallbacks.push(callback);
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this._statusCallbacks.push(callback);
  }

  addListener(callback: (data: Measurement) => void): void {
    this._dataCallbacks.push(callback);
  }

  // Helpers
  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private notifyStatus(status: ConnectionStatus) {
    this._statusCallbacks.forEach(cb => cb(status));
  }

  public simulateData(data: any) {
    this._dataCallbacks.forEach(cb => cb(data));
  }

  public simulateDisconnect() {
    this.disconnect();
  }
}

export class MockPowerSensor extends MockSensorConnection {
  constructor() { super('power', 'Mock Power'); }

  emitRandomData() {
    this.simulateData({
      power: Math.floor(200 + Math.random() * 50),
      cadence: Math.floor(85 + Math.random() * 5),
      timestamp: Date.now()
    });
  }
}

export class MockHeartrateSensor extends MockSensorConnection {
  constructor() { super('heartrate', 'Mock HR'); }
}

export class MockCadenceSensor extends MockSensorConnection {
  constructor() { super('cadence', 'Mock Cadence'); }
}

export const createMockSensor = (type: 'power' | 'heartrate' | 'cadence' | 'treadmill') => {
  return new MockSensorConnection(type);
};
