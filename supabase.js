// ═══════════════════════════════════════
// supabase.js — Gerçek Zamanlı Sync
// ═══════════════════════════════════════

const SB_KANAL = 'santiyepro-realtime';
let _sbKanal = null;
let _syncTimeout = null;

// ── OTOMATİK SYNC ─────────────────────
function otomatikSyncBaslat() {
  if(!_supabase) return;
  // Her kayıt işleminde 3 saniye bekle sonra sync yap
  const _kaydetEski = kaydet;
  window._kaydetOriginal = _kaydetEski;
  kaydet = function() {
    _kaydetEski();
    if(_supabase) {
      clearTimeout(_syncTimeout);
      _syncTimeout = setTimeout(()=>{
        supabaseYukle().catch(()=>{});
      }, 3000);
    }
  };
  console.log('[Supabase] Otomatik sync aktif');
}

// ── GERÇEK ZAMANLI DİNLEYİCİ ──────────
function realtimeBaslat() {
  if(!_supabase) return;
  if(_sbKanal) _sbKanal.unsubscribe();
  _sbKanal = _supabase
    .channel(SB_KANAL)
    .on('postgres_changes',{
      event: 'UPDATE',
      schema: 'public',
      table: 'santiyepro_veri',
      filter: 'kullanici_id=eq.varsayilan'
    }, payload => {
      console.log('[Realtime] Güncelleme geldi');
      if(payload.new?.veri) {
        // Çakışma kontrolü
        const uzak = payload.new.veri;
        const uzakZaman = new Date(payload.new.guncelleme||0);
        const yerelZaman = new Date((veri.ayarlar||{}).sonKayit||0);
        if(uzakZaman > yerelZaman) {
          if(confirm('☁️ Başka bir cihazdan güncelleme geldi. Uygulamak ister misiniz?')) {
            veri = {...veri,...uzak};
            kaydet();
            if(typeof sayfaGit==='function') sayfaGit(window._aktifSayfa||'panel');
            toast('🔄 Gerçek zamanlı güncelleme uygulandı','basari');
          }
        }
      }
    })
    .subscribe(status => {
      console.log('[Realtime] Durum:', status);
      if(status==='SUBSCRIBED') toast('🔴 Gerçek zamanlı sync aktif','basari');
    });
}

function realtimeDurdur() {
  if(_sbKanal) { _sbKanal.unsubscribe(); _sbKanal=null; }
}

// Supabase bağlandığında otomatik başlat
const _supabaseBaglanEski = supabaseBaglan;
supabaseBaglan = function() {
  _supabaseBaglanEski();
  setTimeout(()=>{
    if(_supabase) {
      otomatikSyncBaslat();
      realtimeBaslat();
    }
  },1500);
};

// Kayıt zamanını takip et
const __kaydetEski = kaydet;
kaydet = function() {
  __kaydetEski();
  if(!veri.ayarlar) veri.ayarlar={};
  veri.ayarlar.sonKayit = new Date().toISOString();
  __kaydetEski();
};

// ── ROL YÖNETİMİ ──────────────────────
const ROLLER = {
  admin: {
    ad: 'Yönetici',
    izinler: ['hepsini_gor','hepsini_duzenle','sil','bordro','hakedis','supabase']
  },
  muhasebe: {
    ad: 'Muhasebe',
    izinler: ['hepsini_gor','hakedis','bordro','butce']
  },
  saha: {
    ad: 'Saha Sorumlusu',
    izinler: ['santiye_gor','yoklama','ilerleme','kamera','talep']
  },
  izleyici: {
    ad: 'İzleyici',
    izinler: ['hepsini_gor']
  }
};

let _aktifRol = localStorage.getItem('sp_rol')||'admin';

function rolBelirle(rol) {
  if(!ROLLER[rol]) return;
  _aktifRol = rol;
  localStorage.setItem('sp_rol', rol);
  rolUygula();
  toast(`Rol değiştirildi: ${ROLLER[rol].ad}`,'basari');
}

