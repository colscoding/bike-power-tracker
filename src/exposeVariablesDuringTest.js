export function exposeVariablesDuringTest({ measurementsState, connectionsState }) {
    // Always expose in non-production builds for testing purposes
    if (typeof window !== 'undefined') {
        window.bike = measurementsState;
        window.connectionsState = connectionsState;
    }
}
