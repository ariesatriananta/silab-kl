# SILAB-KL Manual E2E UAT Guide

## Tujuan

Dokumen ini adalah panduan test manual end-to-end (UAT) untuk memastikan alur bisnis utama berjalan untuk semua role:

- `admin`
- `petugas_plp`
- `mahasiswa`

Fokus dokumen ini:

- verifikasi alur bisnis inti
- verifikasi role access / pembatasan akses
- verifikasi perubahan data antar modul (alat, bahan, dashboard, lab usage)

## Prasyarat

1. Jalankan aplikasi lokal:

```bash
pnpm dev
```

2. Pastikan DB sudah ada dan schema terbaru sudah terpasang:

```bash
pnpm db:migrate
```

3. Reset data uji ke data seed (opsional tapi sangat disarankan sebelum UAT):

```bash
pnpm db:seed
```

4. URL aplikasi lokal:

- `http://localhost:3000`

## Akun Seed (Default)

Catatan:

- Semua akun seed default password = `password`
- Saat login pertama, sistem akan memaksa ganti password (`/dashboard/account/security`)

Gunakan password baru berikut agar konsisten selama UAT:

- `admin` -> `Admin#12345`
- `plp.suryani` -> `Plp#12345`
- `P27834021001` -> `Mhs#12345`

Akun seed tambahan (jika perlu):

- `plp.hartono` / `password`
- `P27834021015` / `password`
- `P27834021008` / `password`

## Ringkasan Role untuk UAT

- `admin`
  - akses semua modul
  - approval / handover / return
  - kelola master alat, master bahan, jadwal lab
- `petugas_plp`
  - akses hanya lab assignment
  - approval / handover / return untuk lab assignment
  - kelola data pada lab assignment
- `mahasiswa`
  - katalog alat
  - pengajuan peminjaman
  - permintaan bahan
  - lihat data milik sendiri

## Urutan UAT yang Disarankan (End-to-End)

Ikuti urutan ini agar perubahan data saling terlihat:

1. Force change password (semua role utama)
2. RBAC / akses halaman dasar
3. Master alat (admin)
4. Katalog mahasiswa + pinjam dari listing (mahasiswa)
5. Peminjaman alat+bahan (mahasiswa -> approval admin+PLP -> handover -> partial return -> selesai)
6. Bahan habis pakai (permintaan bahan + approve/fulfill + stok masuk + histori stok)
7. Penggunaan ruang lab (jadwal + usage log + absensi)
8. Dashboard monitoring (cek agregasi)
9. Bukti/cetak peminjaman

## Skenario 1 - Login & Force Change Password

### 1A. Admin

Langkah:

1. Login dengan `admin / password`
2. Sistem harus redirect ke `/dashboard/account/security`
3. Ganti password ke `Admin#12345`
4. Sistem logout otomatis
5. Login ulang pakai `admin / Admin#12345`

Expected result:

- Tidak bisa masuk dashboard sebelum ganti password
- Setelah ganti password, login sukses dan bisa akses dashboard

### 1B. Petugas PLP

Langkah:

1. Login `plp.suryani / password`
2. Ganti password ke `Plp#12345`
3. Login ulang

Expected result:

- Flow sama seperti admin

### 1C. Mahasiswa

Langkah:

1. Login `P27834021001 / password`
2. Ganti password ke `Mhs#12345`
3. Login ulang

Expected result:

- Setelah login ulang, mahasiswa diarahkan ke `/dashboard/student-tools`

## Skenario 2 - RBAC / Akses Halaman Dasar

### 2A. Mahasiswa

Langkah:

1. Login sebagai mahasiswa
2. Akses manual URL:
   - `/dashboard`
   - `/dashboard/borrowing`
   - `/dashboard/consumables`
   - `/dashboard/lab-usage`
   - `/dashboard/tools`
3. Akses `/dashboard/student-tools`

Expected result:

- `/dashboard` redirect ke `/dashboard/student-tools`
- Halaman admin lain redirect ke `/dashboard/student-tools`
- `/dashboard/student-tools` tetap bisa diakses
- `/dashboard/account/security` tetap bisa diakses

### 2B. Admin

Langkah:

1. Login admin
2. Buka semua modul dashboard

Expected result:

- Semua halaman bisa diakses

### 2C. Petugas PLP

Langkah:

1. Login `plp.suryani`
2. Buka modul dashboard

Expected result:

- Halaman dashboard bisa diakses
- Data yang tampil hanya untuk lab assignment `plp.suryani`

## Skenario 3 - Master Data Alat (Admin)

Tujuan: memastikan CRUD baseline alat + QR + histori event berjalan.

Langkah:

1. Login sebagai `admin`
2. Buka `/dashboard/tools`
3. Klik `Tambah Alat`
4. Isi data contoh:
   - kode model: `TM-UAT-001`
   - nama: `Mikropipet UAT`
   - merk: `Eppendorf`
   - kategori: `Pipet`
   - lab: pilih salah satu lab aktif
   - lokasi detail: `Rak A1`
   - unit count: `2`
