# SILAB-KL - Spesifikasi Modul dan Fitur (Handover User)

## 1) Tujuan Dokumen

Dokumen ini menjadi acuan handover aplikasi SILAB-KL ke user operasional.  
Isi dokumen mencakup:

- Cakupan modul yang tersedia
- Hak akses per role
- Fitur detail per modul
- Aturan bisnis inti
- Alur operasional utama
- Batasan implementasi saat ini

Dokumen ini merefleksikan implementasi aplikasi saat ini pada branch kerja aktif.

---

## 2) Ringkasan Aplikasi

SILAB-KL adalah sistem informasi laboratorium untuk Jurusan Kesehatan Lingkungan, dengan fokus:

- Master data alat dan unit aset
- Peminjaman alat + bahan habis pakai dalam satu transaksi
- Approval berjenjang
- Serah terima dan pengembalian alat (termasuk partial return)
- Manajemen bahan habis pakai (master, stok masuk, histori pergerakan)
- Jadwal dan histori penggunaan laboratorium
- Monitoring operasional berbasis dashboard

---

## 3) Role Pengguna dan Hak Akses

## 3.1 Role Aktif

- `admin`
- `petugas_plp`
- `dosen`
- `mahasiswa`

## 3.2 Prinsip Akses Umum

- `admin`: akses penuh lintas lab.
- `petugas_plp`: akses operasional sesuai assignment lab.
- `dosen`: akses monitoring/dashboard dan approval tahap dosen pada peminjaman.
- `mahasiswa`: akses katalog alat, jadwal lab read-only, dan pengajuan/pelacakan peminjaman milik sendiri.

## 3.3 Akses Menu per Role (Ringkas)

- Admin:
  - Dashboard
  - Peminjaman
  - Bahan Habis Pakai
  - Penggunaan Lab
  - Alat Laboratorium
  - Approval Matrix
  - Kelola User
  - My Profile + Ganti Password
- Petugas PLP:
  - Dashboard
  - Peminjaman
  - Bahan Habis Pakai
  - Penggunaan Lab
  - Alat Laboratorium
  - My Profile + Ganti Password
- Dosen:
  - Dashboard
  - Peminjaman (sebagai approver tahap dosen)
  - My Profile + Ganti Password
- Mahasiswa:
  - Katalog Alat
  - Jadwal Lab (read-only)
  - Peminjaman (pengajuan & tracking transaksi sendiri)
  - My Profile + Ganti Password

---

## 4) Modul dan Fitur

## 4.1 Modul Dashboard Monitoring (`/dashboard`)

### Tujuan

Memberikan ringkasan operasional harian laboratorium.

### Fitur Utama

- KPI alat:
  - Alat tersedia
  - Alat dipinjam
  - Keterlambatan
  - Rusak/perbaikan
- Fokus hari ini (prioritas operasional)
- Aktivitas terbaru (serah terima/pengembalian)
- Overdue alert
- Ringkasan per lab
- Alat paling sering dipakai
- Rekap kerusakan/maintenance
- Ringkasan penggunaan bahan
- Aktivitas penggunaan ruang lab

### Catatan

- Data berasal dari DB real-time (bukan mock).
- Scope data mengikuti role + assignment lab.

---

## 4.2 Modul Alat Laboratorium (`/dashboard/tools`)

### Tujuan

Mengelola master alat dan unit aset fisik.

### Fitur Utama

- Master model alat:
  - CRUD model (nama, kode model, kategori, merk, lab, lokasi, deskripsi, foto bila tersedia)
- Unit aset:
  - Tambah unit per model
  - Edit status/kondisi unit
  - Kode aset per unit
- Status/kondisi unit:
  - Status umum: tersedia, dipinjam, maintenance, rusak
  - Kondisi: baik, maintenance, damaged
- QR code:
  - Cetak QR per unit aset
  - Scanner QR belum diaktifkan
- Listing dan filter:
  - Filter berdasarkan lab/kategori/status
  - Detail alat/unit dalam dialog
- Histori kondisi:
  - Event histori perubahan kondisi/maintenance per unit

### Catatan

- Arsitektur data menggunakan model 2 level: `tool_model` dan `tool_asset`.

---

## 4.3 Modul Peminjaman (`/dashboard/borrowing`)

### Tujuan

Mengelola siklus end-to-end peminjaman alat dan bahan.

### Fitur Utama

- Pembuatan pengajuan:
  - Satu transaksi untuk satu lab
  - Bisa multi-item alat + bahan habis pakai
  - Form akademik:
    - Keperluan
    - Mata kuliah
    - Materi
    - Semester
    - Kelompok
    - Dosen
- Approval 2 tahap:
  - Tahap 1: Dosen
  - Tahap 2: Petugas PLP
  - Mapping approver per lab via Approval Matrix
