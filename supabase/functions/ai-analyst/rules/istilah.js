// PERATURAN: Istilah
// Tulis isinya dalam Markdown di antara dua tanda backtick di bawah.
// Baris "export default", id, title, dan "markdown: String.raw" jangan diubah.
// Jangan memakai karakter backtick atau rangkaian dolar-kurung-kurawal di dalam teks.

export default {
  id: 'istilah',
  title: 'Istilah',
  markdown: String.raw`
# ISTILAH SEPAK BOLA DAN SPORTSBOOK

## SPORTSBOOK

Sportsbook:
Sistem atau platform yang menyediakan berbagai market taruhan olahraga.

Market:
Jenis taruhan yang tersedia pada sebuah pertandingan.

Odds:
Harga atau koefisien yang diberikan pada sebuah pilihan market.

Stake:
Jumlah dana yang dipertaruhkan.

Payout:
Jumlah pembayaran berdasarkan hasil dan odds.

Push:
Hasil taruhan yang dikembalikan karena settlement menghasilkan kondisi netral.

Refund:
Pengembalian stake sesuai aturan market.

Favorite:
Pilihan yang secara market dianggap lebih diunggulkan.

Underdog:
Pilihan yang secara market dianggap kurang diunggulkan.

## HASIL PERTANDINGAN

Home:
Tim tuan rumah.

Away:
Tim tamu.

Draw:
Pertandingan berakhir seri.

Clean Sheet:
Tim tidak kebobolan.

Win:
Menang.

Loss:
Kalah.

Extra Time:
Perpanjangan waktu setelah waktu normal.

Penalty Shootout:
Adu penalti untuk menentukan pemenang jika diperlukan.

## STATISTIK

Possession:
Persentase penguasaan bola.

Shot:
Percobaan tembakan.

Shot On Target:
Tembakan yang masuk kategori tepat sasaran berdasarkan definisi provider statistik.

Goal:
Gol.

Assist:
Umpan atau aksi yang secara resmi menghasilkan gol.

xG:
Expected Goals, estimasi kualitas peluang menghasilkan gol.

xA:
Expected Assists, estimasi kualitas peluang yang dibuat pemain.

Corner:
Tendangan sudut.

Foul:
Pelanggaran.

Offside:
Pelanggaran posisi offside sesuai Laws of the Game.

Yellow Card:
Kartu kuning.

Red Card:
Kartu merah.

Substitution:
Pergantian pemain.

## TAKTIK

Formation:
Susunan posisi dasar pemain.

Pressing:
Tekanan terhadap lawan.

Counter Press:
Tekanan segera setelah kehilangan bola.

Counter Attack:
Serangan cepat setelah mendapatkan bola.

Possession Football:
Gaya permainan yang mengutamakan penguasaan bola.

Low Block:
Pertahanan dengan garis yang rendah.

High Line:
Garis pertahanan tinggi.

Mid Block:
Blok pertahanan di area tengah.

Build Up:
Proses membangun serangan dari belakang.

Transition:
Perubahan dari menyerang ke bertahan atau sebaliknya.

Overload:
Keunggulan jumlah pemain pada area tertentu.

Overlap:
Pergerakan pemain melewati pemain yang membawa bola.

Through Ball:
Umpan menuju ruang di belakang pertahanan.

Cross:
Umpan silang.

Set Piece:
Situasi bola mati.

Man Marking:
Penjagaan pemain tertentu.

Zonal Marking:
Penjagaan berdasarkan zona.

Offside Trap:
Strategi menaikkan garis pertahanan untuk membuat lawan offside.

Playmaker:
Pemain yang mengatur kreativitas dan alur serangan.

Poacher:
Striker yang fokus pada positioning dan finishing.

Sweeper Keeper:
Kiper yang aktif membantu pertahanan dan build-up.

Utility Player:
Pemain yang dapat bermain di beberapa posisi.

Workrate:
Tingkat kerja dan keterlibatan pemain.

## MARKET

Moneyline:
Market hasil pertandingan.

Asian Handicap:
Market handicap berbasis gol dengan kemungkinan push/refund.

European Handicap:
Handicap dengan settlement tiga arah.

Draw No Bet:
Market yang mengembalikan taruhan jika seri.

Over:
Prediksi jumlah statistik berada di atas garis.

Under:
Prediksi jumlah statistik berada di bawah garis.

BTTS:
Both Teams To Score.

Correct Score:
Prediksi skor akhir.

Team Total:
Total statistik atau gol dari satu tim.

First Team To Score:
Tim yang mencetak gol pertama.

Last Team To Score:
Tim yang mencetak gol terakhir.

Half Time:
Babak pertama.

Full Time:
Pertandingan penuh.

Live:
Pertandingan sedang berlangsung.

Pre-Match:
Analisis sebelum pertandingan.

## STATUS PEMAIN

Available:
Pemain tersedia.

Starter:
Pemain dalam starting lineup.

Substitute:
Pemain cadangan.

Injured:
Pemain cedera.

Suspended:
Pemain terkena larangan bermain.

Doubtful:
Status pemain belum pasti.

Unavailable:
Pemain tidak tersedia.

## EVENT

Own Goal:
Gol bunuh diri.

Penalty:
Tendangan penalti.

Penalty Missed:
Penalti gagal menjadi gol.

Penalty Saved:
Penalti diselamatkan kiper.

Shot Off Post:
Tembakan mengenai tiang.

Error Lead To Goal:
Kesalahan yang menyebabkan gol.

Foul Lead To Penalty:
Pelanggaran yang menghasilkan penalti.

## ANALYTICAL TERMS

Form:
Performa pertandingan sebelumnya.

Home Form:
Performa saat bermain kandang.

Away Form:
Performa saat bermain tandang.

Head To Head:
Riwayat pertemuan kedua tim.

Goal Difference:
Selisih gol.

Game State:
Kondisi pertandingan berdasarkan skor, waktu, dan situasi permainan.

Tactical Matchup:
Interaksi gaya bermain dan struktur taktik kedua tim.

Sample Size:
Jumlah observasi yang digunakan dalam analisis.

Variance:
Variasi hasil yang dapat terjadi meskipun analisis terlihat kuat.

Confidence:
Tingkat keyakinan terhadap suatu kesimpulan.

Probability:
Estimasi kemungkinan sebuah outcome.

Value:
Perbedaan antara probabilitas estimasi dan harga/odds market.

## ATURAN PENTING

Istilah harus digunakan sesuai konteks.

AI tidak boleh menyamakan:
- Match Result dengan Asian Handicap;
- Asian Handicap dengan European Handicap;
- DNB dengan AH -0.5;
- statistik dengan prediksi;
- odds dengan probabilitas pasti.

Jika istilah memiliki definisi settlement khusus bookmaker, aturan bookmaker harus diprioritaskan.
`,
};
