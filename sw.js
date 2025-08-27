// Piko Přepadení - Service Worker
const CACHE_NAME = 'piko-prepadeni-v1.0.0';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800&family=Share+Tech+Mono&display=swap'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Error caching files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }
        
        // Otherwise, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response before caching
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('Fetch failed:', error);
            
            // Return offline page if available
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
            
            // Return empty response for other requests
            return new Response('', {
              status: 408,
              statusText: 'Network request timeout'
            });
          });
      })
  );
});

// Background sync for high scores (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-scores') {
    event.waitUntil(syncHighScores());
  }
});

async function syncHighScores() {
  try {
    // Sync high scores when back online
    console.log('Syncing high scores...');
    
    // Check if there are pending scores to sync
    const pendingScores = await getFromIndexedDB('pendingScores');
    
    if (pendingScores && pendingScores.length > 0) {
      // Send to server if you have one
      // await sendScoresToServer(pendingScores);
      
      // Clear pending scores after successful sync
      await clearFromIndexedDB('pendingScores');
    }
  } catch (error) {
    console.error('Error syncing high scores:', error);
  }
}

// Push notifications (for future features)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nová výzva v Piko Přepadení!',
    icon: './icon-192x192.png',
    badge: './badge-72x72.png',
    vibrate: [200, 100, 200],
     {
      url: './'
    },
    actions: [
      {
        action: 'open',
        title: 'Hrát',
        icon: './icon-play.png'
      },
      {
        action: 'close',
        title: 'Zavřít'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Piko Přepadení', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Helper functions for IndexedDB (for future features)
function getFromIndexedDB(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PikoGameDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['gameData'], 'readonly');
      const store = transaction.objectStore('gameData');
      const getRequest = store.get(key);
      
      getRequest.onsuccess = () => resolve(getRequest.result?.data);
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('gameData')) {
        db.createObjectStore('gameData', { keyPath: 'key' });
      }
    };
  });
}

function clearFromIndexedDB(key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PikoGameDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['gameData'], 'readwrite');
      const store = transaction.objectStore('gameData');
      const deleteRequest = store.delete(key);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Version check and update notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic background sync (for future features)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-challenge') {
    event.waitUntil(fetchDailyChallenge());
  }
});

async function fetchDailyChallenge() {
  try {
    // Fetch daily challenge data
    console.log('Fetching daily challenge...');
    
    // Generate random challenge for offline mode
    const challenges = [
      'Doběhni 2000 metrů bez poškození',
      'Sebirej 100 "matroše" v jednom běhu',
      'Aktivuj všechny power-upy',
      'Dosáhni skóre 15,000',
      'Přežij 3 minuty'
    ];
    
    const todayChallenge = challenges[Math.floor(Math.random() * challenges.length)];
    
    // Show notification about new challenge
    self.registration.showNotification('Denní výzva!', {
      body: todayChallenge,
      icon: './icon-192x192.png',
      badge: './badge-72x72.png',
      tag: 'daily-challenge'
    });
    
  } catch (error) {
    console.error('Error fetching daily challenge:', error);
  }
}

console.log('Service Worker loaded successfully');
