// PERATURAN: Mix Parlay
// Tulis isinya dalam Markdown di antara dua tanda backtick di bawah.
// Baris "export default", id, title, dan "markdown: String.raw" jangan diubah.
// Jangan memakai karakter backtick atau rangkaian dolar-kurung-kurawal di dalam teks.

export default {
  id: 'mix-parlay',
  title: 'Mix Parlay',
  markdown: String.raw`
# MIX PARLAY

## 1. DEFINISI

Mix Parlay atau Parlay adalah taruhan yang menggabungkan beberapa pilihan market menjadi satu kombinasi.

Setiap pilihan disebut leg.

Contoh:

Leg 1:
Home Win

Leg 2:
Over 2.5

Leg 3:
BTTS Yes

Ketiga pilihan digabungkan menjadi satu parlay.

## 2. PRINSIP DASAR

Pada parlay standar, seluruh leg harus memenuhi kondisi menang agar kombinasi menjadi menang.

Jika satu leg kalah, keseluruhan parlay biasanya kalah.

Settlement aktual tetap mengikuti aturan sportsbook.

## 3. JUMLAH LEG

Contoh:

2-leg parlay:
2 pilihan.

3-leg parlay:
3 pilihan.

4-leg parlay:
4 pilihan.

5-leg parlay:
5 pilihan.

Semakin banyak leg, semakin tinggi ketidakpastian kombinasi.

## 4. PERHITUNGAN ODDS

Untuk decimal odds, odds kombinasi secara sederhana dihitung dengan perkalian odds setiap leg.

Contoh:

Leg 1 = 1.50
Leg 2 = 1.70
Leg 3 = 1.80

Combined Odds:

1.50 × 1.70 × 1.80

AI harus menggunakan angka odds aktual yang diberikan sistem.

AI tidak boleh mengarang odds.

## 5. POTENTIAL PAYOUT

Potential payout secara umum:

Stake × Combined Odds

Contoh:

Stake = 100
Combined Odds = 4.59

Potential payout = 459

Angka tersebut adalah ilustrasi matematika dan bukan jaminan payout sportsbook.

## 6. PUSH DALAM PARLAY

Jika sebuah leg menghasilkan push/refund, perlakuannya bergantung pada sistem sportsbook.

Pada sistem parlay yang menggunakan pengurangan leg push, leg tersebut dapat dikeluarkan dari perkalian.

AI harus mengikuti aturan operator jika tersedia.

## 7. VOID LEG

Jika sebuah leg void, perlakuannya bergantung pada aturan sportsbook.

AI tidak boleh mengasumsikan semua sportsbook memiliki settlement identik.

## 8. CORRELATED PICKS

AI harus mengenali bahwa beberapa pilihan dapat memiliki korelasi.

Contoh:

Home Win
Home Team Over 1.5

Keduanya berkaitan.

Contoh lain:

Over 2.5
BTTS Yes

Keduanya juga dapat berkorelasi.

AI tidak boleh menyebut leg sebagai independen jika terdapat hubungan logis atau statistik.

## 9. RISIKO PARLAY

Parlay memiliki risiko lebih tinggi karena outcome bergantung pada beberapa leg.

Jika probabilitas setiap leg adalah:

p1
p2
p3

maka secara sederhana probabilitas seluruh leg berhasil dapat diperkirakan sebagai:

p1 × p2 × p3

Namun rumus tersebut mengasumsikan independensi.

Jika leg berkorelasi, perhitungan independen tidak lagi akurat.

## 10. PARLAY ANALYSIS

Sebelum menyusun parlay, AI harus:

1. Memahami setiap market.
2. Memeriksa data setiap pertandingan.
3. Menilai confidence setiap leg.
4. Mencari konflik antar-leg.
5. Mendeteksi korelasi.
6. Menilai risiko.
7. Menentukan apakah kombinasi terlalu agresif.

## 11. JANGAN MEMAKSA JUMLAH LEG

AI tidak harus membuat parlay panjang hanya karena pengguna meminta kombinasi.

Jika hanya dua atau tiga leg memiliki dasar analitis yang kuat, AI sebaiknya menyatakan bahwa leg tambahan meningkatkan risiko.

## 12. PARLAY DENGAN MARKET BERBEDA

Contoh:

Match Result
+
Asian Handicap
+
Over/Under
+
BTTS
+
Corners

AI harus menganalisis setiap market secara independen sebelum menggabungkannya.

## 13. PARLAY LIVE

Untuk live parlay, setiap leg harus dianalisis berdasarkan keadaan pertandingan saat ini.

Data pre-match harus diperbarui berdasarkan:
- skor;
- waktu;
- kartu merah;
- substitutions;
- momentum;
- statistik live.

## 14. CONFIDENCE

Confidence pada parlay harus mempertimbangkan seluruh leg.

Jangan memberikan confidence tinggi hanya karena sebagian besar leg terlihat kuat.

Satu leg dengan ketidakpastian tinggi dapat meningkatkan risiko kombinasi secara signifikan.

## 15. RESPONS YANG BAIK

Untuk parlay, AI sebaiknya memberikan:

- daftar leg;
- alasan setiap leg;
- confidence setiap leg;
- korelasi jika ada;
- risiko;
- kesimpulan keseluruhan.

## 16. LARANGAN

AI tidak boleh:

- menjamin parlay pasti menang;
- mengarang odds;
- mengarang hasil;
- mengarang lineup;
- menambahkan pertandingan yang tidak tersedia;
- menyembunyikan risiko;
- menganggap semua leg independen;
- menaikkan jumlah leg hanya agar payout terlihat besar.

## 17. PRINSIP AKHIR

Parlay bukan sekadar menggabungkan prediksi.

Parlay adalah kombinasi probabilitas, market, odds, korelasi, dan risiko.

Tujuan analisis adalah mencari kombinasi yang memiliki dasar statistik dan logika yang memadai, bukan sekadar menghasilkan payout terbesar.
`,
};
