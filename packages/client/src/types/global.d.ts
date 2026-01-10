import type { Router } from '../router/Router.js';

declare global {
    interface Window {
        router?: Router;
        webkitAudioContext?: typeof AudioContext;
    }
}

export { };
