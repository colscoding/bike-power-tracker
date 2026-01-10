import L from 'leaflet';
import type { MeasurementsState } from '../measurements-state.js';

export class MapComponent {
    private state: MeasurementsState;
    private map: L.Map | null = null;
    private routeLine: L.Polyline | null = null;
    private currentPosMarker: L.CircleMarker | null = null;
    private mounted: boolean = false;
    private animationFrameId: number | null = null;
    private lastGpsCount: number = 0;

    // Configuration
    private readonly defaultZoom = 15;
    private readonly followUser = true;

    constructor(state: MeasurementsState) {
        this.state = state;
    }

    public mount(elementId: string): void {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`MapComponent: Element with ID "${elementId}" not found.`);
            return;
        }

        // Initialize Leaflet map
        // Start with a world view, will center on GPS update
        this.map = L.map(elementId);

        // If we have GPS data, use the last point, otherwise 0,0
        const hasData = this.state.gps.length > 0;
        const initialLat = hasData ? this.state.gps[this.state.gps.length - 1].lat : 0;
        const initialLon = hasData ? this.state.gps[this.state.gps.length - 1].lon : 0;
        const initialZoom = hasData ? this.defaultZoom : 2;

        this.map.setView([initialLat, initialLon], initialZoom);

        // Add OpenStreetMap tile layer
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        // Create route polyline
        this.routeLine = L.polyline([], {
            color: 'var(--color-primary, #007bff)', // Use CSS var if available
            weight: 5,
            opacity: 0.7
        }).addTo(this.map);

        // Create current position marker (using CircleMarker to avoid icon issues)
        this.currentPosMarker = L.circleMarker([initialLat, initialLon], {
            radius: 8,
            fillColor: 'var(--color-accent, #28a745)',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        // Only add marker if we actually have data
        if (hasData) {
            this.currentPosMarker.addTo(this.map);
        }

        this.mounted = true;
        this.lastGpsCount = 0;

        // Start update loop
        this.startLoop();

        // Force an immediate update to draw existing path
        this.update();

        // Handle Map Resize issues
        setTimeout(() => {
            this.map?.invalidateSize();
        }, 100);
    }

    public unmount(): void {
        this.mounted = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.routeLine = null;
        this.currentPosMarker = null;
    }

    public update(): void {
        if (!this.mounted || !this.map || !this.routeLine || !this.currentPosMarker) {
            return;
        }

        const gpsData = this.state.gps;

        // Optimization: only update if data changed or we haven't drawn fully
        if (gpsData.length === this.lastGpsCount) {
            return;
        }

        const points = gpsData.map(p => [p.lat, p.lon] as [number, number]);

        // Update polyline
        this.routeLine.setLatLngs(points);

        if (gpsData.length > 0) {
            const lastPoint = gpsData[gpsData.length - 1];
            const latLng: [number, number] = [lastPoint.lat, lastPoint.lon];

            // Update marker
            this.currentPosMarker.setLatLng(latLng);

            // Ensure marker is on map
            if (!this.map.hasLayer(this.currentPosMarker)) {
                this.currentPosMarker.addTo(this.map);
            }

            // Follow user logic
            if (this.followUser) {
                // Only pan if we are reasonably far from center to avoid jitter
                // Or just use setView if it's the first few points
                if (this.lastGpsCount === 0) {
                    this.map.setView(latLng, this.defaultZoom);
                } else {
                    // Maybe check distance before panning?
                    // For now, keep it simple and just pan to keep user in view
                    // But avoid blocking UI if it updates too fast.
                    // Since update() is in Raf this should be ok.
                    this.map.panTo(latLng, { animate: true });
                }
            }
        }

        this.lastGpsCount = gpsData.length;
    }

    private startLoop(): void {
        const loop = () => {
            if (!this.mounted) return;
            this.update();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    /**
     * Call this when container is resized
     */
    public resize(): void {
        this.map?.invalidateSize();
    }
}
