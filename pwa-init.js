// ── SERVICE WORKER KAYIT ──────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('[PWA] Kayıtlı:', reg.scope);

      reg.addEventListener('updatefound', () => {
        const yeni = reg.installing;
        yeni.addEventListener('statechange', () => {
          if (yeni.state === 'installed' && navigator.serviceWorker.controller) {
            if (confirm('🔄 Yeni sürüm hazır! Güncelleme yapılsın mı?')) {
              yeni.postMessage({ tip: 'skipWaiting' });
              location.reload();
            }
          }
        });
      });
    } catch (err) {
      console.warn('[PWA] Hata:', err);
    }
  });

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.tip === 'sync-tamamlandi') {
      if (typeof toast === 'function') toast('☁️ Veriler senkronize edildi', 'basari');
    }
  });
}

// ── ANA EKRANA EKLE PROMPTU ───────────────────────────────
let pwaPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  pwaPrompt = e;
  const btn = document.getElementById('pwa-yukle-btn');
  if (btn) btn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
  pwaPrompt = null;
  if (typeof toast === 'function') toast('✅ ŞantiyePro Ana Ekrana eklendi!', 'basari');
  const btn = document.getElementById('pwa-yukle-btn');
  if (btn) btn.style.display = 'none';
});

async function pwaYukle() {
  if (!pwaPrompt) {
    if (typeof toast === 'function') toast('Tarayıcı menüsünden "Ana Ekrana Ekle" seçin', 'uyari');
    return;
  }
  pwaPrompt.prompt();
  const { outcome } = await pwaPrompt.userChoice;
  if (outcome === 'accepted' && typeof toast === 'function') toast('✅ Kuruluyor...', 'basari');
  pwaPrompt = null;
}

// ── PUSH BİLDİRİM ─────────────────────────────────────────
async function pushBildirimAktiflestir() {
  if (!('Notification' in window)) {
    if (typeof toast === 'function') toast('Tarayıcınız bildirimleri desteklemiyor', 'uyari');
    return;
  }
  const izin = await Notification.requestPermission();
  if (izin === 'granted') {
    if (typeof toast === 'function') toast('🔔 Bildirimler aktif!', 'basari');
    new Notification('ŞantiyePro', {
      body: 'Bildirimler aktifleştirildi! Önemli gelişmeleri kaçırmayacaksınız.',
      icon: './icons/icon-192.png'
    });
  } else {
    if (typeof toast === 'function') toast('Bildirim izni reddedildi', 'hata');
  }
}

// ── ONLINE / OFFLINE ──────────────────────────────────────
window.addEventListener('online', () => {
  if (typeof toast === 'function') toast('🌐 Bağlantı kuruldu — Veriler senkronize ediliyor', 'basari');
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => reg.sync.register('veri-sync'));
  }
});

window.addEventListener('offline', () => {
  if (typeof toast === 'function') toast('📴 Çevrimdışı mod — Veriler yerel kaydediliyor', 'uyari');
});

// ── TOPBAR BUTON EKLE ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;

  // PWA Yükle butonu
  const pwaBtn = document.createElement('button');
  pwaBtn.className = 'topbar-btn';
  pwaBtn.id = 'pwa-yukle-btn';
  pwaBtn.style.display = 'none';
  pwaBtn.innerHTML = '📲 Ana Ekrana Ekle';
  pwaBtn.onclick = pwaYukle;
  topbar.appendChild(pwaBtn);

  // Bildirim butonu
  const notifBtn = document.createElement('button');
  notifBtn.className = 'topbar-btn';
  notifBtn.innerHTML = '🔔 Bildirimleri Aç';
  notifBtn.onclick = pushBildirimAktiflestir;
  topbar.appendChild(notifBtn);

  // Online/offline göstergesi
  const durum = document.createElement('div');
  durum.id = 'baglanti-durum';
  durum.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:.78rem;padding:4px 10px;border-radius:99px;background:#dcfce7;color:#15803d;font-weight:600';
  durum.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block"></span> Çevrimiçi';
  topbar.appendChild(durum);

  window.addEventListener('online', () => {
    durum.style.background = '#dcfce7'; durum.style.color = '#15803d';
    durum.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block"></span> Çevrimiçi';
  });

  window.addEventListener('offline', () => {
    durum.style.background = '#fef9c3'; durum.style.color = '#854d0e';
    durum.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#ca8a04;display:inline-block"></span> Çevrimdışı';
  });
});