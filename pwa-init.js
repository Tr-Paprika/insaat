// PWA Service Worker Kaydı
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Service Worker yüklenmedi
  });
}

// PWA Yükle Butonu
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const btn = document.getElementById('pwaYukleBtn');
  if (btn) btn.style.display = 'inline-flex';
});

function pwaYukle() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt = null;
}

// Offline Desteği
window.addEventListener('offline', () => {
  console.log('Çevrimdışı moda geçildi');
});

window.addEventListener('online', () => {
  console.log('Çevrimiçi moda geçildi');
});
