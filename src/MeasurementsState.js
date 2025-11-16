class MeasurementsState {
    constructor() {
        this.heartrate = [];
        this.power = [];
        this.cadence = [];
    }

    addHeartrate({ timestamp, value }) {
        if (value <= 0 || value >= 300) {
            throw new Error('Heartrate must be between 1 and 299');
        }
        this.heartrate.push({
            timestamp: timestamp,
            value: value
        });
    }

    addPower({ timestamp, value }) {
        if (value <= 0 || value >= 3000) {
            throw new Error('Power must be between 1 and 2999');
        }
        this.power.push({
            timestamp: timestamp,
            value: value
        });
    }

    addCadence({ timestamp, value }) {
        if (value <= 0 || value >= 300) {
            throw new Error('Cadence must be between 1 and 299');
        }
        this.cadence.push({
            timestamp: timestamp,
            value: value
        });
    }

    add(type, entry) {
        if (type === 'heartrate') {
            this.addHeartrate(entry);
        } else if (type === 'power') {
            this.addPower(entry);
        } else if (type === 'cadence') {
            this.addCadence(entry);
        } else {
            throw new Error(`Unknown measurement type: ${type}`);
        }
    }
}

export { MeasurementsState };


