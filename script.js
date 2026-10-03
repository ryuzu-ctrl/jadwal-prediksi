/* ===== KAPAL JUDI — premium 2026 rebuild ===== */
/* Football data is proxied through a Supabase Edge Function so the API key
   never reaches the browser. */

   const SUPABASE_URL = 'https://wojkxjwgulsdgrsgxmro.supabase.co';
   const FN_BASE = `${SUPABASE_URL}/functions/v1/football-api`;
   const SUPABASE_ANON_KEY =
     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvamt4andndWxzZGdyc2d4bXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzAyMTksImV4cCI6MjEwMjg0NjIxOX0.5ad841Dku8oGzuQbio0QEPu5GsK7AQlf7yCwyML7_I0';
   const FN_HEADERS = {
     Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
     'Content-Type': 'application/json',
   };
   const TZ = 'Asia/Jakarta';
   
   let offset = 0;
  let fixtures = [];
  let selectedFixtures = [];
  let predictionByFixture = new Map();
  let predictionErrors = new Map();
  const apiCache = new Map();
  const apiRequests = new Map();
   let timer;
   let currentTab = 'schedule';
   let searchQuery = '';
  const FIXTURE_LIMIT = 10;
  const CACHE_TTL_MS = 5 * 60 * 1000;
   
   const $ = (id) => document.getElementById(id);
   const esc = (x) =>
     String(x ?? '').replace(/[&<>"']/g, (c) =>
       ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])
     );
   
   /* ---------- helpers ---------- */
   function pad(n) {
     return String(n).padStart(2, '0');
   }
   
   function nowStamp() {
     return new Intl.DateTimeFormat('id-ID', {
       timeZone: TZ,
       day: '2-digit',
       month: '2-digit',
       year: 'numeric',
       hour: '2-digit',
       minute: '2-digit',
       second: '2-digit',
       hour12: false,
     }).format(new Date());
   }
   
   function timeFmt(iso) {
     return new Intl.DateTimeFormat('id-ID', {
       timeZone: TZ,
       hour: '2-digit',
       minute: '2-digit',
       hour12: false,
     }).format(new Date(iso));
   }
   
   function statusBadge(f) {
     const s = f.fixture.status;
     const live = ['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(s.short);
     if (live) return `<span class="live-badge">LIVE ${s.elapsed ? s.elapsed + "'" : ''}</span>`;
     if (s.short === 'NS') return `<span class="status-badge">UPCOMING</span>`;
     return `<span class="status-badge">${esc(s.short || '')}</span>`;
   }
   
   /* ---------- edge function fetch with timeout + retry ---------- */
   async function fnFetch(action, params = {}, retries = 1) {
     const u = new URL(`${FN_BASE}/${action}`);
     Object.entries(params).forEach(([k, v]) => {
       if (v !== '' && v != null) u.searchParams.set(k, v);
     });
     const controller = new AbortController();
     const to = setTimeout(() => controller.abort(), 13000);
     try {
       const r = await fetch(u, { headers: FN_HEADERS, signal: controller.signal });
       const d = await r.json().catch(() => ({}));
       if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
       return d.data;
     } catch (e) {
       if (retries > 0 && !(e instanceof DOMException && e.name === 'AbortError')) {
         await new Promise((r) => setTimeout(r, 600));
         return fnFetch(action, params, retries - 1);
       }
       throw e;
     } finally {
       clearTimeout(to);
     }
   }
   
   async function cachedFnFetch(action, params = {}) {
     const key = `${action}:${JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)))}`;
     const cached = apiCache.get(key);
     if (cached && cached.expiresAt > Date.now()) return cached.data;
     if (apiRequests.has(key)) return apiRequests.get(key);

     const request = fnFetch(action, params)
       .then((data) => {
         apiCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
         return data;
       })
       .finally(() => apiRequests.delete(key));
     apiRequests.set(key, request);
     return request;
   }

   function popularityScore(fixture) {
     const config = window.POPULARITY_CONFIG || {};
     const normalizeName = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
     const configuredNameWeight = (value, weights) => {
       const normalizedValue = normalizeName(value);
       return Object.entries(weights || {}).reduce((highest, [name, weight]) =>
         normalizedValue.includes(normalizeName(name)) ? Math.max(highest, Number(weight) || 0) : highest, 0);
     };
     const leagueWeight = Math.max(
       Number(config.leagueWeights?.[fixture.league.id]) || 0,
       configuredNameWeight(fixture.league.name, config.leagueNameWeights)
     );
     const teamWeights = config.teamWeights || {};
     const teamNameWeights = config.teamNameWeights || {};
     const homeWeight = Math.max(
       Number(teamWeights[fixture.teams.home.id]) || 0,
       configuredNameWeight(fixture.teams.home.name, teamNameWeights)
     );
     const awayWeight = Math.max(
       Number(teamWeights[fixture.teams.away.id]) || 0,
       configuredNameWeight(fixture.teams.away.name, teamNameWeights)
     );
     const pair = [fixture.teams.home.id, fixture.teams.away.id].sort((a, b) => a - b);
     const configuredDerby = (config.rivalries || []).some(([home, away]) =>
       pair[0] === Math.min(home, away) && pair[1] === Math.max(home, away)
     );
     const threshold = config.topTeamThreshold || 80;
     const popularMatch = homeWeight >= threshold && awayWeight >= threshold;
     const short = fixture.fixture.status.short;
     const hoursToKickoff = (new Date(fixture.fixture.date).getTime() - Date.now()) / 3600000;
     const timeBonus = ['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(short)
       ? (config.timeBonuses?.live || 1000)
       : hoursToKickoff >= 0 && hoursToKickoff <= 24
         ? (config.timeBonuses?.within24Hours || 700)
         : hoursToKickoff > 24 && hoursToKickoff <= 72
           ? (config.timeBonuses?.within72Hours || 250)
           : 0;

     return leagueWeight + homeWeight + awayWeight
       + (configuredDerby || popularMatch ? (config.derbyBonus || 260) : 0)
       + timeBonus;
   }

   function selectFixtures() {
     selectedFixtures = [...fixtures]
       .sort((a, b) => {
         const scoreDifference = popularityScore(b) - popularityScore(a);
         return scoreDifference || new Date(a.fixture.date) - new Date(b.fixture.date);
       })
       .slice(0, FIXTURE_LIMIT);
   }

   /* ---------- schedule ---------- */
   function renderSchedule() {
     const list = $('scheduleList');
     const query = searchQuery.trim().toLowerCase();
     const filtered = query
       ? selectedFixtures.filter((f) => {
           const home = (f.teams.home.name || '').toLowerCase();
           const away = (f.teams.away.name || '').toLowerCase();
           return home.includes(query) || away.includes(query);
         })
      : selectedFixtures;
     if (!filtered.length) {
       list.innerHTML = query
         ? '<div class="empty-state"><b>Tidak ada pertandingan ditemukan</b><span>Coba kata kunci lain untuk nama tim.</span></div>'
         : '<div class="empty-state"><b>Tidak ada pertandingan</b><span>Tidak ada fixture untuk tanggal ini.</span></div>';
       return;
     }
     list.innerHTML =
       filtered
         .map((f) => {
           const h = f.teams.home, a = f.teams.away, lg = f.league;
           const sc = ['NS', 'TBD'].includes(f.fixture.status.short)
             ? 'VS'
             : `${f.goals.home ?? 0} : ${f.goals.away ?? 0}`;
           return `<div class="match-card">
             <div class="match-time">${timeFmt(f.fixture.date)} WIB${statusBadge(f)}</div>
             <div class="match-main">
               <div class="league-line">${lg.logo ? `<img src="${esc(lg.logo)}" loading="lazy">` : ''}<span>${esc(lg.name)}</span></div>
               <div class="team-line">${h.logo ? `<img src="${esc(h.logo)}" loading="lazy">` : ''}<span>${esc(h.name)}</span></div>
               <div class="team-line">${a.logo ? `<img src="${esc(a.logo)}" loading="lazy">` : ''}<span>${esc(a.name)}</span></div>
             </div>
             <div class="score-box"><span class="score-value">${sc}</span></div>
           </div>`;
         })
         .join('') + '<div class="api-note">Sumber API-Football • WIB</div>';
   }
   
   async function loadSchedule() {
     $('apiStatusText').textContent = 'Memuat jadwal…';
     $('statusDot').className = 'status-dot loading';
     const data = await cachedFnFetch('fixtures', { offset });
     fixtures = data || [];
     selectFixtures();
     renderSchedule();
     renderUpcoming();
     renderMarquee();
     if (!selectedFixtures.length) {
       $('predictionList').innerHTML = '<div class="empty-state"><b>Tidak ada pertandingan</b><span>Tidak ada fixture untuk tanggal ini.</span></div>';
     }
     const live = fixtures.filter((f) =>
       ['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(f.fixture.status.short)
     ).length;
    $('apiStatusText').textContent = `${selectedFixtures.length} pertandingan dipilih dari ${fixtures.length} • ${live} LIVE`;
     $('statusDot').className = 'status-dot';
     $('updateTime').textContent = `🕐 Update: ${nowStamp()}`;
   }

   /* ---------- upcoming match (auto, reads from fixtures) ---------- */
   let upcomingTimer = null;
   function renderUpcoming() {
     const el = $('upcomingList');
     if (!el) return;
     const now = Date.now();
     const list = fixtures
       .filter((f) => {
         const d = new Date(f.fixture.date).getTime();
         return d >= now && ['NS', 'TBD'].includes(f.fixture.status.short);
       })
       .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
       .slice(0, 5);

     if (!list.length) {
       el.innerHTML =
         '<div class="empty-state"><b>Tidak ada pertandingan mendatang.</b><span>Pantau terus untuk update jadwal terdekat.</span></div>';
       return;
     }

     el.innerHTML = list
       .map((f) => {
         const h = f.teams.home, a = f.teams.away, lg = f.league;
         const dt = new Date(f.fixture.date);
         const dateStr = new Intl.DateTimeFormat('id-ID', {
           timeZone: TZ,
           day: '2-digit',
           month: 'short',
         }).format(dt);
         return `<div class="upcoming__item">
           <div class="upcoming__time">${timeFmt(f.fixture.date)}</div>
           <div class="upcoming__info">
             <div class="upcoming__teams">${esc(h.name)} <span style="color:#8e70a6">vs</span> ${esc(a.name)}</div>
             <div class="upcoming__league">${esc(lg.name)}</div>
             <div class="upcoming__date">${dateStr} • WIB</div>
           </div>
         </div>`;
       })
       .join('');
   }
   
   /* ---------- prediction score formatter ---------- */
   function formatPredScore(home, away) {
     const parseHalf = (v) => {
       if (v === null || v === undefined) return null;
       const s = String(v).trim();
       if (s === '' || s.toLowerCase() === 'n/a') return null;
       const n = Number(s);
       if (!Number.isFinite(n) || n < 0) return null;
       return Math.floor(n);
     };
     const h = parseHalf(home);
     const a = parseHalf(away);
     if (h === null || a === null) return null;
     return `PREDIKSI ${h} : ${a}`;
   }

   /* ---------- predictions ---------- */
   let predictionItems = [];
   async function loadPredictions() {
     const list = $('predictionList');
     if (!selectedFixtures.length) {
       predictionItems = [];
       list.innerHTML = '<div class="empty-state"><b>Tidak ada pertandingan</b><span>Tidak ada fixture untuk tanggal ini.</span></div>';
       return;
     }
     list.innerHTML =
       '<div class="loading-state"><div class="loader"></div><b>Memuat prediksi…</b><span>Jadwal dan prediksi menggunakan daftar pertandingan yang sama.</span></div>';
     for (const f of selectedFixtures) {
       try {
         const d = await cachedFnFetch('predictions', { fixture: f.fixture.id });
         predictionByFixture.set(f.fixture.id, d?.[0]?.predictions || null);
         predictionErrors.delete(f.fixture.id);
       } catch (e) {
         predictionErrors.set(f.fixture.id, e.message || 'Gagal memuat prediksi');
         console.warn(e);
       }
       await new Promise((r) => setTimeout(r, 180));
     }
     predictionItems = selectedFixtures.map((f) => ({
       f,
       p: predictionByFixture.get(f.fixture.id) || null,
     }));
     renderPredictionList();
   }

   function renderPredictionList() {
     const list = $('predictionList');
     if (!predictionItems.length) {
       list.innerHTML = '<div class="empty-state"><b>Tidak ada pertandingan</b><span>Tidak ada fixture untuk tanggal ini.</span></div>';
       return;
     }

     const query = searchQuery.trim().toLowerCase();
     const filtered = query
       ? predictionItems.filter(({ f }) => {
           const home = (f.teams.home.name || '').toLowerCase();
           const away = (f.teams.away.name || '').toLowerCase();
           return home.includes(query) || away.includes(query);
         })
       : predictionItems;

     if (!filtered.length) {
       list.innerHTML = '<div class="empty-state"><b>Tidak ada prediksi ditemukan</b><span>Coba kata kunci lain untuk nama tim.</span></div>';
       return;
     }

     const grouped = filtered.reduce((groups, item) => {
       const leagueName = item.f.league.name || 'Kompetisi lainnya';
       const group = groups.get(leagueName) || [];
       group.push(item);
       groups.set(leagueName, group);
       return groups;
     }, new Map());

     list.innerHTML = Array.from(grouped.entries())
       .map(([leagueName, matches]) => `
         <section class="prediction-league-group" aria-label="${esc(leagueName)}">
           <h3 class="prediction-league-title"><i class="fas fa-layer-group"></i> ${esc(leagueName)}</h3>
           <div class="prediction-league-list">
             ${matches.map(({ f, p }) => {
               const g = p?.goals || {};
               const score = formatPredScore(g.home, g.away);
               const predictionError = predictionErrors.get(f.fixture.id);
               const dateTime = new Intl.DateTimeFormat('id-ID', {
                 timeZone: TZ,
                 day: '2-digit',
                 month: '2-digit',
                 year: 'numeric',
                 hour: '2-digit',
                 minute: '2-digit',
                 hour12: false,
               }).format(new Date(f.fixture.date));
               return `<article class="prediction-card">
                 <div class="prediction-head">
                   <div class="prediction-time"><i class="far fa-clock"></i> ${dateTime} WIB</div>
                   ${p
                     ? '<span class="prediction-status"><i class="fas fa-circle-check"></i> Prediksi tersedia</span>'
                     : `<span class="prediction-status prediction-status--empty" title="${esc(predictionError || '')}">${predictionError ? 'Prediksi gagal dimuat' : 'Prediksi belum tersedia'}</span>`}
                 </div>
                 <div class="prediction-body">
                   <div class="prediction-teams"><span>${esc(f.teams.home.name)}</span><b>VS</b><span>${esc(f.teams.away.name)}</span></div>
                   <span class="prediction-score">${esc(score || (predictionError ? 'Gagal dimuat' : 'Belum tersedia'))}</span>
                 </div>
               </article>`;
             }).join('')}
           </div>
         </section>`)
      .join('');
   }
   
   /* ---------- refresh ---------- */
   async function refresh() {
     clearTimeout(timer);
     $('refreshBtn').disabled = true;
     try {
       await loadSchedule();
       if (currentTab === 'prediction') await loadPredictions();
     } catch (e) {
       $('apiStatusText').textContent = 'Error: ' + e.message;
       $('statusDot').className = 'status-dot error';
       $('scheduleList').innerHTML = `<div class="error-state"><b>Gagal mengambil data</b><span>${esc(e.message)}</span><button onclick="refresh()">Coba lagi</button></div>`;
      $('predictionList').innerHTML = `<div class="error-state"><b>Gagal mengambil data pertandingan</b><span>${esc(e.message)}</span><button onclick="refresh()">Coba lagi</button></div>`;
     } finally {
       $('refreshBtn').disabled = false;
       const hasLive = fixtures.some((f) =>
         ['1H', 'HT', '2H', 'ET', 'BT', 'P'].includes(f.fixture.status.short)
       );
       timer = setTimeout(refresh, hasLive ? 30000 : 900000);
     }
   }
   window.refresh = refresh;

   function startUpcomingTicker() {
     if (upcomingTimer) clearInterval(upcomingTimer);
     upcomingTimer = setInterval(renderUpcoming, 30000);
   }
   
   /* ---------- marquee / services / modal ---------- */
   function renderMarquee() {
     const track = $('marqueeTrack');
     if (!track) return;
     const liveStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P'];
     const now = Date.now();
     const matches = selectedFixtures
       .filter((f) => liveStatuses.includes(f.fixture.status.short)
         || (['NS', 'TBD'].includes(f.fixture.status.short)
           && new Date(f.fixture.date).getTime() >= now))
       .sort((a, b) => popularityScore(b) - popularityScore(a)
         || new Date(a.fixture.date) - new Date(b.fixture.date))
       .slice(0, 8);
     const label = '<span class="marquee-item">✦ LIVE SCORE ✦ PREDIKSI JITU ✦</span>';
     const matchItems = matches.map((f) => {
       const live = liveStatuses.includes(f.fixture.status.short);
       const liveScore = `${f.goals.home ?? 0}-${f.goals.away ?? 0}`;
       const liveLabel = live ? `<strong>LIVE ${liveScore}</strong> • ` : '';
       return `<a class="marquee-item marquee-match" href="#jadwal" aria-label="${esc(`${f.teams.home.name} vs ${f.teams.away.name}`)}">✦ ${liveLabel}${esc(f.teams.home.name)} vs ${esc(f.teams.away.name)} • ${timeFmt(f.fixture.date)} WIB • ${esc(f.league.name)}</a>`;
     }).join('');
     const content = matches.length ? `${label}${matchItems}` : label;
     const duplicate = matches.length
       ? content.replace(/<a class="marquee-item marquee-match" href="#jadwal"/g,
         '<a class="marquee-item marquee-match" href="#jadwal" tabindex="-1"')
       : label;
     track.innerHTML = `<div class="marquee__group">${content}</div><div class="marquee__group" aria-hidden="true">${duplicate}</div>`;
   }

   function marquee() {
     renderMarquee();
   }
   
   const SERVICES = [
     ['https://nakodakapal.net/', 'fas fa-globe', 'Website Resmi', 'Akses utama'],
     ['https://shortq.org/kapalapk', 'fab fa-android', 'APK Android', 'Download app'],
     ['https://shortq.org/telegram-kapal', 'fab fa-telegram', 'Telegram Bot', 'Info & update'],
     ['https://shortq.org/waaktifkapal', 'fab fa-whatsapp', 'WhatsApp', 'Customer service'],
     ['https://shortq.org/chat-kapal', 'fas fa-headset', 'Live Chat', '24 jam online'],
   ];
   
   function services() {
     $('serviceTrack').innerHTML = [...SERVICES, ...SERVICES]
       .map(
         (a) =>
           `<a href="${a[0]}" target="_blank" rel="noopener" class="service-item"><i class="${a[1]}"></i><span>${a[2]}</span></a>`
       )
       .join('');
     $('servicesGrid').innerHTML = SERVICES.map(
       (a) =>
         `<a href="${a[0]}" target="_blank" rel="noopener" class="service-card reveal" data-reveal><i class="${a[1]}"></i><span>${a[2]}</span><small>${a[3]}</small></a>`
     ).join('');
     $('modalMenu').innerHTML = SERVICES.map(
       (a) =>
         `<a href="${a[0]}" target="_blank" rel="noopener"><i class="${a[1]}"></i> ${a[2]}</a>`
     ).join('');
   }
   
   /* ---------- watermark ---------- */
   function watermark() {
     const wm = $('wm-overlay');
     const txt = 'KAPAL JUDI';
     let html = '';
     for (let i = 0; i < 40; i++) html += `<span class="wm-text">${txt}</span>`;
     wm.innerHTML = html;
   }
   
   /* ---------- flying stars ---------- */
   function flyingStars() {
     if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
     const container = $('stars');
     if (!container) return;
     const isMobile = window.innerWidth < 768;
     if (isMobile) return; // decorative-only effect, skip on mobile to save battery/CPU
     const variants = ['', 'star--orange', 'star--red', 'star--yellow', 'star--big'];
     const count = 30;

     function spawn() {
       const star = document.createElement('div');
       const variant = variants[Math.floor(Math.random() * variants.length)];
       star.className = 'star ' + variant;
       const startX = Math.random() * 100;
       const startY = Math.random() * 100;
       const angle = Math.random() * Math.PI * 2;
       const dist = 120 + Math.random() * 280;
       const dx = Math.cos(angle) * dist;
       const dy = Math.sin(angle) * dist;
       const duration = 6 + Math.random() * 8;
       const delay = Math.random() * 4;
       star.style.left = startX + '%';
       star.style.top = startY + '%';
       star.style.setProperty('--dx', dx + 'px');
       star.style.setProperty('--dy', dy + 'px');
       star.style.animationDuration = duration + 's';
       star.style.animationDelay = delay + 's';
       container.appendChild(star);
       setTimeout(() => star.remove(), (duration + delay) * 1000 + 500);
     }
   
     for (let i = 0; i < count; i++) {
       setTimeout(spawn, i * 200);
     }
     setInterval(spawn, 1200);
   }
   
   /* ---------- carousel ---------- */
   /* Auto-height carousel: container height follows the active slide's image
      so every banner keeps its native aspect ratio (no crop, no fixed height). */
   const BANNERS = [
     {
       href: 'https://eventkapalbola.ampspeedy.com/',
       src: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi5f9_mvlgjaCUUTv7sU0JBjAXEIio1_e6LRk_d6V8ZAE5xILtgjuQqsVZVftC8Z-ZH0jF05iChSs9MHZ3-Dn6CSmZpahqRBlqDsu0L3PxTQ6gs8IfNr4s1dl6e1qBN_florV73aRthBVZYst7GFTtSTYUBqvCKtV89GSkfYZAzsHa4y1VTCZKVCHM5c_0/s1600/ChatGPT%20Image%20Aug%2020,%202026,%2009_09_24%20AM.png',
       alt: 'KAPAL JUDI banner',
     },
     {
       href: 'https://eventkapalbola.ampspeedy.com/',
       src: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhW7_gWnAD4cQhIsIHpOeHoiZgIGqd9crI6qdUkEVnNZrhoXn2HbfsyISbS4CPR4WLnOAJdQ0iyny3qNlDJg6buCTIpfMZuFSDeZRYxJsknMDlbqhzU__DP-CimE_d7AU5ZL2Lkx7piAo65Bhxb5IaCsLKNH4QcEM_UMXmeXt3dQJTgc_xxAKna74lU_Dk/s600/ChatGPT%20Image%20Aug%2020,%202026,%2010_56_41%20AM.png',
       alt: 'Promo Parlay',
     },
     {
       href: 'https://eventkapalbola.ampspeedy.com/',
       src: 'https://eventkapalbola.ampspeedy.com/assets/images/miliyar.png',
       alt: 'KAPAL JUDI banner',
     },
     {
       href: 'https://eventkapalbola.ampspeedy.com/',
       src: 'https://eventkapalbola.ampspeedy.com/assets/images/parlay.png',
       alt: 'Promo Parlay',
     },
     {
       href: 'https://eventkapalbola.ampspeedy.com/',
       src: 'https://eventkapalbola.ampspeedy.com/assets/images/ajakteman.png',
       alt: 'Promo Parlay',
     },
   ];

   function carousel() {
     const track = $('carouselTrack');
     const dots = $('carouselDots');
     const vp = $('carouselViewport');
     const prog = $('carouselProgress');
     const prevBtn = $('carouselPrev');
     const nextBtn = $('carouselNext');
     const root = $('carousel');
     const total = BANNERS.length;

     track.innerHTML = BANNERS.map(
       (b, i) =>
         `<div class="carousel__slide" data-i="${i}"><a href="${b.href}" target="_blank" rel="noopener"><img src="${b.src}" alt="${esc(b.alt)}" loading="lazy"></a></div>`
     ).join('');
     dots.innerHTML = BANNERS.map(
       (_, i) =>
         `<button class="carousel__dot${i === 0 ? ' active' : ''}" data-i="${i}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-label="Slide ${i + 1}"></button>`
     ).join('');

     const slideEls = Array.from(track.querySelectorAll('.carousel__slide'));
     const imgEls = slideEls.map((s) => s.querySelector('img'));
     const dotEls = Array.from(dots.querySelectorAll('.carousel__dot'));

     let idx = 0;
     let autoTimer = null;
     let progTimer = null;
     let progPct = 0;
     let interacting = false;
     let dragStart = 0, dragDelta = 0, dragging = false;
     let resizeTimer = null;

     const AUTO_MS = 4000;

     function measureHeight(i) {
       const img = imgEls[i];
       if (!img) return 0;
       const natW = img.naturalWidth || 0;
       const natH = img.naturalHeight || 0;
       if (!natW || !natH) return 0;
       const cw = vp.clientWidth || track.clientWidth || 1;
       return Math.round((cw * natH) / natW);
     }

     function applyHeight(i, smooth) {
       const h = measureHeight(i);
       if (h <= 0) return;
       vp.style.transition = smooth === false ? 'none' : 'height 0.45s var(--ease)';
       vp.style.height = h + 'px';
     }

     function go(n, smooth) {
       idx = ((n % total) + total) % total;
       track.style.transition = smooth === false ? 'none' : 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1)';
       track.style.transform = `translateX(-${idx * 100}%)`;
       dotEls.forEach((d, i) => {
         const on = i === idx;
         d.classList.toggle('active', on);
         d.setAttribute('aria-selected', on ? 'true' : 'false');
       });
       applyHeight(idx, smooth);
     }

     function startAuto() {
       stopAuto();
       progPct = 0;
       prog.style.width = '0%';
       progTimer = setInterval(() => {
         progPct += (100 * 80) / AUTO_MS;
         if (progPct > 100) progPct = 100;
         prog.style.width = progPct + '%';
       }, 80);
       autoTimer = setTimeout(() => {
         go(idx + 1);
         startAuto();
       }, AUTO_MS);
     }

     function stopAuto() {
       if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
       if (progTimer) { clearInterval(progTimer); progTimer = null; }
       prog.style.width = '0%';
     }

     function userNext() { go(idx + 1); restartAuto(); }
     function userPrev() { go(idx - 1); restartAuto(); }
     function restartAuto() { stopAuto(); startAuto(); }

     dots.addEventListener('click', (e) => {
       const d = e.target.closest('.carousel__dot');
       if (!d) return;
       go(+d.dataset.i);
       restartAuto();
     });
     prevBtn.addEventListener('click', userPrev);
     nextBtn.addEventListener('click', userNext);

     // keyboard navigation
     root.setAttribute('tabindex', '0');
     root.addEventListener('keydown', (e) => {
       if (e.key === 'ArrowLeft') { userPrev(); e.preventDefault(); }
       else if (e.key === 'ArrowRight') { userNext(); e.preventDefault(); }
     });

     // pause autoplay while hovered / focused
     root.addEventListener('pointerenter', () => { interacting = true; stopAuto(); });
     root.addEventListener('pointerleave', () => { interacting = false; startAuto(); });
     root.addEventListener('focusin', () => stopAuto());
     root.addEventListener('focusout', () => startAuto());

     // pointer drag (mouse + touch), threshold 50px
     vp.addEventListener('pointerdown', (e) => {
       dragging = true;
       dragStart = e.clientX;
       dragDelta = 0;
       track.style.transition = 'none';
       stopAuto();
     });
     vp.addEventListener('pointermove', (e) => {
       if (!dragging) return;
       dragDelta = e.clientX - dragStart;
       track.style.transform = `translateX(calc(-${idx * 100}% + ${dragDelta}px))`;
     });
     function endDrag() {
       if (!dragging) return;
       dragging = false;
       if (Math.abs(dragDelta) > 50) {
         go(idx + (dragDelta < 0 ? 1 : -1));
       } else {
         go(idx);
       }
       startAuto();
     }
     vp.addEventListener('pointerup', endDrag);
     vp.addEventListener('pointercancel', endDrag);
     vp.addEventListener('pointerleave', endDrag);

     // recompute height when an image finishes loading
     imgEls.forEach((img, i) => {
       const onReady = () => { if (i === idx) applyHeight(idx, false); };
       if (img.complete && img.naturalWidth) onReady();
       img.addEventListener('load', onReady);
     });

     // responsive: recompute active height on resize/orientation change (no animation)
     window.addEventListener('resize', () => {
       if (resizeTimer) clearTimeout(resizeTimer);
       resizeTimer = setTimeout(() => applyHeight(idx, false), 150);
     });
     window.addEventListener('orientationchange', () => applyHeight(idx, false));

     // initial position + height (no animation on first paint)
     go(0, false);
     startAuto();
   }
   
   /* ---------- scroll reveal (Intersection Observer) ---------- */
   function scrollReveal() {
     const els = document.querySelectorAll('[data-reveal]');
     if (!('IntersectionObserver' in window)) {
       els.forEach((el) => el.classList.add('in'));
       return;
     }
     const io = new IntersectionObserver(
       (entries) => {
         entries.forEach((en) => {
           if (en.isIntersecting) {
             en.target.classList.add('in');
             io.unobserve(en.target);
           }
         });
       },
       { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
     );
     els.forEach((el) => io.observe(el));
   }
   
   /* ---------- scroll progress + nav ---------- */
   function scrollFX() {
     const prog = $('scrollProgress');
     const nav = $('nav');
     const mobItems = document.querySelectorAll('.mobnav__item');
     const sections = ['jadwal', 'layanan']
       .map((id) => document.getElementById(id))
       .filter(Boolean);
   
     let ticking = false;
     function update() {
       const h = document.documentElement.scrollHeight - window.innerHeight;
       const y = window.scrollY;
       prog.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
       nav.classList.toggle('scrolled', y > 40);
   
       // active section indicator
       let active = 'jadwal';
       sections.forEach((s) => {
         if (s.getBoundingClientRect().top <= 120) active = s.id;
       });
       mobItems.forEach((m) => {
         const target = m.dataset.mob;
         m.classList.toggle('active', target === active);
       });
       document.querySelectorAll('.nav__link').forEach((l) => {
         l.classList.toggle('active', l.getAttribute('href') === '#' + active);
       });
       ticking = false;
     }
     window.addEventListener(
       'scroll',
       () => {
         if (!ticking) {
           requestAnimationFrame(update);
           ticking = true;
         }
       },
       { passive: true }
     );
     update();
   }
   
   /* ---------- cursor light (desktop) ---------- */
   function cursorLight() {
     if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
     const cl = $('cursorLight');
     cl.classList.add('active');
     let ticking = false;
     window.addEventListener(
       'pointermove',
       (e) => {
         if (ticking) return;
         ticking = true;
         requestAnimationFrame(() => {
           cl.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
           ticking = false;
         });
       },
       { passive: true }
     );
   }
   
   /* ---------- magnetic buttons (desktop) ---------- */
   function magnetic() {
     if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
     document.querySelectorAll('.magnetic').forEach((el) => {
       el.addEventListener('pointermove', (e) => {
         const r = el.getBoundingClientRect();
         const x = e.clientX - r.left - r.width / 2;
         const y = e.clientY - r.top - r.height / 2;
         el.style.transform = `translate(${x * 0.18}px, ${y * 0.25}px) translateY(-2px)`;
       });
       el.addEventListener('pointerleave', () => {
         el.style.transform = '';
       });
     });
   }
   
   /* ---------- ripple ---------- */
   function ripple() {
     if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
     const SEL =
       '.link-box a, .service-item, .tab, .all-btn, .date-btn, .modal-menu a, .match-card, .close-modal, .refresh-btn, .service-card, .btn, .mobnav__item';
     document.addEventListener('pointerdown', (e) => {
       const el = e.target.closest(SEL);
       if (!el) return;
       if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
       el.style.overflow = 'hidden';
       const r = el.getBoundingClientRect();
       const d = Math.max(r.width, r.height) * 1.4;
       const span = document.createElement('span');
       span.className = 'ripple';
       span.style.width = span.style.height = d + 'px';
       span.style.left = e.clientX - r.left - d / 2 + 'px';
       span.style.top = e.clientY - r.top - d / 2 + 'px';
       el.appendChild(span);
       span.addEventListener('animationend', () => span.remove());
     });
   }
   
   /* ---------- tabs ---------- */
   function tabs() {
     document.querySelectorAll('.tab').forEach((b) => {
       b.onclick = async () => {
         document.querySelectorAll('.tab').forEach((x) => {
           x.classList.remove('active');
           x.setAttribute('aria-selected', 'false');
         });
         b.classList.add('active');
         b.setAttribute('aria-selected', 'true');
         const s = b.dataset.tab === 'schedule';
         currentTab = s ? 'schedule' : 'prediction';
         $('schedulePanel').classList.toggle('show', s);
         $('predictionPanel').classList.toggle('show', !s);
         $('schedulePanel').setAttribute('aria-hidden', String(!s));
         $('predictionPanel').setAttribute('aria-hidden', String(s));
         if (!s) await loadPredictions();
       };
     });
   }
   
   /* ---------- date nav ---------- */
   function dateNav() {
     document.querySelectorAll('.date-btn').forEach((b) => {
       b.onclick = async () => {
         offset = +b.dataset.offset;
         document.querySelectorAll('.date-btn').forEach((x) => x.classList.remove('active'));
         b.classList.add('active');
         await refresh();
       };
     });
   }

   /* ---------- live search filter (filters schedule/prediction list by team name) ---------- */
   function searchMatch() {
     const input = $('searchMatchInput');
     const clear = $('searchMatchClear');
     if (!input) return;

     function applyFilter() {
       searchQuery = input.value;
       clear.classList.toggle('show', searchQuery.length > 0);
       if (currentTab === 'prediction') {
         renderPredictionList();
       } else {
         renderSchedule();
       }
     }

     input.addEventListener('input', applyFilter);

     clear.addEventListener('click', () => {
       input.value = '';
       applyFilter();
       input.focus();
     });

     input.addEventListener('keydown', (e) => {
       if (e.key === 'Escape') {
         input.value = '';
         applyFilter();
       }
     });
   }

   /* ---------- modal ---------- */
   function modal() {
     $('modalBtn').onclick = () => $('servicesModal').classList.add('show');
     document.querySelectorAll('[data-close]').forEach(
       (b) => (b.onclick = () => $(b.dataset.close).classList.remove('show'))
     );
     document.querySelectorAll('.modal').forEach((m) => {
       m.onclick = (e) => {
         if (e.target === m) m.classList.remove('show');
       };
     });
     document.addEventListener('keydown', (e) => {
       if (e.key === 'Escape') document.querySelectorAll('.modal.show').forEach((m) => m.classList.remove('show'));
     });
   }
   
   /* ---------- boot ---------- */
   function boot() {
     const b = $('boot');
     if (!b) return;
     requestAnimationFrame(() => {
       setTimeout(() => b.classList.add('hide'), 200);
     });
   }
   
   /* ---------- init ---------- */
   function init() {
     watermark();
     flyingStars();
     marquee();
     services();
     carousel();
     tabs();
     dateNav();
     searchMatch();
     modal();
     ripple();
     scrollReveal();
     scrollFX();
     cursorLight();
     magnetic();
     boot();
     $('refreshBtn').onclick = refresh;
     refresh();
     startUpcomingTicker();
   }
   
   if (document.readyState === 'loading') {
     document.addEventListener('DOMContentLoaded', init);
   } else {
     init();
   }
   
   /* ---------- content protection ---------- */
   const p = window.JPB_PROTECTION || {};
       const redirectTarget = typeof p.redirect === 'string' ? p.redirect.trim() : '';
       let redirecting = false;
   
       const redirectViolation = (reason) => {
         if (!redirectTarget || redirecting) return;
   
         try {
           const target = new URL(redirectTarget, window.location.origin);
           if (!['http:', 'https:'].includes(target.protocol)) return;
           if (target.href === window.location.href) return;
   
           redirecting = true;
           try {
             sessionStorage.setItem('jpb_protection_reason', String(reason || 'blocked-action'));
           } catch (_) {
             // Session storage may be unavailable in strict privacy mode.
           }
           window.location.replace(target.href);
         } catch (_) {
           // Invalid redirect URLs are ignored instead of breaking the page.
         }
       };
   
       const block = (event, reason) => {
         event.preventDefault();
         event.stopPropagation();
         redirectViolation(reason);
         return false;
       };

       // Chatbase's widget button/window live in the host document (the
       // conversation itself runs inside its iframe, unaffected by these
       // listeners) — exempt them so users can still copy/select there.
       const isChatWidgetTarget = (event) =>
         !!(event.target && event.target.closest && event.target.closest('[id*="chatbase" i], [class*="chatbase" i]'));

       if (p.context) {
         document.addEventListener('contextmenu', (event) => {
           if (isChatWidgetTarget(event)) return;
           block(event, 'contextmenu');
         }, true);
       }

       if (p.copy) {
         document.addEventListener('copy', (event) => {
           if (isChatWidgetTarget(event)) return;
           block(event, 'copy');
         }, true);
         document.addEventListener('cut', (event) => {
           if (isChatWidgetTarget(event)) return;
           block(event, 'cut');
         }, true);
         document.addEventListener('dragstart', (event) => {
           if (isChatWidgetTarget(event)) return;
           block(event, 'dragstart');
         }, true);
       }

       if (p.select) {
         document.body.classList.add('no-select');
         document.addEventListener('selectstart', (event) => {
           if (isChatWidgetTarget(event)) return;
           block(event, 'text-selection');
         }, true);
       }
   
       document.addEventListener('keydown', (event) => {
         const key = String(event.key || '').toLowerCase();
         const command = event.ctrlKey || event.metaKey;
         const devtoolsShortcut = event.key === 'F12'
           || (command && event.shiftKey && ['i', 'j', 'c', 'k'].includes(key));
         const contentShortcut = command && ['c', 'u', 's', 'p'].includes(key);
   
         if (p.devtools && devtoolsShortcut) {
           block(event, 'devtools-shortcut');
           return;
         }
   
         if (p.copy && contentShortcut && !isChatWidgetTarget(event)) {
           block(event, `keyboard-${key}`);
         }
       }, true);
   
       if (p.devtools) {
         const threshold = 160;
         let devtoolsDetected = false;
   
         const detectDockedDevtools = () => {
           const widthGap = Math.max(0, window.outerWidth - window.innerWidth);
           const heightGap = Math.max(0, window.outerHeight - window.innerHeight);
           const detected = widthGap > threshold || heightGap > threshold;
   
           if (detected && !devtoolsDetected) {
             devtoolsDetected = true;
             redirectViolation('devtools-detected');
           } else if (!detected) {
             devtoolsDetected = false;
           }
         };
   
         window.addEventListener('resize', detectDockedDevtools, { passive: true });
         window.setInterval(detectDockedDevtools, 700);
         window.setTimeout(detectDockedDevtools, 300);
       }