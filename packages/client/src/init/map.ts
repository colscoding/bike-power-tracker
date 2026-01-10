import { MapComponent } from '../ui/map-component.js';
import type { MeasurementsState } from '../measurements-state.js';
import type { ConnectionsState } from '../types/connections.js';

/**
 * Initialize the GPS Map component and toggle controls
 */
export function initMap(measurementsState: MeasurementsState, connectionsState: ConnectionsState) {
    const mapContainerId = 'gpsMap';
    const toggleBtnId = 'toggleMapBtn';
    const carouselId = 'dataFieldsCarousel';

    const toggleBtn = document.getElementById(toggleBtnId);
    const mapContainer = document.getElementById(mapContainerId);
    const carousel = document.getElementById(carouselId);

    if (!toggleBtn || !mapContainer || !carousel) {
        console.warn('Map initialization failed: Missing elements');
        return;
    }

    const mapComponent = new MapComponent(measurementsState);
    let isMapVisible = false;

    // Initially hidden
    toggleBtn.style.display = 'none';

    // Toggle logic
    toggleBtn.addEventListener('click', () => {
        isMapVisible = !isMapVisible;

        if (isMapVisible) {
            // Show Map
            carousel.style.display = 'none';
            mapContainer.style.display = 'block';
            toggleBtn.classList.add('active');
            toggleBtn.style.background = '#ccc'; // Visual feedback

            // Mount if first time, or just update visibility logic handled internally
            // Note: MapComponent.mount checks if already mounted
            mapComponent.mount(mapContainerId);

            // Force resize calculation since it was hidden
            setTimeout(() => {
                mapComponent.resize();
            }, 100);

        } else {
            // Show Metrics
            mapContainer.style.display = 'none';
            carousel.style.display = 'block';
            toggleBtn.classList.remove('active');
            toggleBtn.style.background = ''; // Reset

            // mapComponent.unmount(); // Optional: keep state
        }
    });

    // Monitor GPS status to enable the button
    // Simple polling since ConnectionState doesn't emit events directly in this architecture (yet)
    setInterval(() => {
        const hasGpsData = measurementsState.gps.length > 0;
        const isConnected = connectionsState.gps?.isConnected;

        if (isConnected || hasGpsData) {
            if (toggleBtn.style.display === 'none') {
                toggleBtn.style.display = 'inline-block';
            }
        }
    }, 2000);
}