- Tindakan operasional di dialog detail:
  - Setuju/Tolak
  - Serah terima (handover)
  - Pengembalian (multi pilih alat, partial return)
- Status transaksi:
  - Menunggu approval
  - Menunggu serah terima
  - Aktif
  - Kembali sebagian
  - Dikembalikan
  - Ditolak
  - Dibatalkan
  - Overdue (derived)
- Filter dan pagination daftar transaksi
- Cetak bukti:
  - Dari dialog detail
  - Shortcut icon print dari tabel list
- Notifikasi:
  - Badge notifikasi di header
  - Klik item notifikasi dapat mark read (sesuai perilaku yang diset)

### Aturan Bisnis Inti

- Approval wajib 2 tahap berurutan.
- Handover tidak boleh parsial.
- Pengembalian alat boleh parsial.
- Bahan habis pakai dianggap habis (tidak ada return bahan).
- Pengurangan stok bahan terjadi saat handover.
- Admin fallback approval tersedia sesuai aturan implementasi (dengan alasan saat override diperlukan).
- Anti bentrok jadwal tidak berlaku di modul ini (hanya modul penggunaan lab).

### Catatan Operasional

- Tombol approve/reject dipusatkan di tab Tindakan pada dialog detail.
- Aksi di tabel sudah diringkas agar tidak duplikatif.

---

## 4.4 Modul Approval Matrix (`/dashboard/approval-matrix`)

### Tujuan

Menentukan approver transaksi peminjaman per laboratorium.

### Fitur Utama

- Satu baris matrix per lab
- Konfigurasi:
  - Approver-1 (Dosen)
  - Approver-2 (Petugas PLP)
  - Status aktif/nonaktif matrix
- Validasi:
  - Approver harus sesuai assignment lab
  - Struktur 2 tahap tetap
- UI:
  - Dialog atur matrix
  - Label jelas `Approver-1` dan `Approver-2`

### Dampak ke Peminjaman

- Matrix menentukan route approval saat pengajuan dibuat.
- Dosen terpilih pada form pengajuan dapat mempengaruhi tahap 1 sesuai desain implementasi aktif.

---

## 4.5 Modul Bahan Habis Pakai (`/dashboard/consumables`)

### Tujuan

Mengelola master bahan, stok, dan histori pergerakan.

### Fitur Utama

- Master bahan:
  - Tambah/edit data bahan
  - Kode, nama, kategori, satuan, stok awal, stok minimum, lab
- Stok masuk langsung:
  - Penerimaan stok tanpa perlu workflow permintaan terpisah
- Histori pergerakan stok:
  - Source pergerakan (stok masuk, pemakaian, koreksi, dll sesuai implementasi)
  - Filter source, lab, dan pencarian
- Monitoring stok:
  - KPI ringkas (termasuk total stok)
  - Peringatan stok rendah
- Tab aktif + tab history
- Filter:
  - Pencarian nama/kategori
  - Filter lab
  - Debounce pada input pencarian

### Catatan

- Workflow permintaan bahan terpisah sudah dinonaktifkan dari UI agar tidak bentrok dengan alur peminjaman yang sudah menggabungkan kebutuhan bahan.

---

## 4.6 Modul Penggunaan Lab (`/dashboard/lab-usage`)

### Tujuan

Mengelola jadwal penggunaan lab dan pencatatan histori penggunaan aktual.

### Fitur Utama

- Jadwal lab:
  - Tambah/edit/hapus jadwal
  - Data: lab, tanggal, mata kuliah/kegiatan, kelompok, dosen pengampu, jam mulai/selesai, kapasitas, peserta terdaftar
  - UI card jadwal modern dan konsisten
- Validasi bentrok jadwal:
  - Tidak boleh overlap waktu pada lab yang sama
  - Berlaku pada create dan update
- Riwayat penggunaan:
  - Catat sesi aktual (post event)
  - Bisa link ke jadwal (opsional)
  - Simpan jumlah mahasiswa, catatan, dan daftar hadir
- Daftar hadir:
  - Input manual multiline (nama/NIM)
  - Validasi jumlah baris vs jumlah mahasiswa
- Jam operasional:
  - Pilihan menit dibatasi `00, 15, 30, 45` pada form jadwal dan catat penggunaan
- Riwayat tab:
  - Tabel + pagination
  - Dialog detail riwayat

### Catatan

- Khusus role mahasiswa tidak mengakses modul ini secara operasional.

---

## 4.7 Modul Katalog Alat Mahasiswa (`/dashboard/student-tools`)

### Tujuan

Menyediakan visibilitas alat untuk mahasiswa sekaligus entry point pengajuan.

### Fitur Utama

- Listing model alat realtime
- Filter kategori + pencarian
- Informasi ketersediaan unit
- Aksi `Pinjam Sekarang` ke alur pengajuan
- KPI ringkas jumlah model/unit tersedia

