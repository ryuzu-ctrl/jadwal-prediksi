// PERATURAN: Cara Bermain
// Tulis isinya dalam Markdown di antara dua tanda backtick di bawah.
// Baris "export default", id, title, dan "markdown: String.raw" jangan diubah.
// Jangan memakai karakter backtick atau rangkaian dolar-kurung-kurawal di dalam teks.

export default {
  id: 'cara-bermain',
  title: 'Cara Bermain',
  markdown: String.raw`
# CARA BERMAIN SPORTSBOOK

## 1. TUJUAN

Knowledge Base ini menjelaskan cara memahami dan menganalisis market sportsbook sepak bola.

AI harus memahami bahwa setiap market memiliki:
- cara bermain;
- kondisi menang;
- kondisi kalah;
- kondisi refund/push jika berlaku;
- aturan settlement;
- tingkat risiko yang berbeda.

AI harus selalu memahami market terlebih dahulu sebelum melakukan analisis.

## 2. ALUR DASAR

Urutan analisis:

1. Identifikasi pertandingan.
2. Identifikasi market.
3. Identifikasi pilihan taruhan.
4. Pahami garis handicap atau total.
5. Tentukan kondisi menang.
6. Tentukan kondisi kalah.
7. Tentukan apakah terdapat kondisi push/refund.
8. Ambil data pertandingan terbaru.
9. Analisis statistik yang relevan.
10. Evaluasi risiko.
11. Berikan kesimpulan.

## 3. MATCH RESULT

Match Result menggunakan tiga pilihan:

- Home
- Draw
- Away

Home menang jika tim tuan rumah memenangkan pertandingan.

Draw menang jika pertandingan berakhir seri.

Away menang jika tim tamu memenangkan pertandingan.

AI harus memastikan apakah market menggunakan waktu normal atau termasuk extra time.

## 4. ASIAN HANDICAP

Asian Handicap memberikan handicap virtual kepada salah satu tim.

Contoh:

AH 0:
Tim yang dipilih harus menang.
Jika seri, taruhan push/refund.

AH -0.5:
Tim yang dipilih harus menang.

AH +0.5:
Tim yang dipilih menang atau seri.

AH -1:
Menang lebih dari satu gol = menang.
Menang tepat satu gol = push.
Seri atau kalah = kalah.

AH +1:
Menang atau seri = menang.
Kalah tepat satu gol = push.
Kalah lebih dari satu gol = kalah.

## 5. HANDICAP SEPEREMPAT

Garis seperempat dibagi menjadi dua bagian.

AH -0.25:
- AH 0
- AH -0.5

AH +0.25:
- AH 0
- AH +0.5

AH -0.75:
- AH -0.5
- AH -1

AH +0.75:
- AH +0.5
- AH +1

AI harus menghitung settlement masing-masing bagian.

## 6. OVER / UNDER

Over/Under digunakan untuk memprediksi total gol.

Over 2.5:
Minimal 3 gol.

Under 2.5:
Maksimal 2 gol.

Contoh:
0-0 = 0 gol
1-0 = 1 gol
1-1 = 2 gol
2-1 = 3 gol

## 7. TOTAL SEPEREMPAT

Over 2.25:
- Over 2.0
- Over 2.5

Under 2.75:
- Under 2.5
- Under 3.0

Settlement harus dihitung dari kedua bagian.

## 8. BOTH TEAMS TO SCORE

BTTS Yes:
Kedua tim mencetak minimal satu gol.

BTTS No:
Minimal satu tim tidak mencetak gol.

Contoh:

1-1 = Yes
2-1 = Yes
1-0 = No
0-0 = No

## 9. DRAW NO BET

DNB:

Menang = menang.
Seri = push/refund.
Kalah = kalah.

DNB harus dibedakan dari AH -0.5.

## 10. TEAM TOTAL

Team Total hanya menghitung gol dari tim yang dipilih.

Home Over 1.5:
Tim tuan rumah harus mencetak minimal 2 gol.

Home Under 1.5:
Tim tuan rumah maksimal mencetak 1 gol.

## 11. CORRECT SCORE

Correct Score memprediksi skor akhir tertentu.

Contoh:
1-0
1-1
2-1
2-0
0-1

Market ini memiliki tingkat ketidakpastian tinggi karena jumlah kemungkinan hasil sangat banyak.

## 12. FIRST TEAM TO SCORE

Memprediksi tim yang mencetak gol pertama.

Pilihan dapat berupa:
- Home
- Away
- No Goal

Settlement mengikuti aturan market yang digunakan.

## 13. LAST TEAM TO SCORE

Memprediksi tim yang mencetak gol terakhir.

Jika tidak terjadi gol, settlement mengikuti aturan market.

## 14. WHICH TEAM TO ADVANCE

Memprediksi tim yang lolos ke babak berikutnya.

Berbeda dengan Match Result.

Jika kompetisi menggunakan:
- extra time;
- penalty shootout;

maka mekanisme tersebut harus diperhitungkan.

## 15. FIRST HALF

Market babak pertama hanya menggunakan kejadian selama babak pertama.

AI tidak boleh menggunakan statistik full match secara langsung tanpa menyesuaikannya dengan konteks first half.

## 16. SECOND HALF

Market babak kedua harus dianalisis menggunakan karakteristik babak kedua.

Faktor yang penting:
- performa second half;
- substitutions;
- game state;
- stamina;
- tactical adjustment.

## 17. MARKET LIVE

Untuk pertandingan live, AI harus memprioritaskan:

- skor;
- menit;
- kartu merah;
- substitutions;
- shots;
- shots on target;
- possession;
- momentum;
- xG jika tersedia.

Prediksi pre-match tidak boleh diperlakukan sebagai prediksi live tanpa penyesuaian.

## 18. PRINSIP UTAMA

AI tidak boleh menganggap:
- favorit pasti menang;
- underdog pasti kalah;
- odds sebagai kepastian;
- satu statistik sebagai bukti final.

Setiap market harus dianalisis sesuai karakteristiknya.
`,
};
