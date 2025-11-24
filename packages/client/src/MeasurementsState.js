class MeasurementsState {
    constructor() {
        this.heartrate = [];
        this.power = [];
        this.cadence = [];
    }

    addHeartrate({ timestamp, value }) {
        if (value <= 0 || value >= 300) {
            console.warn(`Invalid heartrate value: ${value}`);
            return;
        }
        this.heartrate.push({
            timestamp: timestamp,
            value: value
        });
    }

    addPower({ timestamp, value }) {
        if (value < 0 || value >= 3000) {
            console.warn(`Invalid power value: ${value}`);
            return;
        }
        this.power.push({
            timestamp: timestamp,
            value: value
        });
    }

    addCadence({ timestamp, value }) {
        if (value < 0 || value >= 300) {
            console.warn(`Invalid cadence value: ${value}`);
            return;
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