5. Simpan
6. Pastikan muncul 2 unit asset di tabel tools
7. Buka `QR` salah satu unit -> cek preview QR tampil
8. Klik `Cetak QR` (boleh cancel print browser)
9. Edit salah satu unit:
   - ubah kondisi ke `maintenance`
   - isi catatan/event note
10. Simpan dan buka lagi detail/edit untuk cek histori event

Expected result:

- Data alat tersimpan ke DB
- Unit alat dibuat sesuai jumlah
- QR preview dan print dialog muncul
- Perubahan kondisi/status tercatat di histori event

## Skenario 4 - Listing Mahasiswa & Pinjam Langsung dari Listing

Tujuan: verifikasi mahasiswa bisa mengajukan dari katalog realtime.

Langkah:

1. Login sebagai mahasiswa (`P27834021001 / Mhs#12345`)
2. Buka `/dashboard/student-tools`
3. Filter lab/kategori (opsional)
4. Klik `Pinjam Sekarang` pada alat yang tersedia
5. Pastikan diarahkan ke `/dashboard/borrowing` dan dialog pengajuan terbuka
6. Pastikan alat/lab terisi otomatis (prefill)
7. Isi field akademik wajib:
   - Mata kuliah
   - Materi
   - Semester
   - Kelompok
   - Dosen pembimbing (opsional)
8. Tambahkan bahan habis pakai (opsional)
9. Submit

Expected result:

- Pengajuan berhasil dibuat
- Status awal `pending_approval`
- Transaksi muncul di daftar peminjaman mahasiswa

## Skenario 5 - End-to-End Peminjaman (Semua Role)

Ini skenario paling penting. Jalankan berurutan.

### 5A. Mahasiswa membuat pengajuan (alat + bahan)

Langkah:

1. Login mahasiswa
2. Buka `/dashboard/borrowing`
3. Klik `Buat Pengajuan`
4. Pilih lab
5. Isi:
   - Mata kuliah
   - Materi
   - Semester
   - Kelompok
   - Dosen pembimbing (opsional)
   - Keperluan
6. Pilih minimal:
   - 2 alat
   - 1 bahan (qty > 0)
7. Submit
8. Catat `kode transaksi`

Expected result:

- Pengajuan sukses
- Status `pending_approval`
- Detail transaksi menampilkan field akademik + item alat/bahan

### 5B. Approval level 1 (Admin)

Langkah:

1. Login admin
2. Buka `/dashboard/borrowing`
3. Cari kode transaksi dari langkah 5A
4. Approve (lebih baik dari dialog detail, isi catatan)

Expected result:

- Status tetap `pending_approval`
- Riwayat approval menampilkan 1 approval

### 5C. Approval level 2 (Petugas PLP)

Langkah:

1. Login `plp.suryani` (pastikan lab transaksi termasuk assignment dia; kalau tidak, pakai PLP yang sesuai)
2. Buka `/dashboard/borrowing`
3. Cari transaksi yang sama
4. Approve

Expected result:

- Status berubah menjadi `approved_waiting_handover` (Menunggu Serah Terima)
- Riwayat approval menjadi 2 entri
- Approver kedua harus berbeda user

### 5D. Negative check: duplicate approver

Langkah:

1. Pada transaksi baru lain (opsional), coba approve 2x oleh user yang sama

Expected result:

- Sistem menolak approval kedua oleh user yang sama

### 5E. Handover (Admin/PLP)

Langkah:

1. Buka detail transaksi status `Menunggu Serah Terima`
2. Isi `due_date`
3. Isi catatan handover (opsional)
4. Proses handover

Expected result:

- Status transaksi jadi `active`
- `handedOverAt` dan `dueDate` terisi
- Status asset alat berubah `borrowed` di `/dashboard/tools`
- Stok bahan berkurang di `/dashboard/consumables`
- Histori handover tampil di detail transaksi

### 5F. Partial Return alat

Langkah:

1. Pada transaksi status `Aktif`, buka detail
2. Return 1 alat dulu (pilih kondisi `baik`)
3. Cek status transaksi
4. Return alat berikutnya (coba kondisi `maintenance` atau `damaged`)

Expected result:

- Setelah return pertama: status `partially_returned`
- Setelah semua alat kembali: status `completed`
- Riwayat pengembalian tampil per event
- Status/kondisi asset alat ter-update di master alat

## Skenario 6 - Bukti / Cetak Peminjaman

Langkah:

1. Buka detail transaksi peminjaman
2. Klik `Cetak Bukti`
3. Cek halaman `/borrowing-proof/[id]`
4. Klik `Cetak`

Expected result:

- Halaman bukti terbuka
- Data transaksi, item, field akademik, approval tampil
- Layout print-friendly muncul dan bisa print browser

## Skenario 7 - Manajemen Bahan Habis Pakai

### 7A. Master bahan + stok masuk (Admin/PLP)

Langkah:

