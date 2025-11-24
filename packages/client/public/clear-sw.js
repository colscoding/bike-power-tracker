// Script to clear service worker registrations
// Use this if you're having caching issues in development

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister().then(function (success) {
                if (success) {
                    console.log('Service Worker unregistered successfully');
                }
            });
        }
    });
}

// Clear all caches
if ('caches' in window) {
    caches.keys().then(function (cacheNames) {
        return Promise.all(
            cacheNames.map(function (cacheName) {
                console.log('Deleting cache:', cacheName);
                return caches.delete(cacheName);
            })
        );
    }).then(function () {
        console.log('All caches cleared');
        alert('Service Worker and caches cleared! Please reload the page.');
    });
}
