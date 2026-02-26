# UX Responsive QA Checklist (SILAB-KL)

Checklist ini dipakai untuk validasi UX pada layar kecil/menengah:
- laptop kecil (`1366x768`)
- tablet portrait/landscape
- HP (minimal cek quick pass)

Fokus checklist:
- keterbacaan
- kepadatan layout
- usability tabel, dialog, filter, dan CTA

## 1. Matrix Device Uji (Isi Saat Testing)

- [ ] Laptop kecil `1366x768`
- [ ] Laptop `1280x800` / zoom browser `110%-125%`
- [ ] Tablet landscape (`~1024px`)
- [ ] Tablet portrait (`~768px`)
- [ ] HP portrait (`~390-430px`)

Catatan perangkat/browser:
- Device:
- Browser:
- Zoom:

## 2. Shell Global (Header + Sidebar)

- [ ] Header tetap rapi saat judul halaman panjang
- [ ] Subtitle header tidak menabrak user dropdown pada layar sempit
- [ ] Tombol sidebar trigger mudah diakses
- [ ] Sidebar group menu (`Operasional`, `Master Data`, `Monitoring`, `Akun`) tetap terbaca jelas
- [ ] Active menu terlihat jelas (background/border/shadow terbaca)
- [ ] Sidebar tidak terasa terlalu pucat atau terlalu kontras di layar nyata

## 3. Form Controls (Global)

- [ ] Dropdown (`Select`) di form mengikuti lebar grid/kolom (full width)
- [ ] Input/textarea tidak terpotong di dialog
- [ ] Label dan helper text tidak bertumpuk
- [ ] Tombol aksi dialog tersusun rapi (stack di layar kecil, sejajar di layar lebih lebar)
- [ ] Tombol destruktif tetap mudah dikenali

## 4. Dialog / Modal (Global)

- [ ] Dialog muncul dengan margin yang cukup di semua sisi layar
- [ ] Konten dialog panjang tetap nyaman di-scroll
- [ ] Header dialog (title + description) terbaca tanpa terlalu padat
- [ ] Tombol close (`X`) mudah diklik
- [ ] Footer dialog tidak mepet/broken pada tablet/HP

## 5. Peminjaman (`/dashboard/borrowing`)

- [ ] Panel `Butuh Tindakan` tidak terlalu padat di tablet
- [ ] Area filter (status + scope + helper text) tetap rapi di tablet/laptop kecil
- [ ] Tabel peminjaman bisa di-scroll horizontal dengan nyaman
- [ ] Helper “geser tabel” terlihat saat dibutuhkan
- [ ] Dialog detail transaksi (tab `Ringkasan/Riwayat/Tindakan`) tetap usable di tablet
- [ ] Form pengajuan multi-item masih nyaman diisi (scroll area alat/bahan, footer tombol)

## 6. Bahan Habis Pakai (`/dashboard/consumables`)

- [ ] CTA utama/sekunder tidak bertabrakan di header halaman
- [ ] `TabsList` (`Stok Aktif`, `Permintaan`, `Histori`) tetap terbaca di tablet
- [ ] Quick filter request tidak terlalu rapat
- [ ] Kartu stok bahan tetap terbaca (aksi tidak menumpuk)
- [ ] Tabel permintaan dan histori stok bisa di-scroll horizontal dengan nyaman
- [ ] Dialog proses permintaan / stok masuk / edit bahan nyaman dipakai di tablet

## 7. Penggunaan Lab (`/dashboard/lab-usage`)

- [ ] CTA `Catat Penggunaan Lab` dan `Tambah Jadwal` tetap jelas prioritasnya
- [ ] Kartu jadwal tidak terlalu padat di laptop kecil
- [ ] Tabel riwayat penggunaan tetap nyaman dibaca (horizontal scroll jika perlu)
- [ ] Dialog edit/hapus jadwal tetap rapi di layar sempit
- [ ] Dialog detail riwayat + daftar hadir tetap nyaman discroll

## 8. Master Alat (`/dashboard/tools`)

- [ ] KPI compact tetap terbaca di tablet
- [ ] Filter + search area tidak menabrak CTA
- [ ] Tabel unit alat tetap nyaman dibaca dengan scroll horizontal
- [ ] Dialog detail alat (histori event) tetap nyaman
- [ ] Dialog edit unit tidak terasa terlalu padat di tablet
- [ ] Dialog QR preview tampil proporsional (QR tidak terlalu kecil/terpotong)

## 9. Kelola User (`/dashboard/users`)

- [ ] KPI compact user tetap rapi di tablet
- [ ] Filter user dan filter audit tidak terlalu padat
- [ ] Tabel daftar pengguna dan audit bisa di-scroll horizontal dengan nyaman
- [ ] Dialog kelola user / reset password / detail audit tetap nyaman
- [ ] Assignment lab (checkbox list) tetap mudah dipilih di layar menengah

## 10. Katalog Mahasiswa (`/dashboard/student-tools`) + Pengajuan Saya

- [ ] Grid katalog alat tetap enak discan pada HP/tablet
- [ ] Card alat tidak terlalu tinggi / terlalu rapat
- [ ] Filter kategori + search tetap mudah dipakai
- [ ] Empty state mudah dipahami
- [ ] Halaman peminjaman mahasiswa tetap sederhana dan tidak membingungkan

## 11. Dashboard Monitoring

- [ ] Kartu statistik tidak terlalu rapat di laptop kecil
- [ ] Section analytics masih terbaca tanpa terasa “sumpek”
- [ ] List aktivitas / ringkasan lab / overdue tetap nyaman discroll
- [ ] Tidak ada badge/label yang terpotong

## 12. Halaman Cetak / Preview

- [ ] Toolbar preview bukti peminjaman tetap rapi di layar kecil
- [ ] Dokumen preview tetap terbaca sebelum print
- [ ] Tombol `Cetak` mudah ditemukan
- [ ] QR preview dialog tetap proporsional dan readable

## 13. Temuan & Kategori

Catat temuan per halaman dengan kategori:
- `critical` (menghambat tugas / aksi gagal dilakukan)
- `important` (bisa kerja tapi membingungkan / lambat)
- `nice-to-have` (polish visual / kenyamanan)

Format catatan temuan:
- Halaman:
- Device/viewport:
- Skenario:
- Temuan:
- Kategori:
- Saran perbaikan:

## 14. Keputusan Setelah QA Responsive

- [ ] Lolos untuk pilot/UAT lanjutan
- [ ] Perlu polish tambahan minor
- [ ] Perlu perbaikan UX signifikan sebelum lanjut

PIC Review:
- Nama:
- Tanggal:

