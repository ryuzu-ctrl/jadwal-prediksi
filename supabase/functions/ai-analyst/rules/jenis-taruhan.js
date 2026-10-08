// PERATURAN: Jenis Taruhan
// Tulis isinya dalam Markdown di antara dua tanda backtick di bawah.
// Baris "export default", id, title, dan "markdown: String.raw" jangan diubah.
// Jangan memakai karakter backtick atau rangkaian dolar-kurung-kurawal di dalam teks.

export default {
  id: 'jenis-taruhan',
  title: 'Jenis Taruhan',
  markdown: String.raw`
# JENIS-JENIS TARUHAN SPORTSBOOK

## 1. MATCH RESULT

Pilihan:
- Home
- Draw
- Away

Memprediksi hasil pertandingan.

## 2. DOUBLE CHANCE

Pilihan umum:

1X:
Home atau Draw.

X2:
Draw atau Away.

12:
Home atau Away.

Market ini memiliki dua kemungkinan hasil yang dilindungi.

## 3. DRAW NO BET

Pilihan:
- Home
- Away

Jika pertandingan seri, taruhan push/refund.

## 4. ASIAN HANDICAP

Market menggunakan handicap gol virtual.

Contoh:
-0.5
-0.25
0
+0.25
+0.5
-0.75
+0.75
-1
+1

Garis seperempat dibagi menjadi dua handicap.

## 5. EUROPEAN HANDICAP

European Handicap menggunakan handicap untuk menentukan hasil tiga arah.

Pilihan tetap:
- Home
- Draw
- Away

Berbeda dari Asian Handicap karena settlement menggunakan tiga kemungkinan hasil setelah handicap.

## 6. TOTAL GOALS

Pilihan:
- Over
- Under

Menghitung total gol kedua tim.

## 7. TEAM TOTAL GOALS

Menghitung total gol satu tim tertentu.

Contoh:
- Home Over 1.5
- Away Under 2.5

## 8. BOTH TEAMS TO SCORE

Pilihan:
- Yes
- No

Yes berarti kedua tim mencetak gol.

No berarti setidaknya satu tim gagal mencetak gol.

## 9. CORRECT SCORE

Memprediksi skor akhir.

Contoh:
- 0-0
- 1-0
- 1-1
- 2-1
- 2-0

## 10. HALF TIME RESULT

Memprediksi hasil pada akhir babak pertama:

- Home
- Draw
- Away

## 11. HALF TIME TOTAL

Memprediksi total gol pada babak pertama.

Contoh:
- Over 0.5
- Under 1.5
- Over 1.25

## 12. FIRST TEAM TO SCORE

Memprediksi tim yang mencetak gol pertama.

## 13. LAST TEAM TO SCORE

Memprediksi tim yang mencetak gol terakhir.

## 14. FIRST GOAL TIME

Memprediksi periode waktu ketika gol pertama terjadi.

## 15. TOTAL CORNERS

Memprediksi total corner pertandingan.

Contoh:
Over 9.5 Corners.

## 16. TEAM CORNERS

Memprediksi corner yang diperoleh tim tertentu.

Contoh:
Home Over 5.5 Corners.

## 17. CORNER HANDICAP

Menggunakan handicap terhadap jumlah corner.

## 18. TOTAL BOOKINGS

Memprediksi jumlah kartu berdasarkan definisi settlement bookmaker.

## 19. TEAM BOOKINGS

Memprediksi jumlah kartu tim tertentu.

## 20. PLAYER GOALS

Memprediksi apakah pemain tertentu mencetak gol.

## 21. PLAYER ASSISTS

Memprediksi apakah pemain tertentu mencatat assist.

## 22. PLAYER SHOTS

Memprediksi jumlah atau garis shots pemain.

## 23. PLAYER SHOTS ON TARGET

Memprediksi jumlah shots on target pemain.

## 24. PLAYER CARDS

Memprediksi apakah pemain menerima kartu atau jumlah kartunya.

## 25. WHICH TEAM TO ADVANCE

Memprediksi tim yang lolos ke babak berikutnya.

Market ini berbeda dari Match Result.

## 26. FIRST HALF / SECOND HALF MARKETS

Market dapat diterapkan secara khusus untuk:
- result;
- goals;
- corners;
- cards;
- team goals.

AI harus membaca periode yang ditentukan market.

## 27. SPECIAL MARKETS

Special market dapat mencakup:
- first event;
- last event;
- exact statistics;
- player specials;
- combination markets.

Jika definisi settlement tidak tersedia, AI tidak boleh mengarang aturan.

## 28. MARKET PRIORITY

Setiap market harus dianalisis berdasarkan statistik yang relevan.

Contoh:

Match Result:
kekuatan tim dan probabilitas hasil.

Asian Handicap:
margin kemenangan.

Over/Under:
distribusi total gol.

BTTS:
kemampuan kedua tim mencetak gol.

Corners:
volume serangan dan pola crossing.

Cards:
foul, referee tendency jika tersedia, dan karakter pertandingan.

Player market:
peran pemain, minutes, starting status, dan statistik pemain.

## 29. MARKET TIDAK DIKENAL

Jika market tidak dikenali atau aturan settlement tidak tersedia:

AI harus mengatakan bahwa market membutuhkan definisi settlement sebelum dapat dianalisis dengan akurat.

AI dilarang mengarang aturan.
`,
};
