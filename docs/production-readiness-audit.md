# Audit Readiness Production (Final Baseline)

Tanggal audit: 25 Februari 2026

## Ringkasan Status

- Status umum: **Hampir siap production (pilot/UAT sangat siap)**
- Fitur inti bisnis: **sudah terpenuhi** untuk modul utama
- Sumber data: **DB (Neon + Drizzle)** untuk modul aktif
- Auth/RBAC: **sudah ada** (NextAuth Credentials + role + proteksi route)
- Kesenjangan utama tersisa: **hardening operasional & testing otomatis**

## Konfirmasi Data Source

- `lib/mock-data.ts` masih ada di repo sebagai sisa file lama.
- Tidak ditemukan referensi aktif ke `mock-data` pada runtime:
  - scope pengecekan: `app/`, `components/`, `lib/` (kecuali file `lib/mock-data.ts` itu sendiri).

## Kesesuaian Spek Modul (Ringkas)

- Master Data Alat: **hampir penuh**
  - CRUD alat/model+unit ✅
  - kondisi/status ✅
  - QR otomatis + cetak ✅
  - histori kondisi/maintenance ✅
  - foto alat: URL (upload file belum)
- Manajemen Peminjaman Alat: **terpenuhi**
  - multi-item alat+bahan ✅
  - field akademik (mata kuliah, materi, semester, kelompok, dosen opsional) ✅
  - approval 2 level ✅
  - handover + due date ✅
  - partial return alat ✅
  - cetak bukti peminjaman ✅
- Listing & Akses Mahasiswa: **hampir penuh**
  - listing realtime + filter + status ✅
  - pengajuan langsung dari listing ✅
  - scan QR cek status ❌ (ditunda sesuai keputusan scope)
- Manajemen Bahan Habis Pakai: **terpenuhi**
  - master bahan ✅
  - stok masuk ✅
  - permintaan/approval/pemenuhan ✅
  - pengurangan stok otomatis ✅
  - histori pergerakan stok (ledger) ✅
- Manajemen Penggunaan Ruang Lab: **terpenuhi**
  - jadwal/booking manual ✅
  - riwayat penggunaan ✅
  - absensi manual per sesi ✅
- Dashboard Monitoring: **terpenuhi**
  - KPI alat/status/overdue ✅
  - monitoring per lab ✅
  - alat sering dipakai ✅
  - rekap kerusakan ✅
  - ringkasan penggunaan bahan ✅
  - aktivitas penggunaan ruang ✅
- Manajemen User & Hak Akses: **terpenuhi sesuai keputusan final**
  - `admin`, `petugas_plp`, `mahasiswa` ✅

## Kekuatan Saat Ini

- Alur bisnis inti sudah berjalan end-to-end:
  - pengajuan → approval 2 level → handover → partial return → selesai
- Validasi bisnis penting sudah server-side
- Drizzle migration sudah aktif dan konsisten
- Password sudah `bcrypt`
- Ada force change password untuk password default
- Ada login rate limit baseline
- Build/lint/typecheck berjalan

## Blocker / Risiko Sebelum Go-Live Skala Penuh

### 1. Testing otomatis belum ada

- Belum ada integration test / e2e untuk flow kritikal.
- Risiko:
  - regresi pada approval, handover, pengurangan stok, return, RBAC tidak terdeteksi cepat.

Rekomendasi minimum:
- Tambah smoke/integration test untuk:
  - approval 2 level (2 user berbeda)
  - handover (stok bahan berkurang)
  - partial return alat (status tx + status asset)
  - RBAC `petugas_plp` per lab

### 2. Rate limit login masih in-memory (per instance)

- Sudah ada rate limit, tetapi bukan distributed store.
- Risiko di Vercel multi-instance:
  - limit tidak konsisten antar instance.

Rekomendasi:
- Pindah ke Redis/Upstash untuk login rate limit.

### 3. Audit log aksi sensitif belum ada

- Scope awal memang menunda audit log.
- Risiko:
  - sulit investigasi insiden operasional/keamanan.

Rekomendasi minimum:
- catat `login gagal berulang`, `ganti password`, `approve/reject`, `handover`, `edit stok`, `stok masuk`.

### 4. QR image generator baru di UI tools (belum service reusable)

- Sudah ada QR cetak nyata di halaman alat.
- Risiko kecil (maintainability), bukan blocker.

Rekomendasi:
- ekstrak helper QR reusable jika nanti dipakai di modul lain/print server.

## Nice-to-Have (Bukan Blocker)

- Upload file foto alat (storage)
- QR scanner cek status alat mahasiswa (kalau scope dibuka lagi)
- Layout cetak bukti peminjaman versi template institusi yang lebih presisi (logo resmi, nomor form)
- Dashboard filter rentang waktu dan filter per lab
- Reset password oleh admin

## Checklist Go-Live (Praktis)

- [ ] Ganti `AUTH_SECRET` final production
- [ ] Gunakan `DATABASE_URL` production terpisah
- [ ] Seed akun awal + paksa ganti password
- [ ] Jalankan migration di environment production
- [ ] UAT role-based (`admin`, `petugas_plp`, `mahasiswa`)
- [ ] UAT flow peminjaman lengkap (alat + bahan)
- [ ] UAT stok masuk & ledger bahan
- [ ] UAT jadwal/penggunaan ruang + absensi
- [ ] Tambah backup/restore SOP DB
- [ ] Tambah error monitoring/logging

## Kesimpulan

Sistem saat ini **sudah layak untuk pilot/UAT dan sangat dekat ke production penuh**. Untuk go-live yang lebih aman dan tahan operasional, prioritas selanjutnya adalah:

1. testing otomatis flow kritikal
2. distributed login rate limit
3. audit log minimal aksi sensitif

