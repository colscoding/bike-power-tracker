import { View } from '../router/View.js';

export class DashboardView implements View {
    public id = 'dashboard';

    public init(_container: HTMLElement): void {
        console.log('Dashboard View initialized');
    }

    public onEnter(): void {
        console.log('Entered Dashboard View');
    }

    public onLeave(): void {
        console.log('Left Dashboard View');
    }
}
