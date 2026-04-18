// ŞantiyePro Service Worker v2.0
const CACHE_ADI = 'santiyepro-v2';
const OFFLINE_URL = './index.html';

// Cache'e alınacak dosyalar
const STATIK_DOSYALAR = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // CDN kaynakları
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap',
];

// ── KURULUM ───────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Kuruluyor...');
  event.waitUntil(
    caches.open(CACHE_ADI).then(cache => {
      console.log('[SW] Dosyalar önbelleğe alınıyor');
      return cache.addAll(STATIK_DOSYALAR.map(url => {
        return new Request(url, { cache: 'reload' });
      })).catch(err => {
        console.warn('[SW] Bazı dosyalar önbelleğe alınamadı:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── AKTİFLEŞTİRME ────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Aktifleşiyor...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_ADI)
          .map(key => {
            console.log('[SW] Eski cache siliniyor:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH STRATEJİSİ ──────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Supabase API isteklerini cache'leme
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Navigasyon istekleri
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Statik dosyalar — Cache First
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Diğerleri — Network First
  event.respondWith(networkFirst(request));
});

// ── CACHE STRATEJİLERİ ────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_ADI);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline - İçerik bulunamadı', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_ADI);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Çevrimdışısınız', offline: true }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    );
  }
}

// ── PUSH BİLDİRİM ─────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || 'Yeni bildirim',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
    actions: [
      { action: 'ac', title: '📂 Aç' },
      { action: 'kapat', title: '✕ Kapat' }
    ],
    requireInteraction: false
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'ŞantiyePro', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'ac' || !event.action) {
    const url = event.notification.data?.url || './';
    event.waitUntil(clients.openWindow(url));
  }
});

// ── ARKA PLAN SYNC ────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'veri-sync') {
    event.waitUntil(arkaPlanSync());
  }
});

async function arkaPlanSync() {
  console.log('[SW] Arka plan sync başladı');
  // Supabase sync burada tetiklenecek (P5'te implement edilecek)
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ tip: 'sync-tamamlandi' });
  });
}