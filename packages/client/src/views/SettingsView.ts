import { View } from '../router/View.js';
import { initSettingsLogic } from '../ui/settings.js';
import { initDataFieldsConfig } from '../ui/dataFieldsConfig.js';

export class SettingsView implements View {
    public id = 'settings';
    // private isInitialized = false;

    public init(container: HTMLElement): void {
        const template = document.getElementById('settingsTemplate') as HTMLTemplateElement;

        if (template) {
            const content = template.content.cloneNode(true);
            container.appendChild(content);

            // Initialize the logic now that elements are in the DOM
            // We use setTimeout to ensure the DOM update is processed
            setTimeout(() => {
                initSettingsLogic();
                initDataFieldsConfig();
                // this.isInitialized = true;
            }, 0);
        } else {
            console.error('Settings template not found!');
            container.innerHTML = '<p>Error loading settings view</p>';
        }
    }

    public onEnter(): void {
        console.log('Entered Settings View');
        // If we needed to refresh settings from storage every time we enter, 
        // we might call loadSettings() here. 
        // But initSettingsLogic calls loadSettings internally during init.
        // If the user changes settings, they are saved. 
        // If we want to ensure UI matches state if state changed elsewhere...
        // initSettingsLogic sets up listeners. 
        // We might want to re-run loadSettings() if it exposed it.
        // For now, let's assume one-time init is fine or we can expose refresh.

        // Actually, since we re-clone the template only ONCE in init (if the container is empty?),
        // Wait, the Router usually doesn't clear the container unless we implement it that way.
        // My Router implementation:
        /*
            if (!this.views.has(viewId)) { ... view.init(container) }
            this.currentView?.onLeave();
            currentContainer.style.display = 'none';
            newContainer.style.display = 'block';
            view.onEnter();
        */

        // So init() is called once. The DOM elements persist.
        // So `initSettingsLogic` is called once. The listeners persist.
        // This is correct.
    }

    public onLeave(): void {
        console.log('Left Settings View');
    }
}