function rolUygula() {
  const rol = ROLLER[_aktifRol]||ROLLER.admin;
  const izinler = rol.izinler;
  // Supabase sayfasını gizle
  const sbBtn = document.querySelector('[data-sayfa="supabase"]');
  if(sbBtn) sbBtn.style.display = izinler.includes('supabase')?'':'none';
  // Bordro sayfasını gizle
  const bBtn = document.querySelector('[data-sayfa="bordro"]');
  if(bBtn) bBtn.style.display = izinler.includes('bordro')?'':'none';
  // Sil butonlarını gizle
  document.querySelectorAll('.btn-danger').forEach(btn=>{
    btn.style.display = izinler.includes('sil')||izinler.includes('hepsini_duzenle')?'':'none';
  });
}

// ── ÇEVRİMDIŞI KUYRUK ────────────────
const KUYRUK_KEY = 'sp_sync_kuyruk';

function kuyruğaEkle(islem) {
  const kuyruk = JSON.parse(localStorage.getItem(KUYRUK_KEY)||'[]');
  kuyruk.push({...islem, zaman: new Date().toISOString()});
  localStorage.setItem(KUYRUK_KEY, JSON.stringify(kuyruk));
}

async function kuyruguIsle() {
  if(!_supabase) return;
  const kuyruk = JSON.parse(localStorage.getItem(KUYRUK_KEY)||'[]');
  if(!kuyruk.length) return;
  console.log(`[Sync] ${kuyruk.length} bekleyen işlem işleniyor`);
  try {
    await supabaseYukle();
    localStorage.setItem(KUYRUK_KEY,'[]');
    toast(`☁️ ${kuyruk.length} bekleyen işlem senkronize edildi`,'basari');
  } catch(e) {
    console.warn('[Sync] Kuyruk işlenemedi:', e);
  }
}

// Online olunca kuyruğu işle
window.addEventListener('online', ()=>{
  setTimeout(kuyruguIsle, 2000);
});

// Offline'da kayıt yapılırsa kuyruğa ekle
window.addEventListener('offline', ()=>{
  const __k = kaydet;
  window._offlineKaydet = function() {
    __k();
    kuyruğaEkle({tip:'veri_guncelleme'});
  };
});

// ── ÇOKLU CİHAZ SYNC PANEL ────────────
function syncPanelGoster() {
  const kuyruk = JSON.parse(localStorage.getItem(KUYRUK_KEY)||'[]');
  const el = document.getElementById('sb-sync-durum'); if(!el) return;
  const ekstra = kuyruk.length>0
    ?`<div style="margin-top:6px;font-size:.75rem;color:#854d0e">⏳ ${kuyruk.length} bekleyen işlem var</div>`:'';
  const son = (veri.ayarlar||{}).sonKayit
    ?`<div style="margin-top:4px;font-size:.73rem;color:var(--metin-acik)">Son kayıt: ${new Date(veri.ayarlar.sonKayit).toLocaleString('tr-TR')}</div>`:'';
  el.insertAdjacentHTML('beforeend', ekstra+son);
}

// ── PANEL CHART'LARI ──────────────────
let _panelChart1=null, _panelChart2=null;

function panelChartlariCiz() {
  if(!window.Chart) return;
  panelMaliyetMiniCiz();
  panelIlerlemeRadarCiz();
}

function panelMaliyetMiniCiz() {
  const kap = document.getElementById('panel-maliyet-mini');
  if(!kap) return;
  const mevcut = document.getElementById('panel-maliyet-canvas');
  if(mevcut) mevcut.remove();
  const canvas = document.createElement('canvas');
  canvas.id='panel-maliyet-canvas';
  canvas.style.cssText='width:100%;max-height:160px';
  kap.appendChild(canvas);
  if(_panelChart1) { _panelChart1.destroy(); _panelChart1=null; }
  const aylar=[], veriler=[];
  for(let i=4;i>=0;i--) {
    const d=new Date(); d.setMonth(d.getMonth()-i);
    const ayStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    aylar.push(d.toLocaleDateString('tr-TR',{month:'short'}));
    veriler.push((veri.maliyetler||[])
      .filter(m=>m.tarih?.startsWith(ayStr))
      .reduce((t,m)=>t+m.miktar*m.fiyat,0));
  }
  _panelChart1 = new Chart(canvas,{
    type:'line',
    data:{
      labels:aylar,
      datasets:[{
        label:'Aylık Maliyet',data:veriler,
        borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,0.08)',
        fill:true,tension:0.4,pointRadius:4,pointBackgroundColor:'#2563eb'
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        y:{ticks:{callback:v=>{
          if(v>=1000000) return (v/1000000).toFixed(1)+'M₺';
          if(v>=1000) return (v/1000).toFixed(0)+'K₺';
          return v+'₺';
        },font:{size:10}}},
        x:{ticks:{font:{size:10}}}
      }
    }
  });
}