1. Login admin atau PLP
2. Buka `/dashboard/consumables`
3. Tambah master bahan baru
4. Edit bahan (ubah stok minimum / metadata)
5. Klik `Stok Masuk`, isi qty + sumber/catatan

Expected result:

- Master bahan tersimpan
- Stok bertambah sesuai qty masuk
- Histori stok (ledger) mencatat `stock_in` / `manual_adjustment`

### 7B. Permintaan bahan oleh mahasiswa

Langkah:

1. Login mahasiswa
2. Buka `/dashboard/consumables`
3. Buat permintaan bahan (multi-item)

Expected result:

- Permintaan bahan tersimpan dengan status `pending`
- Mahasiswa hanya melihat permintaan milik sendiri

### 7C. Proses permintaan bahan oleh admin/PLP

Langkah:

1. Login admin/PLP
2. Approve permintaan bahan
3. Fulfill permintaan bahan
4. Buka detail permintaan
5. Buka tab/section histori stok

Expected result:

- Status berubah `pending -> approved -> fulfilled`
- `qtyFulfilled` terisi
- Stok berkurang otomatis
- Ledger mencatat `material_request_fulfill`

### 7D. Negative check stok tidak cukup (opsional)

Langkah:

1. Buat permintaan dengan qty lebih besar dari stok
2. Approve
3. Coba fulfill

Expected result:

- Fulfill gagal dengan pesan stok tidak cukup
- Status tetap `approved`

## Skenario 8 - Penggunaan Ruang Lab (Jadwal + Riwayat + Absensi)

### 8A. CRUD Jadwal Lab

Langkah:

1. Login admin/PLP
2. Buka `/dashboard/lab-usage`
3. Tambah jadwal lab
4. Edit jadwal
5. Hapus jadwal (cek konfirmasi)

Expected result:

- Jadwal berhasil create/update/delete
- Validasi jam dan kapasitas bekerja

### 8B. Catat penggunaan lab + absensi manual

Langkah:

1. Klik `Catat Penggunaan Lab`
2. Pilih link jadwal (opsional) untuk auto-fill
3. Isi jumlah mahasiswa
4. Isi daftar hadir (1 baris per mahasiswa), format:
   - `NIM - Nama`
   - atau `Nama`
5. Simpan
6. Buka detail riwayat penggunaan

Expected result:

- Riwayat penggunaan tersimpan
- Jika attendance diisi, jumlah baris harus sama dengan `Jumlah Mhs`
- Detail menampilkan daftar hadir (nama + NIM jika ada)

## Skenario 9 - Dashboard Monitoring

Langkah:

1. Login admin
2. Buka `/dashboard`
3. Cocokkan data dengan aktivitas yang sudah dilakukan pada skenario sebelumnya

Checklist expected result:

- KPI alat tersedia/dipinjam berubah setelah handover/return
- Overdue alert muncul jika ada transaksi lewat due date (opsional skenario tambahan)
- Ringkasan per lab tampil
- Alat sering dipakai terisi (setelah ada handover)
- Rekap kerusakan terisi jika return kondisi `damaged/maintenance`
- Ringkasan penggunaan bahan terisi dari ledger
- Aktivitas penggunaan ruang menampilkan usage log terbaru

## Skenario 10 - Akses & Pembatasan Khusus PLP

Tujuan: memastikan PLP dibatasi oleh lab assignment.

Langkah:

1. Login `plp.suryani`
2. Cek data yang tampil di:
   - `/dashboard/borrowing`
   - `/dashboard/consumables`
   - `/dashboard/lab-usage`
3. Coba proses transaksi atau ubah data pada lab yang bukan assignment PLP (jika ada data)

Expected result:

- PLP hanya melihat/memproses data lab assignment
- Aksi pada lab non-assignment ditolak server-side

## Checklist Penutupan UAT (Go/No-Go)

Centang sebelum go-live:

- [ ] Login + force change password berjalan untuk semua role
- [ ] Redirect RBAC mahasiswa sesuai desain
- [ ] Master alat CRUD baseline + QR print + histori event berjalan
- [ ] Peminjaman end-to-end (create -> 2 approval -> handover -> partial return -> complete) berjalan
- [ ] Bukti cetak peminjaman bisa dibuka dan diprint
- [ ] Permintaan bahan + fulfill + stok ledger berjalan
- [ ] Stok masuk bahan tercatat di ledger
- [ ] Jadwal lab + usage log + absensi manual berjalan
- [ ] Dashboard menampilkan agregasi dari data real
- [ ] Tidak ada error fatal di console/server log selama UAT utama

## Catatan Operasional UAT

- Jika data test sudah terlalu kotor, jalankan ulang:

```bash
pnpm db:seed
```

- Setelah re-seed:
  - password akun seed kembali ke `password`
  - wajib ganti password lagi saat login pertama

- Sebelum go-live production:
  - rotate `AUTH_SECRET` (terutama jika pernah terekspos)
  - pastikan password default seed tidak dipakai di akun aktif

