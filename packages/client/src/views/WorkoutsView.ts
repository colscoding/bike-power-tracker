import { View } from '../router/View.js';
import { initWorkoutSelectionLogic, refreshWorkoutList } from '../ui/workoutPlayer.js';
import { initWorkoutBuilder } from '../ui/workoutBuilder.js';

export class WorkoutsView implements View {
    public id = 'workouts';
    private isInitialized = false;

    public init(container: HTMLElement): void {
        const template = document.getElementById('workoutSelectionTemplate') as HTMLTemplateElement;

        if (template) {
            const content = template.content.cloneNode(true);
            container.appendChild(content);

            // Initialize the logic now that elements are in the DOM
            setTimeout(() => {
                initWorkoutSelectionLogic();
                initWorkoutBuilder(); // Initialize builder logic (it still uses a modal, which is fine)
                this.isInitialized = true;
            }, 0);
        } else {
            console.error('Workouts template not found!');
            container.innerHTML = '<p>Error loading workouts view</p>';
        }
    }

    public onEnter(): void {
        if (this.isInitialized) {
            refreshWorkoutList();
        } else {
            setTimeout(() => refreshWorkoutList(), 50);
        }
    }

    public onLeave(): void {
        // Cleanup if needed
    }
}
