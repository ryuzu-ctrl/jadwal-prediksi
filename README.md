# jadwal-prediksi
jadwal dan prediksi kapal judi

## Analisis AI

Tombol "Analisis AI" di tab Prediksi memanggil edge function `ai-analyst`, yang mengambil data fixture, statistik, odds, dan cedera dari API-Football lalu meminta analisis ke Claude dengan prompt di `supabase/functions/ai-analyst/system-prompt.ts`.

```bash
supabase secrets set ANTHROPIC_API_KEY=... FOOTBALL_API_KEY=...
supabase functions deploy ai-analyst
```
