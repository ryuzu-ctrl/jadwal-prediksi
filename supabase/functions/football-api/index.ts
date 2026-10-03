import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

const API_BASE = 'https://v3.football.api-sports.io';
const TZ = 'Asia/Jakarta';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function apiDate(offset: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = +(parts.find((p) => p.type === 'year')?.value || 0);
  const m = +(parts.find((p) => p.type === 'month')?.value || 0);
  const d = +(parts.find((p) => p.type === 'day')?.value || 0);
  const z = new Date(Date.UTC(y, m - 1, d + offset));
  return `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(
    z.getUTCDate()
  )}`;
}

async function fetchApi(endpoint: string, params: Record<string, string>) {
  const apiKey = 'b226e69821ba4088a4ea213d12c67809';
  const u = new URL(API_BASE + endpoint);
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) u.searchParams.set(k, v);
  }
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const u = new URL(req.url);
    const action = u.pathname.replace(/^\/football-api\/?/, '').split('/')[0];
    const q = u.searchParams;

    let data: unknown = null;

    if (action === 'fixtures' || action === '' || action === undefined) {
      const offset = parseInt(q.get('offset') || '0', 10) || 0;
      const date = q.get('date') || apiDate(offset);
      data = await fetchApi('/fixtures', {
        date,
        timezone: TZ,
        ...(q.get('league') ? { league: q.get('league')! } : {}),
      });
    } else if (action === 'predictions') {
      const fixture = q.get('fixture');
      if (!fixture) {
        return new Response(JSON.stringify({ error: 'Missing fixture id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      data = await fetchApi('/predictions', { fixture });
    } else if (action === 'odds') {
      const fixture = q.get('fixture');
      if (!fixture) {
        return new Response(JSON.stringify({ error: 'Missing fixture id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      data = await fetchApi('/odds', {
        fixture,
        ...(q.get('bookmaker') ? { bookmaker: q.get('bookmaker')! } : {}),
      });
    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    const aborted = err instanceof Error && err.name === 'AbortError';
    return new Response(JSON.stringify({ error: message, timeout: aborted }), {
      status: aborted ? 504 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
