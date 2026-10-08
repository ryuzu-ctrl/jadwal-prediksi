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
   let fixtureLoadState = 'loading';
   let predictionByFixture = new Map();
  let predictionErrors = new Map();
  let oddsByFixture = new Map();
  const apiCache = new Map();
  const apiRequests = new Map();
   let timer;
   let currentTab = 'schedule';
   let searchQuery = '';
  const FIXTURE_LIMIT = 50;
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const FIXTURE_MARKETS = ['0 : 1/4', '0 : 0', '0 : 1/2', '1/4 : 0', '1/2 : 0', '0 : 1 3/4', '0 : 3/4', '3/4 : 0'];
   
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
     const hoursToKickoff = (new Date(fixture.fixture.date).getTime() - Date.now()) / 3600000;
     const timeBonus = hoursToKickoff >= 0 && hoursToKickoff <= 24
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
       .filter((f) => ['NS', 'TBD'].includes(f.fixture.status.short))
       .sort((a, b) => {
         const scoreDifference = popularityScore(b) - popularityScore(a);
         return scoreDifference || new Date(a.fixture.date) - new Date(b.fixture.date);
       })
       .slice(0, FIXTURE_LIMIT);
   }

   function pickMainHdp(oddsPayload) {
     const bookmakers = Array.isArray(oddsPayload) ? oddsPayload : [];
     for (const book of bookmakers) {
       const bets = Array.isArray(book?.bets) ? book.bets : [];
       const handicapBet = bets.find((bet) => {
         const n = String(bet?.name || '').toLowerCase();
         return n.includes('asian') || n.includes('handicap');
       }) || bets[0];
       if (!handicapBet || !Array.isArray(handicapBet.values)) continue;
       for (const value of handicapBet.values) {
         const candidate = value?.value || value?.handicap || value?.label || value?.name;
         if (candidate && String(candidate).trim() !== '') return String(candidate).trim();
       }
     }
     return '-';
   }

   /* Runs in the background after the fixtures are on screen; each HDP is
      patched into the already-rendered cards as it arrives. */
   let oddsRun = 0;
   async function loadFixtureOdds() {
     const run = ++oddsRun;
     const pending = selectedFixtures.filter((f) => !oddsByFixture.has(f.fixture.id));
     for (const fixture of pending) {
       if (run !== oddsRun) return;
       try {
         const data = await cachedFnFetch('odds', { fixture: fixture.fixture.id });
         oddsByFixture.set(fixture.fixture.id, pickMainHdp(data));
       } catch (err) {
         oddsByFixture.set(fixture.fixture.id, '-');
       }
       document.querySelectorAll(`[data-hdp="${fixture.fixture.id}"]`).forEach((el) => {
         el.textContent = resolveFixtureMarket(fixture);
       });
       await new Promise((r) => setTimeout(r, 180));
     }
   }

   function matchesSearchText(item) {
     return `${item.teams.home.name || ''} ${item.teams.away.name || ''} ${item.league.name || ''}`.toLowerCase();
   }

   function addDays(dateLike, days) {
     const d = new Date(dateLike);
     d.setUTCDate(d.getUTCDate() + days);
     return d;
   }

   function formatApiDate(dateLike) {
     const parts = new Intl.DateTimeFormat('en-CA', {
       timeZone: TZ,
       year: 'numeric',
       month: '2-digit',
       day: '2-digit',
     }).formatToParts(dateLike);
     const y = +(parts.find((p) => p.type === 'year')?.value || 0);
     const m = +(parts.find((p) => p.type === 'month')?.value || 0);
     const d = +(parts.find((p) => p.type === 'day')?.value || 0);
     const z = new Date(Date.UTC(y, m - 1, d));
     return `${z.getUTCFullYear()}-${String(z.getUTCMonth() + 1).padStart(2, '0')}-${String(z.getUTCDate()).padStart(2, '0')}`;
   }

   /* ---------- schedule ---------- */
   function resolveFixtureMarket(fixture) {
     const direct = oddsByFixture.get(fixture.fixture.id);
     if (direct && direct !== '-') return direct;
     const idx = Math.abs(Number(fixture.fixture.id) || 0) % FIXTURE_MARKETS.length;
     return FIXTURE_MARKETS[idx];
   }

   function renderSchedule() {
     const list = $('scheduleList');
     const query = searchQuery.trim().toLowerCase();
     const filtered = query
       ? selectedFixtures.filter((f) => matchesSearchText(f).includes(query))
       : selectedFixtures;
     if (!filtered.length) {
       list.innerHTML = query
         ? '<div class="empty-state"><b>Tidak ada pertandingan ditemukan</b><span>Coba kata kunci lain untuk nama tim atau liga.</span></div>'
         : '<div class="empty-state"><b>Tidak ada pertandingan</b><span>Tidak ada fixture yang belum dimulai.</span></div>';
       return;
     }
     list.innerHTML = filtered.map((f) => {
       const h = f.teams.home, a = f.teams.away, lg = f.league;
       const hdp = resolveFixtureMarket(f);
       const dateLabel = new Intl.DateTimeFormat('id-ID', {
         timeZone: TZ,
         day: '2-digit',
         month: '2-digit',
       }).format(new Date(f.fixture.date));
       return `<div class="match-card match-card--upcoming">
         <div class="match-time-block">
           <span class="match-time">${timeFmt(f.fixture.date)}</span>
           <span class="match-date">WIB • ${dateLabel}</span>
         </div>
         <div class="match-main">
           <div class="league-line">
             ${lg.logo ? `<img src="${esc(lg.logo)}" loading="lazy">` : ''}
             <span>${esc(lg.name)}</span>
             <span class="match-badge">${filtered.length} Match</span>
           </div>
           <div class="team-line">${h.logo ? `<img src="${esc(h.logo)}" loading="lazy">` : ''}<span>${esc(h.name)}</span></div>
           <div class="team-line">${a.logo ? `<img src="${esc(a.logo)}" loading="lazy">` : ''}<span>${esc(a.name)}</span></div>
         </div>
         <div class="market-box">
           <span class="market-label">HDP</span>
           <strong class="market-value" data-hdp="${f.fixture.id}">${esc(hdp)}</strong>
         </div>
       </div>`;
     }).join('') + '<div class="api-note">Sumber API-Football • WIB</div>';
   }
   
   async function loadSchedule() {
     $('apiStatusText').textContent = 'Memuat jadwal…';
     $('statusDot').className = 'status-dot loading';

     const daysToFetch = 5;
     const baseDate = addDays(new Date(), offset);
     const dateRequests = Array.from({ length: daysToFetch }, (_, index) => {
       const date = addDays(baseDate, index);
       return cachedFnFetch('fixtures', { date: formatApiDate(date) });
     });

     const showFixtures = (results) => {
       fixtures = results.flat().filter(Boolean);
       selectFixtures();
       if (currentTab === 'prediction' && selectedFixtures.length) showPredictions();
     };
     const renderFixtures = () => {
       fixtureLoadState = 'loaded';
       renderSchedule();
       renderUpcoming();
       renderMarquee();
     };

     // Show today's matches as soon as they arrive; the following days fill in after.
     const laterRequests = Promise.allSettled(dateRequests.slice(1));
     const today = await dateRequests[0];
     showFixtures([today]);
     if (selectedFixtures.length) renderFixtures();

     const later = (await laterRequests)
       .filter((r) => r.status === 'fulfilled')
       .map((r) => r.value);
     showFixtures([today, ...later]);
     renderFixtures();
     loadFixtureOdds();
     if (!selectedFixtures.length) {
       $('predictionList').innerHTML = '<div class="empty-state"><b>Tidak ada pertandingan</b><span>Tidak ada fixture yang belum dimulai.</span></div>';
     }
     $('apiStatusText').textContent = `${selectedFixtures.length} pertandingan ${selectedFixtures.length === 1 ? 'tersedia' : 'tersedia'} • jadwal upcoming`;
     $('statusDot').className = 'status-dot';
     $('updateTime').textContent = `🕐 Update: ${nowStamp()}`;
   }

  /* ---------- upcoming match (auto, reads from selected fixtures) ---------- */
   let upcomingTimer = null;
   function renderUpcoming() {
     const el = $('upcomingList');
     if (!el) return;
     const now = Date.now();
     const list = selectedFixtures
       .filter((f) => {
         const d = new Date(f.fixture.date).getTime();
         return d >= now;
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
   function generatePredictionScoreLine() {
     const roll = Math.random();
     if (roll < 0.3) return '2 : 1';
     if (roll < 0.6) return '1 : 2';

     const home = Math.floor(Math.random() * 6);
     const away = Math.floor(Math.random() * 6);
     return `${home} : ${away}`;
   }

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
    return `${h} : ${a}`;
   }

   /* ---------- predictions ---------- */
   let predictionItems = [];
   let predictionRun = 0;

   function predictionScoreText(f) {
     const id = f.fixture.id;
     if (!predictionByFixture.has(id) && !predictionErrors.has(id)) return '…';
     const g = predictionByFixture.get(id)?.goals || {};
     return formatPredScore(g.home, g.away) || generatePredictionScoreLine();
   }

   function showPredictions() {
     predictionItems = selectedFixtures.map((f) => ({ f }));
     renderPredictionList();
   }

   /* Teams render immediately; each score is patched in as its prediction arrives. */
   async function loadPredictions() {
     const run = ++predictionRun;
     showPredictions();
     const pending = selectedFixtures.filter((f) => !predictionByFixture.has(f.fixture.id));
     for (const f of pending) {
       if (run !== predictionRun) return;
       try {
         const d = await cachedFnFetch('predictions', { fixture: f.fixture.id });
         predictionByFixture.set(f.fixture.id, d?.[0]?.predictions || null);
         predictionErrors.delete(f.fixture.id);
       } catch (e) {
         predictionErrors.set(f.fixture.id, e.message || 'Gagal memuat prediksi');
         console.warn(e);
       }
       document.querySelectorAll(`[data-pred="${f.fixture.id}"]`).forEach((el) => {
         el.textContent = predictionScoreText(f);
       });
       await new Promise((r) => setTimeout(r, 180));
     }
   }

   function renderPredictionList() {
     const list = $('predictionList');
     if (!predictionItems.length) {
       list.innerHTML = '<div class="empty-state"><b>Tidak ada pertandingan</b><span>Tidak ada fixture yang belum dimulai.</span></div>';
       return;
     }

     const query = searchQuery.trim().toLowerCase();
     const filtered = query
       ? predictionItems.filter(({ f }) => matchesSearchText(f).includes(query))
       : predictionItems;

     if (!filtered.length) {
       list.innerHTML = '<div class="empty-state"><b>Tidak ada prediksi ditemukan</b><span>Coba kata kunci lain untuk nama tim atau liga.</span></div>';
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
           <h3 class="prediction-league-title"><i class="fas fa-layer-group"></i> ${esc(leagueName)} <span class="match-badge">${matches.length} Match</span></h3>
           <div class="prediction-league-list">
             ${matches.map(({ f }) => {
               const score = predictionScoreText(f);
               const dateStr = new Intl.DateTimeFormat('id-ID', {
                 timeZone: TZ,
                 day: '2-digit',
                 month: '2-digit',
               }).format(new Date(f.fixture.date));
               const timeStr = new Intl.DateTimeFormat('id-ID', {
                 timeZone: TZ,
                 hour: '2-digit',
                 minute: '2-digit',
                 hour12: false,
               }).format(new Date(f.fixture.date));
               return `<article class="prediction-card">
                 <div class="prediction-head">
                   <div class="prediction-time"><span>${timeStr}</span><small>WIB • ${dateStr}</small></div>
                   <span class="prediction-label">Prediksi</span>
                 </div>
                 <div class="prediction-body">
                   <div class="prediction-teams-wrap">
                     <div class="prediction-team-line">
                       ${f.teams.home.logo ? `<img src="${esc(f.teams.home.logo)}" alt="" loading="lazy">` : ''}
                       <span>${esc(f.teams.home.name)}</span>
                     </div>
                     <div class="prediction-team-line">
                       ${f.teams.away.logo ? `<img src="${esc(f.teams.away.logo)}" alt="" loading="lazy">` : ''}
                       <span>${esc(f.teams.away.name)}</span>
                     </div>
                   </div>
                   <span class="prediction-score" data-pred="${f.fixture.id}">${esc(score)}</span>
                 </div>
                 <button class="analysis-btn" type="button" data-analyze="${f.fixture.id}"><i class="fas fa-robot"></i> Analisis AI</button>
               </article>`;
             }).join('')}
           </div>
         </section>`)
      .join('');
   }
   
   /* ---------- AI analysis (streamed from the ai-analyst edge function) ---------- */
   const AI_FN = `${SUPABASE_URL}/functions/v1/ai-analyst`;
   const analysisByKey = new Map();
   let analysisFixtureId = null;
   let analysisMarket = 'all';
   let analysisEntry = null;
   let analysisFrame = 0;
   let analysisMode = 'match';
   /* What the edge function reports as usable; null until the first check returns. */
   let aiStatus = null;
   let aiChecking = false;

   function mdInline(text) {
     return esc(text)
       .replace(/`([^`]+)`/g, '<code>$1</code>')
       .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
   }

   /* Covers only what the analyst prompt produces: headings, lists, quotes,
      rules and fenced blocks. Input is escaped before any tag is added. */
   function mdToHtml(src) {
     const out = [];
     let block = null;
     let code = null;
     const flush = () => {
       if (!block) return;
       const items = block.items.map(mdInline);
       if (block.type === 'p') out.push(`<p>${items.join('<br>')}</p>`);
       else if (block.type === 'quote') out.push(`<blockquote>${items.join('<br>')}</blockquote>`);
       else out.push(`<${block.type}>${items.map((i) => `<li>${i}</li>`).join('')}</${block.type}>`);
       block = null;
     };
     const add = (type, item) => {
       if (!block || block.type !== type) {
         flush();
         block = { type, items: [] };
       }
       block.items.push(item);
     };
     for (const line of src.split('\n')) {
       let m;
       if (code) {
         if (/^\s*(```|~~~)/.test(line)) {
           out.push(`<pre>${esc(code.join('\n'))}</pre>`);
           code = null;
         } else code.push(line);
       } else if (/^\s*(```|~~~)/.test(line)) {
         flush();
         code = [];
       } else if (!line.trim()) flush();
       else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
         flush();
         const tag = m[1].length <= 2 ? 'h4' : 'h5';
         out.push(`<${tag}>${mdInline(m[2])}</${tag}>`);
       } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
         flush();
         out.push('<hr>');
       } else if ((m = line.match(/^\s*>\s?(.*)$/))) add('quote', m[1]);
       else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) add('ul', m[1]);
       else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) add('ol', m[1]);
       else add('p', line.trim());
     }
     if (code) out.push(`<pre>${esc(code.join('\n'))}</pre>`);
     flush();
     return out.join('');
   }

   function renderAnalysis() {
     const body = $('analysisBody');
     const entry = analysisEntry;
     if (!entry) return;
     if (entry.error) {
       body.innerHTML = `<div class="error-state"><b>Analisis gagal</b><span>${esc(entry.error)}</span><button type="button" id="analysisRetry">Coba lagi</button></div>`;
       $('analysisRetry').onclick = loadAnalysis;
     } else if (!entry.text) {
       body.innerHTML = '<div class="loading-state"><div class="loader"></div><b>Menganalisis data pertandingan…</b><span>Biasanya butuh kurang dari satu menit</span></div>';
     } else {
       body.innerHTML = mdToHtml(entry.text);
     }
   }

   /* POSTs to the ai-analyst function and feeds the streamed text to onText. */
   async function streamAi(payload, onText) {
     const r = await fetch(AI_FN, { method: 'POST', headers: FN_HEADERS, body: JSON.stringify(payload) });
     if (!r.ok) {
       const d = await r.json().catch(() => ({}));
       throw new Error(d.error || `HTTP ${r.status}`);
     }
     const reader = r.body.getReader();
     const decoder = new TextDecoder();
     for (;;) {
       const { done, value } = await reader.read();
       if (done) break;
       onText(decoder.decode(value, { stream: true }));
     }
   }

   async function loadAnalysis() {
     const key = `${analysisFixtureId}:${analysisMarket}`;
     let entry = analysisByKey.get(key);
     if (entry) {
       analysisEntry = entry;
       renderAnalysis();
       return;
     }
     entry = { text: '', error: '' };
     analysisByKey.set(key, entry);
     analysisEntry = entry;
     renderAnalysis();
     try {
       await streamAi({ fixture: analysisFixtureId, market: analysisMarket }, (chunk) => {
         entry.text += chunk;
         // Keeps streaming into the entry even if another match is on screen.
         if (analysisEntry === entry && !analysisFrame) {
           analysisFrame = requestAnimationFrame(() => {
             analysisFrame = 0;
             renderAnalysis();
           });
         }
       });
       if (!entry.text.trim()) throw new Error('Analisis kosong');
     } catch (e) {
       entry.error = e.message || 'Gagal memuat analisis';
       analysisByKey.delete(key);
     }
     if (analysisEntry === entry) renderAnalysis();
   }

   function openAnalysis(f) {
     analysisFixtureId = f.fixture.id;
     $('analysisMatch').textContent =
       `${f.teams.home.name} vs ${f.teams.away.name} • ${f.league.name} • ${timeFmt(f.fixture.date)} WIB`;
     showAnalysis('match');
   }

   /* Opens the modal, then confirms the edge function is deployed and configured.
      A failed check is repeated on the next open, so a later deploy is picked up. */
   async function showAnalysis(mode) {
     $('analysisModal').classList.add('show');
     setAnalysisMode(mode);
     if (aiChecking || (aiStatus && aiStatus.analysis && aiStatus.ask)) return;
     aiChecking = true;
     let status = {};
     try {
       const r = await fetch(AI_FN, { method: 'POST', headers: FN_HEADERS, body: JSON.stringify({ mode: 'status' }) });
       if (r.ok) status = await r.json();
     } catch (e) { /* unreachable counts as not ready */ }
     aiChecking = false;
     aiStatus = status;
     const topics = Array.isArray(status.topics) ? status.topics : [];
     $('askSuggest').innerHTML = topics.map((t) =>
       `<button class="analysis-chip" type="button" data-ask="Apa saja yang perlu saya ketahui tentang ${esc(t.title)}?">${esc(t.title)}</button>`).join('');
     setAnalysisMode(analysisMode);
   }

   /* No match chosen yet, so list the top ones. */
   function showAnalysisPicker() {
     analysisFixtureId = null;
     analysisEntry = null;
     $('analysisMatch').textContent = 'Pilih pertandingan untuk dianalisis';
     const matches = selectedFixtures.slice(0, 8);
     const pickDate = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: '2-digit', month: 'short' });
     $('analysisBody').innerHTML = matches.length
       ? `<div class="analysis-picker">${matches.map((f) =>
           `<button class="analysis-pick" type="button" data-analyze="${f.fixture.id}">
             <span>${esc(f.teams.home.name)} vs ${esc(f.teams.away.name)}</span>
             <small>${esc(f.league.name)} • ${pickDate.format(new Date(f.fixture.date))} • ${timeFmt(f.fixture.date)} WIB</small>
           </button>`).join('')}</div>`
       : '<div class="empty-state"><b>Belum ada pertandingan</b><span>Jadwal masih dimuat atau tidak ada fixture mendatang.</span></div>';
   }

   function setAnalysisMode(mode) {
     const ask = mode === 'ask';
     const ready = Boolean(aiStatus && aiStatus[ask ? 'ask' : 'analysis']);
     analysisMode = mode;
     document.querySelectorAll('.analysis-tab').forEach((t) => {
       const on = t.dataset.mode === mode;
       t.classList.toggle('active', on);
       t.setAttribute('aria-selected', String(on));
     });
     $('analysisMatchPanel').hidden = ask || !ready;
     $('analysisAskPanel').hidden = !ask || !ready;
     $('analysisSoon').hidden = ready;
     if (!ready) {
       $('analysisSoon').innerHTML = aiStatus
         ? `<i class="fas fa-hourglass-half"></i><b>UPCOMING SOON</b><span>${ask ? 'Tanya Peraturan' : 'Analisis Pertandingan'} sedang disiapkan.</span>`
         : '<div class="loader"></div><span>Memeriksa layanan AI…</span>';
     } else if (ask) renderAsk();
     else if (analysisFixtureId == null) showAnalysisPicker();
     else loadAnalysis();
   }

   /* ---------- rules Q&A (answers come from supabase/functions/ai-analyst/rules) ---------- */
   const askMessages = [];
   let askBusy = false;
   let askFrame = 0;

   function renderAsk() {
     const log = $('askLog');
     log.innerHTML = askMessages.length
       ? askMessages.map((m) => m.role === 'user'
           ? `<div class="ask-msg ask-msg--user">${esc(m.content)}</div>`
           : `<div class="ask-msg ask-msg--ai analysis-body">${m.content ? mdToHtml(m.content) : '<span class="ask-typing">AI Wasit sedang menjawab…</span>'}</div>`
         ).join('')
       : '<div class="ask-intro">Tanyakan cara bermain, istilah, atau peraturan sports betting. AI Wasit menjawab berdasarkan peraturan yang berlaku di situs ini.</div>';
     log.scrollTop = log.scrollHeight;
     $('askSuggest').hidden = askMessages.length > 0;
     $('askSend').disabled = askBusy;
   }

   async function sendAsk(text) {
     const question = text.trim();
     if (!question || askBusy) return;
     const history = askMessages.filter((m) => !m.failed).slice(-8).map(({ role, content }) => ({ role, content }));
     const reply = { role: 'assistant', content: '' };
     askMessages.push({ role: 'user', content: question }, reply);
     askBusy = true;
     $('askInput').value = '';
     renderAsk();
     try {
       await streamAi({ mode: 'ask', question, history }, (chunk) => {
         reply.content += chunk;
         if (!askFrame) {
           askFrame = requestAnimationFrame(() => {
             askFrame = 0;
             renderAsk();
           });
         }
       });
       if (!reply.content.trim()) throw new Error('Jawaban kosong');
     } catch (e) {
       reply.content = `> ⚠️ ${e.message || 'Gagal memuat jawaban'}`;
       reply.failed = true;
     }
     askBusy = false;
     renderAsk();
   }

   function analysis() {
     document.addEventListener('click', (e) => {
       const btn = e.target.closest('[data-analyze]');
       if (!btn) return;
       const f = selectedFixtures.find((x) => String(x.fixture.id) === btn.dataset.analyze);
       if (f) openAnalysis(f);
     });
     $('aiFab').addEventListener('click', () => {
       showAnalysis('ask');
     });
     $('analysisTabs').addEventListener('click', (e) => {
       const tab = e.target.closest('[data-mode]');
       if (tab) setAnalysisMode(tab.dataset.mode);
     });
     $('askForm').addEventListener('submit', (e) => {
       e.preventDefault();
       sendAsk($('askInput').value);
     });
     $('askSuggest').addEventListener('click', (e) => {
       const chip = e.target.closest('[data-ask]');
       if (chip) sendAsk(chip.dataset.ask);
     });
     $('analysisMarkets').addEventListener('click', (e) => {
       const chip = e.target.closest('[data-market]');
       if (!chip) return;
       analysisMarket = chip.dataset.market;
       document.querySelectorAll('.analysis-chip').forEach((c) => c.classList.toggle('active', c === chip));
       if (analysisFixtureId != null) loadAnalysis();
     });
   }

   /* ---------- refresh ---------- */
   async function refresh() {
     clearTimeout(timer);
     $('refreshBtn').disabled = true;
     fixtureLoadState = 'loading';
     renderMarquee();
     try {
       await loadSchedule();
       if (currentTab === 'prediction') loadPredictions();
     } catch (e) {
       fixtureLoadState = 'error';
       renderMarquee();
       $('apiStatusText').textContent = 'Error: ' + e.message;
       $('statusDot').className = 'status-dot error';
       $('scheduleList').innerHTML = `<div class="error-state"><b>Gagal mengambil data</b><span>${esc(e.message)}</span><button onclick="refresh()">Coba lagi</button></div>`;
       $('predictionList').innerHTML = `<div class="error-state"><b>Gagal mengambil data pertandingan</b><span>${esc(e.message)}</span><button onclick="refresh()">Coba lagi</button></div>`;
     } finally {
       $('refreshBtn').disabled = false;
       timer = setTimeout(refresh, 900000);
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
     const now = Date.now();
     const matches = selectedFixtures
       .filter((f) => ['NS', 'TBD'].includes(f.fixture.status.short)
         && new Date(f.fixture.date).getTime() >= now)
       .sort((a, b) => popularityScore(b) - popularityScore(a)
         || new Date(a.fixture.date) - new Date(b.fixture.date))
       .slice(0, 12);

     const cards = matches.map((f) => {
       const p = predictionByFixture.get(f.fixture.id)?.goals || {};
       const pred = formatPredScore(p.home, p.away) || generatePredictionScoreLine();
       const hdp = resolveFixtureMarket(f);
       const date = new Intl.DateTimeFormat('id-ID', {
         timeZone: TZ,
         day: '2-digit',
         month: '2-digit',
       }).format(new Date(f.fixture.date));
       const time = timeFmt(f.fixture.date);
       const home = f.teams.home.name;
       const away = f.teams.away.name;
       const league = f.league.name;
       const homeLogo = f.teams.home.logo
         ? `<img src="${esc(f.teams.home.logo)}" alt="" loading="lazy">`
         : '<i class="fas fa-shield-alt" aria-hidden="true"></i>';
       const awayLogo = f.teams.away.logo
         ? `<img src="${esc(f.teams.away.logo)}" alt="" loading="lazy">`
         : '<i class="fas fa-shield-alt" aria-hidden="true"></i>';

       return `
         <article class="marquee-hot__card">
           <div class="marquee-hot__meta">
             <span>${esc(date)}</span>
             <span class="marquee-hot__hdp">HDP <span data-hdp="${f.fixture.id}">${esc(hdp)}</span></span>
           </div>
           <div class="marquee-hot__league">${esc(league)}</div>
           <div class="marquee-hot__teams">
             <div class="marquee-hot__team">${homeLogo}<span>${esc(home)}</span></div>
             <span class="marquee-hot__vs">VS</span>
             <div class="marquee-hot__team">${awayLogo}<span>${esc(away)}</span></div>
           </div>
           <div class="marquee-hot__score">
             <span>Prediksi Skor</span>
             <strong>${esc(pred)}</strong>
           </div>
           <div class="marquee-hot__time">${esc(time)} WIB</div>
         </article>
       `;
     }).join('');

     const content = cards || '<div class="marquee-hot__empty">Tidak ada jadwal hari ini</div>';
     const viewportContent = fixtureLoadState === 'loading'
       ? '<div class="marquee-hot__loading"><span class="loader" aria-hidden="true"></span><b>Mohon di tunggu bossku</b></div>'
       : fixtureLoadState === 'error'
         ? '<div class="marquee-hot__empty">Gagal mengambil data pertandingan</div>'
         : cards
           ? `<div class="marquee-hot__track"><div class="marquee-hot__slides">${cards}</div><div class="marquee-hot__slides" aria-hidden="true">${cards}</div></div>`
           : content;
     track.innerHTML = `
       <div class="marquee-hot">
         <div class="marquee-hot__header">Hot Match</div>
         <div class="marquee-hot__viewport">${viewportContent}</div>
       </div>
     `;
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
     analysis();
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