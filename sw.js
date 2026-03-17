const CACHE_NAME = 'statiq-v6';
const PRECACHE = [
  './',
  './index.html'
];
const CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'www.gstatic.com/firebasejs'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API・Auth・Firestore: network-first
  if(url.pathname.startsWith('/api/') ||
     url.hostname.includes('firestore.googleapis.com') ||
     url.hostname.includes('identitytoolkit.googleapis.com') ||
     url.hostname.includes('securetoken.googleapis.com')){
    e.respondWith(fetch(e.request).catch(() => new Response('{}', {status:503, headers:{'Content-Type':'application/json'}})));
    return;
  }

  // CDN: cache-first (fonts, Firebase SDK, jspdf)
  const isCDN = CDN_PATTERNS.some(p => url.hostname.includes(p));
  if(isCDN){
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached;
        return fetch(e.request).then(resp => {
          if(resp.ok){
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => new Response('', {status:503}));
      })
    );
    return;
  }

  // Everything else: network-first, cache fallback
  e.respondWith(
    fetch(e.request).then(resp => {
      if(resp.ok && e.request.method === 'GET'){
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => caches.match(e.request).then(c => c || caches.match('./')))
  );
});
