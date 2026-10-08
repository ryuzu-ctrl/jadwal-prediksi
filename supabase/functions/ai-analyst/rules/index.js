// DAFTAR PERATURAN untuk fitur "Tanya Peraturan" pada AI Wasit.
// File ini hanya daftar topik. JANGAN menulis isi peraturan di sini:
// isi peraturan ada di file topik masing-masing, dan metodologi analisis
// ada di ../knowledge.ts.
//
// Menambah topik baru:
//   1. Salin salah satu file topik (misalnya istilah.js) dengan nama baru.
//   2. Ganti id, title, dan isi markdown-nya.
//   3. Import file itu di sini dan masukkan ke daftar RULES.
//   4. Deploy ulang:  supabase functions deploy ai-analyst

import caraBermain from './cara-bermain.js';
import ketentuanUmum from './ketentuan-umum.js';
import jenisTaruhan from './jenis-taruhan.js';
import mixParlay from './mix-parlay.js';
import istilah from './istilah.js';

export const RULES = [
  caraBermain,
  ketentuanUmum,
  jenisTaruhan,
  mixParlay,
  istilah,
];
