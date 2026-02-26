# UX Final Go-Live Checklist (SILAB-KL)

Checklist ini dipakai untuk review akhir UX sebelum `go-live` / pilot. Fokusnya bukan bug teknis backend, tetapi kemudahan penggunaan untuk `admin`, `petugas_plp`, dan `mahasiswa`.

## 1. Navigasi & Struktur Menu

- [ ] Sidebar menampilkan menu sesuai role (admin / petugas_plp / mahasiswa)
- [ ] Group menu mudah dipahami (`Operasional`, `Master Data`, `Monitoring`, `Akun`)
- [ ] User bisa menebak fungsi menu tanpa penjelasan tambahan
- [ ] Tidak ada menu yang mengarah ke halaman kosong / no-op

## 2. Hierarchy Visual Halaman Inti

- [ ] Setiap halaman punya judul + deskripsi singkat yang jelas
- [ ] Aksi utama lebih menonjol daripada aksi sekunder
- [ ] Panel prioritas kerja (`Butuh Tindakan` / `Fokus Kerja`) mudah terlihat
- [ ] Informasi status dan langkah berikutnya terlihat jelas

## 3. UX Peminjaman (Admin / PLP)

- [ ] User paham urutan proses: pengajuan -> approval -> serah terima -> pengembalian
- [ ] Detail transaksi mudah dibaca karena tab `Ringkasan / Riwayat / Tindakan`
- [ ] Banner `Langkah Berikutnya` membantu tindakan operasional
- [ ] Form pengajuan multi-item tidak membingungkan
- [ ] Empty state tabel peminjaman punya CTA yang jelas

## 4. UX Peminjaman (Mahasiswa)

- [ ] Mahasiswa mudah memahami arti status pengajuan
- [ ] View mahasiswa terasa lebih sederhana dari admin/PLP
- [ ] Tombol `Pinjam Sekarang` dari katalog jelas arahnya ke pengajuan
- [ ] Empty state mahasiswa mengarahkan ke katalog / buat pengajuan

## 5. UX Bahan Habis Pakai

- [ ] Perbedaan tab (`Stok Aktif`, `Permintaan Bahan`, `Histori Stok`) jelas
- [ ] User tahu kapan harus memproses request vs melihat histori
- [ ] Label histori stok mudah dipahami (bukan enum teknis)
- [ ] Aksi stok masuk / edit / nonaktif tidak terlalu padat

## 6. UX Penggunaan Lab

- [ ] Perbedaan `Tambah Jadwal` vs `Catat Penggunaan Lab` jelas
- [ ] Form `Catat Penggunaan` terbantu oleh helper text / auto-fill jadwal
- [ ] Absensi manual mudah diisi dan formatnya dipahami user
- [ ] Empty state jadwal/riwayat memberi CTA yang tepat

## 7. Dashboard Monitoring

- [ ] Dashboard membantu keputusan harian (bukan hanya angka)
- [ ] Panel `Fokus Hari Ini` relevan untuk operasional
- [ ] Komponen statistik dan analytics mudah dibaca cepat
- [ ] Tidak ada section yang terlalu padat / sulit dipahami user baru

## 8. Responsif & Keterbacaan

- [ ] Tabel penting tetap usable di laptop kecil/tablet
- [ ] Ada helper “geser tabel” pada layar kecil (jika perlu)
- [ ] Dialog panjang masih nyaman discroll
- [ ] Teks, badge, dan tombol tidak saling bertumpuk di layar sempit

## 9. Konsistensi Istilah & Label

- [ ] Istilah status konsisten (`Menunggu`, `Disetujui`, `Ditolak`, `Dikembalikan`, dll.)
- [ ] Istilah aksi konsisten (`Serah Terima`, `Terima Kembali`, `Penuhi`, dll.)
- [ ] Tidak ada campuran istilah teknis internal yang tampil ke user (contoh enum DB)

## 10. UAT Lapangan (Validasi Nyata)

- [ ] Admin dapat menyelesaikan skenario tanpa pendampingan intensif
- [ ] Petugas PLP memahami assignment lab dan batas aksesnya
- [ ] Mahasiswa memahami alur pengajuan dan status
- [ ] Tim mencatat titik bingung user (kalimat, tombol, urutan, istilah)
- [ ] Temuan UAT dikategorikan: `critical`, `important`, `nice-to-have`

## Keputusan Go-Live (Isi setelah review)

- Tanggal review UX:
- Reviewer:
- Status:
  - [ ] Siap go-live
  - [ ] Siap pilot/UAT lanjutan
  - [ ] Perlu perbaikan UX dulu
- Catatan utama:

