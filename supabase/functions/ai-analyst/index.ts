import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';
import { SYSTEM_PROMPT } from './system-prompt.ts';
import { KNOWLEDGE_BASE } from './knowledge.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

const API_BASE = 'https://v3.football.api-sports.io';
const TZ = 'Asia/Jakarta';
const MODEL = 'claude-opus-5-5';
const CACHE_TTL_MS = 15 * 60 * 1000;

// Deployment-specific notes appended to the master prompt. Kept static so the
// whole system prompt stays cacheable; anything per-request goes in the user turn.
const RUNTIME_NOTES = `

---

# RUNTIME CONTEXT

* Match data arrives in the user turn as JSON inside <match_data> tags, fetched from API-Football at the time stated in "retrieved_at". Treat it as VERIFIED DATA. A section listed in "unavailable" or set to null is UNKNOWN, not zero.
* "third_party_prediction" is the output of API-Football's own model. It is another model's estimate, not verified fact; weigh it as one input and say so when you rely on it.
* Odds come from the single bookmaker named in the data. No opening odds are provided, so odds movement cannot be assessed.
* This is a single response shown on a web page. The reader cannot reply, so do not ask questions or offer follow-ups.
* Write the whole response in Bahasa Indonesia, in Markdown. Put tabular data in fenced code blocks with aligned columns, as in the examples above; the page does not render Markdown pipe tables.`;

// knowledge.ts is the operator-editable Knowledge Base. Headings and HTML
// comments alone count as empty, so an unfilled template is not sent as knowledge.
const knowledgeText = KNOWLEDGE_BASE.replace(/<!--[\s\S]*?-->/g, '').trim();
const hasKnowledge = knowledgeText.split('\n').some((l) => l.trim() && !/^\s*(#|---)/.test(l));
const KNOWLEDGE_SECTION = hasKnowledge
  ? `

---

# KNOWLEDGE BASE

The Knowledge Base for this deployment is inside the <knowledge_base> tags below. Apply it as section 3 describes. It is reference knowledge, not live match data.

<knowledge_base>
${knowledgeText}
</knowledge_base>`
  : `

* No Knowledge Base is attached in this deployment. Rely on the rules in this prompt and say so when a conclusion would need knowledge that is not here.`;

const SYSTEM_TEXT = SYSTEM_PROMPT + RUNTIME_NOTES + KNOWLEDGE_SECTION;

const MARKET_REQUESTS: Record<string, string> = {
  all: 'Prediksi pertandingan ini. Analisis semua market yang datanya tersedia.',
  '1x2': 'Prediksi pertandingan ini dengan fokus pada market 1X2.',
  ah: 'Prediksi pertandingan ini dengan fokus pada market Asian Handicap.',
  ou: 'Prediksi pertandingan ini dengan fokus pada market Over/Under.',
  btts: 'Prediksi pertandingan ini dengan fokus pada market Both Teams To Score.',
};

// Markets worth sending to the model; a bookmaker's full list runs to hundreds of lines.
const ODDS_MARKETS = [
  'Match Winner',
  'Home/Away',
  'Double Chance',
  'Asian Handicap',
  'Goals Over/Under',
  'Both Teams Score',
  'Handicap Result',
  'First Half Winner',
  'Total - Home',
  'Total - Away',
];

const analysisCache = new Map<string, { text: string; expiresAt: number }>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function text(body: string | ReadableStream<Uint8Array>) {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function fetchApi(endpoint: string, params: Record<string, string>) {
  const apiKey = Deno.env.get('FOOTBALL_API_KEY');
  if (!apiKey) throw new Error('FOOTBALL_API_KEY belum diset');
  const u = new URL(API_BASE + endpoint);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(u, {
      headers: { 'x-apisports-key': apiKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    const d = await r.json();
    if (!r.ok || (d.errors && Object.keys(d.errors).length > 0)) {
      const msg =
        (d.errors && Object.values(d.errors).join(', ')) || `HTTP ${r.status}`;
      throw new Error(msg);
    }
    return d.response ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

// deno-lint-ignore no-explicit-any
type Json = any;

function trimTeam(t: Json) {
  if (!t) return null;
  const lg = t.league || {};
  const side = (g: Json) => (g ? { total: g.total, average: g.average } : null);
  return {
    name: t.name,
    last_5: t.last_5 ?? null,
    season: {
      form: lg.form ?? null,
      fixtures: lg.fixtures ?? null,
      goals_for: side(lg.goals?.for),
      goals_against: side(lg.goals?.against),
      biggest: lg.biggest ?? null,
      clean_sheet: lg.clean_sheet ?? null,
      failed_to_score: lg.failed_to_score ?? null,
    },
  };
}

function trimOdds(payload: Json) {
  const entry = Array.isArray(payload) ? payload[0] : null;
  const books = (entry?.bookmakers || [])
    .map((b: Json) => ({
      bookmaker: b.name,
      markets: (b.bets || [])
        .filter((bet: Json) => ODDS_MARKETS.includes(bet.name))
        .map((bet: Json) => ({
          market: bet.name,
          prices: (bet.values || [])
            .slice(0, 30)
            .map((v: Json) => ({ selection: String(v.value), odds: v.odd })),
        })),
    }))
    .filter((b: Json) => b.markets.length);
  if (!books.length) return null;
  books.sort((a: Json, b: Json) => b.markets.length - a.markets.length);
  return { updated_at: entry.update ?? null, format: 'decimal', ...books[0] };
}

function trimLineups(lineups: Json) {
  if (!Array.isArray(lineups) || !lineups.length) return null;
  return lineups.map((l: Json) => ({
    team: l.team?.name,
    coach: l.coach?.name ?? null,
    formation: l.formation ?? null,
    start_xi: (l.startXI || []).map((p: Json) => ({
      name: p.player?.name,
      pos: p.player?.pos,
    })),
  }));
}

async function loadMatchData(fixtureId: string) {
  const [fx, pred, odds, inj] = await Promise.allSettled([
    fetchApi('/fixtures', { id: fixtureId, timezone: TZ }),
    fetchApi('/predictions', { fixture: fixtureId }),
    fetchApi('/odds', { fixture: fixtureId }),
    fetchApi('/injuries', { fixture: fixtureId }),
  ]);
  if (fx.status === 'rejected') throw fx.reason;
  const f = fx.value[0];
  if (!f) return null;

  const p = pred.status === 'fulfilled' ? pred.value[0] : null;
  const data: Record<string, unknown> = {
    retrieved_at: new Date().toISOString(),
    match: {
      home: f.teams?.home?.name,
      away: f.teams?.away?.name,
      competition: f.league?.name,
      country: f.league?.country,
      season: f.league?.season,
      round: f.league?.round,
      kickoff: f.fixture?.date,
      timezone: TZ,
      venue: f.fixture?.venue?.name ?? null,
      status: f.fixture?.status?.long,
    },
    teams: p ? { home: trimTeam(p.teams?.home), away: trimTeam(p.teams?.away) } : null,
    comparison: p?.comparison ?? null,
    head_to_head: p?.h2h?.length
      ? p.h2h.slice(0, 6).map((m: Json) => ({
          date: m.fixture?.date,
          competition: m.league?.name,
          home: m.teams?.home?.name,
          away: m.teams?.away?.name,
          score: m.goals,
        }))
      : null,
    third_party_prediction: p?.predictions ?? null,
    odds: odds.status === 'fulfilled' ? trimOdds(odds.value) : null,
    // An empty list is a real answer here: no injuries reported for this fixture.
    injuries:
      inj.status === 'fulfilled'
        ? inj.value.map((i: Json) => ({
            team: i.team?.name,
            player: i.player?.name,
            type: i.player?.type,
            reason: i.player?.reason,
          }))
        : null,
    lineups: trimLineups(f.lineups),
    xg: null,
  };
  data.unavailable = Object.keys(data).filter((k) => data[k] === null);
  return { status: f.fixture?.status?.short as string, data };
}

function claudeErrorMessage(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return 'ANTHROPIC_API_KEY tidak valid.';
  if (err instanceof Anthropic.RateLimitError) return 'Layanan AI sedang sibuk. Coba lagi sebentar.';
  if (err instanceof Anthropic.APIError) return `Layanan AI error (${err.status ?? 'koneksi'}).`;
  return 'Analisis gagal diproses.';
}

function analysisStream(client: Anthropic, cacheKey: string, userContent: string) {
  const encoder = new TextEncoder();
  let abort = () => {};
  let open = true;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => {
        if (open) controller.enqueue(encoder.encode(s));
      };
      try {
        // Thinking is adaptive (always on for this model). If a safety classifier
        // declines the request, `fallbacks` retries it server-side on the model
        // Anthropic recommends for that refusal category.
        const claude = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium' },
          system: [
            {
              type: 'text',
              text: SYSTEM_TEXT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: userContent }],
        });
        abort = () => claude.abort();
        claude.on('text', (delta) => send(delta));
        const message = await claude.finalMessage();
        if (message.stop_reason === 'refusal') {
          send('\n\n> ⚠️ Analisis tidak dapat diselesaikan untuk permintaan ini.');
        } else if (message.stop_reason === 'max_tokens') {
          send('\n\n> ⚠️ Analisis terpotong karena batas panjang jawaban.');
        } else {
          const full = message.content
            .map((b) => (b.type === 'text' ? b.text : ''))
            .join('');
          analysisCache.set(cacheKey, { text: full, expiresAt: Date.now() + CACHE_TTL_MS });
        }
      } catch (err) {
        if (!(err instanceof Anthropic.APIUserAbortError)) {
          console.error(err);
          send(`\n\n> ⚠️ ${claudeErrorMessage(err)}`);
        }
      } finally {
        if (open) controller.close();
        open = false;
      }
    },
    cancel() {
      open = false;
      abort();
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const fixtureId = String(body.fixture ?? '');
    const market = String(body.market ?? 'all');
    if (!/^\d{1,12}$/.test(fixtureId)) return json({ error: 'Missing fixture id' }, 400);
    if (!(market in MARKET_REQUESTS)) return json({ error: 'Unknown market' }, 400);

    const cacheKey = `${fixtureId}:${market}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return text(cached.text);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY belum diset' }, 500);

    const match = await loadMatchData(fixtureId);
    if (!match) return json({ error: 'Pertandingan tidak ditemukan' }, 404);
    if (!['NS', 'TBD'].includes(match.status)) {
      return json({ error: 'Analisis hanya tersedia untuk pertandingan yang belum dimulai' }, 409);
    }

    const userContent =
      `<match_data>\n${JSON.stringify(match.data, null, 1)}\n</match_data>\n\n` +
      MARKET_REQUESTS[market];
    return text(analysisStream(new Anthropic({ apiKey }), cacheKey, userContent));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    const aborted = err instanceof Error && err.name === 'AbortError';
    return json({ error: message, timeout: aborted }, aborted ? 504 : 502);
  }
});
