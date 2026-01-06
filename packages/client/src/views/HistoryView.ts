import { View } from '../router/View.js';
import { initHistoryLogic, refreshHistoryView } from '../ui/workoutHistory.js';

export class HistoryView implements View {
    public id = 'history';
    private isInitialized = false;

    public init(container: HTMLElement): void {
        const template = document.getElementById('workoutHistoryTemplate') as HTMLTemplateElement;

        if (template) {
            const content = template.content.cloneNode(true);
            container.appendChild(content);

            // Initialize the logic now that elements are in the DOM
            // We use setTimeout to ensure the DOM update is processed
            setTimeout(() => {
                initHistoryLogic();
                this.isInitialized = true;
            }, 0);
        } else {
            console.error('History template not found!');
            container.innerHTML = '<p>Error loading history view</p>';
        }
    }

    public onEnter(): void {
        if (this.isInitialized) {
            refreshHistoryView();
        } else {
            // Fallback if onEnter is called too fast (shouldn't happen with sync init)
            // logic is initialized in init(), but data might need loading
            setTimeout(() => refreshHistoryView(), 50);
        }
    }

    public onLeave(): void {
        // Cleanup if needed
    }
}