function panelIlerlemeRadarCiz() {
  const kap = document.getElementById('panel-ilerleme-mini');
  if(!kap||!veri.santiyeler.length) return;
  const mevcut = document.getElementById('panel-ilerleme-canvas');
  if(mevcut) mevcut.remove();
  const canvas = document.createElement('canvas');
  canvas.id='panel-ilerleme-canvas';
  canvas.style.cssText='width:100%;max-height:160px';
  kap.appendChild(canvas);
  if(_panelChart2) { _panelChart2.destroy(); _panelChart2=null; }
  const labels=veri.santiyeler.slice(0,6).map(s=>s.adi);
  const data=veri.santiyeler.slice(0,6).map(s=>
    Math.round(ASAMALAR.reduce((t,a)=>t+Number((veri.ilerleme[s.id]||{})[a.id]?.yuzde||0),0)/ASAMALAR.length)
  );
  _panelChart2 = new Chart(canvas,{
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:'İlerleme %',data,
        backgroundColor:veri.santiyeler.slice(0,6).map(s=>(s.renk||'#2563eb')+'99'),
        borderColor:veri.santiyeler.slice(0,6).map(s=>s.renk||'#2563eb'),
        borderWidth:2,borderRadius:8
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%',font:{size:10}}},
        x:{ticks:{font:{size:10}}}
      }
    }
  });
}

// Panel'e chart alanları ekle
function panelChartAlanlariEkle() {
  const panel = document.getElementById('sayfa-panel');
  if(!panel||document.getElementById('panel-chart-alan')) return;
  const div = document.createElement('div');
  div.id='panel-chart-alan';
  div.className='grid-2';
  div.style.marginTop='14px';
  div.innerHTML=`
    <div class="kart">
      <div class="kart-baslik">💸 Aylık Maliyet Trendi</div>
      <div id="panel-maliyet-mini" style="height:160px;position:relative"></div>
    </div>
    <div class="kart">
      <div class="kart-baslik">🏗️ Şantiye İlerleme</div>
      <div id="panel-ilerleme-mini" style="height:160px;position:relative"></div>
    </div>
  `;
  panel.appendChild(div);
}

// ── ERP ENTEGRASYON LOG ───────────────
const ENT_LOG_KEY = 'sp_ent_log';

function entLogEkle(mesaj, tip='bilgi') {
  const loglar = JSON.parse(localStorage.getItem(ENT_LOG_KEY)||'[]');
  loglar.unshift({mesaj, tip, zaman:new Date().toLocaleString('tr-TR')});
  if(loglar.length>50) loglar.pop();
  localStorage.setItem(ENT_LOG_KEY, JSON.stringify(loglar));
}

function entLogGoster() {
  const el = document.getElementById('ent-log-panel');
  if(!el) return;
  const loglar = JSON.parse(localStorage.getItem(ENT_LOG_KEY)||'[]');
  if(!loglar.length){ el.innerHTML='<div style="font-size:.8rem;color:var(--metin-acik)">Henüz entegrasyon logu yok</div>'; return; }
  el.innerHTML = loglar.slice(0,10).map(l=>`
    <div class="enteg-log ${l.tip==='uyari'?'enteg-log-uyari':''}">
      <span style="font-size:.7rem;color:var(--metin-acik);min-width:110px">${l.zaman}</span>
      <span>${l.mesaj}</span>
    </div>`).join('');
}

