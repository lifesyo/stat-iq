const CACHE = 'statiq-v5';
const ASSETS = [
  './',
  './index.html'
];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all([
        ...ASSETS.map(url => cache.add(url).catch(() => {})),
        ...CDN_ASSETS.map(url =>
          fetch(url, { mode: 'cors' }).then(r => {
            if (r.ok) return cache.put(url, r);
          }).catch(() => {})
        )
      ])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Skip Firebase/Google auth requests
  if (url.includes('googleapis.com/identitytoolkit') ||
      url.includes('securetoken.googleapis.com') ||
      url.includes('firestore.googleapis.com') ||
      url.includes('www.gstatic.com/firebasejs') ||
      url.includes('firebaseapp.com') ||
      url.includes('accounts.google.com') ||
      url.includes('/__/auth/')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok && (url.startsWith(self.location.origin) || CDN_ASSETS.some(a => url.startsWith(a)))) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503 });
      });
    })
  );
});
