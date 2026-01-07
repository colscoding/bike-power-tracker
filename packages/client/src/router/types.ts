import type { View } from './View.js';

export interface IRouter {
    navigate(path: string, replace?: boolean): void;
    registerView(view: View): void;
    addRoute(path: string, viewId: string): void;
    start(): void;
    back(): void;
}
