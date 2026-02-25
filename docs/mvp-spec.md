# SILAB-KL MVP Spec (Production Baseline)

## Tujuan

Dokumen ini mengunci aturan bisnis MVP untuk migrasi dari UI mock (`lib/mock-data.ts`) ke implementasi production berbasis `Neon Postgres + Drizzle + Next.js`.

## Scope MVP (Wajib Go-Live)

- Dashboard
- Alat laboratorium
- Peminjaman (alat + bahan habis pakai dalam satu transaksi)
- Bahan habis pakai
- Penggunaan laboratorium (jadwal + riwayat)
- Katalog alat mahasiswa

## Role Pengguna

- `admin`: full akses semua modul
- `mahasiswa`: lihat katalog/listing + buat pengajuan peminjaman
- `petugas_plp`: monitoring dan pengelolaan lab yang di-assignment; dapat approve transaksi untuk lab assignment-nya

## Aturan Login

- Login dengan `username / NIP / NIM + password`
- Akun mahasiswa dibuat oleh admin di aplikasi (bukan SSO eksternal)

## Aturan Otorisasi (Ringkas)

- `admin`
  - CRUD master data
  - approve peminjaman
  - handover
  - proses return
  - kelola jadwal
- `petugas_plp`
  - akses data lab assignment
  - approve transaksi pada lab assignment
  - handover/return pada lab assignment
  - kelola jadwal lab assignment
- `mahasiswa`
  - lihat katalog alat
  - buat pengajuan peminjaman
  - lihat status pengajuan/peminjaman sendiri
  - batalkan pengajuan sebelum approval level 1

## Aturan Peminjaman (Inti)

### Ruang Lingkup Transaksi

- Satu transaksi peminjaman hanya untuk **satu lab**
- Satu transaksi dapat berisi:
  - alat (asset/unit)
  - bahan habis pakai

### Approval

- Wajib **2 level approval**
- Wajib oleh **2 user berbeda**
- Urutan approval bebas
- Kombinasi approver bebas:
  - `admin + admin`
  - `petugas_plp + petugas_plp`
  - `admin + petugas_plp`
- `petugas_plp` hanya dapat approve transaksi untuk lab yang di-assignment

### Handover / Serah Terima

- **Tidak boleh partial handover**
- Semua item dalam transaksi harus diserahkan sekaligus
- Saat handover:
  - `borrow_date` efektif diisi (`handed_over_at`)
  - `due_date` ditentukan
  - stok bahan habis pakai dikurangi
  - asset alat berubah status menjadi `borrowed`
- Jika stok bahan tidak cukup saat handover:
  - handover ditolak sementara
  - transaksi tetap dalam status `approved_waiting_handover`
  - admin/PLP dapat revisi item atau batalkan transaksi

### Pengembalian

- **Hanya alat** yang dikembalikan
- Bahan habis pakai dianggap habis (tidak ada proses return bahan)
- **Partial return diperbolehkan**
- Setiap event return harus mencatat:
  - waktu return
  - petugas penerima
  - daftar asset yang dikembalikan
  - kondisi saat kembali (`baik`, `maintenance`, `damaged`)
  - catatan opsional
- Jika alat kembali rusak:
  - item tetap tercatat returned
  - status/kondisi asset diupdate ke `maintenance` atau `damaged`

### Pembatalan oleh Mahasiswa

- Mahasiswa boleh membatalkan pengajuan sendiri hanya jika status masih **sebelum approval level 1**

## Aturan Bahan Habis Pakai

- Stok disimpan sebagai **total stok** (tanpa batch/expired untuk MVP)
- Stok berkurang saat **handover**, bukan saat approval
- Permintaan bahan dapat dikelola admin/PLP

## Aturan Alat & QR

- Model alat menggunakan 2 level:
  - `tool_model` (jenis alat)
  - `tool_asset` (unit fisik)
- QR Code melekat pada **tool asset**
- MVP QR:
  - cetak QR per asset
  - tidak perlu scanner/reader
  - tidak perlu download massal
- Section "Scan QR Code Alat" pada halaman mahasiswa akan dihapus

## Jadwal & Penggunaan Lab

- Jadwal diinput manual
- Pengelola:
  - `admin`
  - `petugas_plp` (sesuai lab assignment)

## Dashboard

- Mengambil agregasi data real dari DB (bukan mock)
- KPI minimum:
  - alat tersedia
  - alat dipinjam
  - keterlambatan
  - rusak/maintenance
- Aktivitas terbaru dan alert keterlambatan dari transaksi nyata

## Out of Scope Sementara

- Audit log lengkap / histori perubahan detail
- Sanksi/denda keterlambatan
- Integrasi SSO / sistem akademik
- QR scanner / check-in check-out via scan
- Batch/expired tracking bahan

## Asumsi Implementasi Awal

- Waktu disimpan UTC, ditampilkan dalam WIB
- Status `overdue` dapat dihitung dari `due_date` + item alat yang belum kembali (derived), tidak wajib disimpan sebagai state permanen