---

## 4.8 Modul Jadwal Lab Mahasiswa (`/dashboard/student-lab-schedule`)

### Tujuan

Menyediakan informasi ketersediaan ruang dan jadwal lab dalam mode read-only.

### Fitur Utama

- Card jadwal modern
- Filter lab + pencarian
- Badge status sesi:
  - Sedang berlangsung
  - Akan datang
  - Selesai
- Ringkasan slot:
  - Tersedia
  - Penuh
- Penanda `Hari Ini`

---

## 4.9 Modul Kelola User (`/dashboard/users`)

### Tujuan

Mengelola akun pengguna, role, dan assignment lab.

### Fitur Utama

- CRUD user:
  - Admin, Petugas PLP, Dosen, Mahasiswa
- Assignment lab:
  - Khusus role yang membutuhkan scope lab (PLP/Dosen)
- Reset password user (oleh admin)
- Audit trail manajemen user (sesuai implementasi halaman)
- KPI ringkas user

### Catatan

- Password memakai hashing bcrypt.

---

## 4.10 Modul Profil & Keamanan Akun

### Halaman

- `/dashboard/account/profile`
- `/dashboard/account/security`

### Fitur

- Update profil sendiri (nama lengkap, email)
- Ganti password sendiri
- Menu akses dari dropdown avatar header

---

## 5) Alur Bisnis Inti (End-to-End)

## 5.1 Alur Peminjaman

1. Pengguna membuat pengajuan (mahasiswa / admin / petugas sesuai akses).
2. Sistem menetapkan rute approver dari matrix lab.
3. Approver tahap 1 (Dosen) melakukan approve/reject.
4. Setelah tahap 1 approve, masuk tahap 2 (Petugas PLP).
5. Setelah tahap 2 approve, status menjadi menunggu serah terima.
6. Petugas/Admin melakukan handover penuh:
   - transaksi aktif
   - stok bahan berkurang
   - aset alat jadi borrowed
7. Pengembalian alat diproses (bisa bertahap/multi pilih):
   - update kondisi alat
   - status menjadi kembali sebagian / dikembalikan.

## 5.2 Alur Penggunaan Lab

1. Buat jadwal lab (planning).
2. Sistem validasi tidak ada bentrok jadwal.
3. Setelah sesi berjalan, catat riwayat penggunaan.
4. Isi absensi mahasiswa bila diperlukan.
5. Histori dapat ditinjau pada tab Riwayat.

## 5.3 Alur Bahan Habis Pakai

1. Tambah master bahan.
2. Input stok masuk langsung (tanpa permintaan terpisah).
3. Penggunaan bahan dari transaksi peminjaman tercatat saat handover.
4. Monitoring stok aktif dan histori pergerakan dilakukan via tab dan filter.

---

## 6) Status dan Terminologi Utama

## 6.1 Status Transaksi Peminjaman

- Menunggu approval
- Menunggu serah terima
- Aktif
- Kembali sebagian
- Dikembalikan
- Ditolak
- Dibatalkan
- Overdue (derived)

## 6.2 Istilah Role Operasional

- `petugas_plp` = petugas laboratorium operasional
- `dosen` = approver akademik tahap 1

---

## 7) Catatan UX dan Interaksi

- Sidebar + header sudah konsisten dengan dropdown akun di header.
- Dark/Light mode tersedia.
- Notification bell tersedia pada header.
- Dialog penting sudah dibuat scrollable untuk layar kecil.
- Tab di dalam dialog/modul sudah diseragamkan style aktifnya.
- Skeleton loading dan spinner transisi menu sudah diterapkan.

---

## 8) Batasan Implementasi Saat Ini

- Scanner QR belum diaktifkan (cetak QR saja).
- Tidak ada denda/sanksi otomatis keterlambatan.
- Belum ada integrasi SSO/sistem akademik eksternal.
- Migrasi data lama tidak termasuk scope dokumen ini.
- Beberapa rule lanjut (misal fallback cuti approver otomatis berbasis kalender) belum mencakup sistem HR eksternal.

---

## 9) Rekomendasi Operasional Go-Live

- Pastikan assignment lab untuk PLP dan Dosen sudah lengkap sebelum dipakai.
- Pastikan matrix approval aktif untuk setiap lab operasional.
- Lakukan seed akun awal + reset password awal user.
- Jalankan UAT lintas role:
  - admin
  - petugas_plp
  - dosen
  - mahasiswa
- Monitor error log aplikasi pada minggu pertama go-live.

---

## 10) Referensi Dokumen Terkait

- `docs/mvp-spec.md`
- `docs/erd-and-status-flow.md`
- `docs/manual-e2e-uat-guide.md`
- `docs/production-readiness-audit.md`