// ── PANEL GÜNCELLEME ──────────────────
const _panelGuncelleEski = typeof panelGuncelle==='function'?panelGuncelle:()=>{};
panelGuncelle = function() {
  _panelGuncelleEski();
  setTimeout(()=>{
    panelChartAlanlariEkle();
    panelChartlariCiz();
  },200);
};

// ── GELİŞMİŞ PANEL STAT EKLEMESİ ─────
function panelYeniStatGoster() {
  const el = document.getElementById('panel-yeni-stat');
  if(!el) return;
  const bekleyenTalep=(veri.talepler||[]).filter(t=>t.durum==='bekliyor').length;
  const bekleyenHakedis=(veri.hakedisler||[]).filter(h=>h.durum!=='odendi'&&h.durum!=='reddedildi').length;
  const toplamBordro=Object.values(veri.bordro||{}).filter(b=>b.durum==='bekliyor').length;
  el.innerHTML=[
    {ikon:'📋',sayi:bekleyenTalep,etiket:'Bekleyen Talep',renk:'#fef9c3',sayfa:'ic-talep'},
    {ikon:'🧾',sayi:bekleyenHakedis,etiket:'Bekleyen Hakediş',renk:'#dbeafe',sayfa:'hakedis'},
    {ikon:'💵',sayi:toplamBordro,etiket:'Bekleyen Bordro',renk:'#dcfce7',sayfa:'bordro'},
  ].map(s=>`
    <div class="stat-kart" onclick="sayfaGit('${s.sayfa}')" style="cursor:pointer">
      <div class="stat-ikon" style="background:${s.renk}">${s.ikon}</div>
      <div>
        <div class="stat-sayi">${s.sayi}</div>
        <div class="stat-etiket">${s.etiket}</div>
      </div>
    </div>`).join('');
}

// Panel'e yeni stat alanı ekle
function panelYeniStatAlaniEkle() {
  const panel = document.getElementById('sayfa-panel');
  if(!panel||document.getElementById('panel-yeni-stat')) return;
  const div = document.createElement('div');
  div.className='grid-4';
  div.id='panel-yeni-stat';
  div.style.marginTop='0';
  // İlk stat grubundan sonra ekle
  const ilkGrid = panel.querySelector('.grid-4');
  if(ilkGrid) ilkGrid.insertAdjacentElement('afterend',div);
  else panel.prepend(div);
}

// ── BAŞLANGIÇ ─────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    panelYeniStatAlaniEkle();
    panelYeniStatGoster();
    panelChartAlanlariEkle();
    panelChartlariCiz();
    rolUygula();
    syncPanelGoster();

    // Offline banner
    const banner = document.createElement('div');
    banner.id='offline-banner';
    banner.className='offline-banner';
    banner.textContent='📴 Çevrimdışı mod — Veriler cihazınıza kaydediliyor';
    document.body.prepend(banner);
    window.addEventListener('offline',()=>banner.classList.add('goster'));
    window.addEventListener('online',()=>banner.classList.remove('goster'));
  },600);
});

// Rol seçici panel'e ekle
function rolSeciciEkle() {
  const topbar = document.querySelector('.topbar');
  if(!topbar||document.getElementById('rol-sec')) return;
  const div = document.createElement('div');
  div.id='rol-sec';
  div.style.cssText='display:flex;align-items:center;gap:6px;font-size:.78rem';
  div.innerHTML=`
    <span style="color:var(--metin-acik)">Rol:</span>
    <select style="padding:4px 8px;border:1.5px solid var(--sinir);border-radius:7px;font-family:'DM Sans',sans-serif;font-size:.78rem"
      onchange="rolBelirle(this.value)">
      ${Object.entries(ROLLER).map(([k,v])=>`<option value="${k}" ${k===_aktifRol?'selected':''}>${v.ad}</option>`).join('')}
    </select>
  `;
  topbar.insertBefore(div, topbar.firstChild);
}

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(rolSeciciEkle,700);
});