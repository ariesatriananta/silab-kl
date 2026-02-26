# UX Audit Page-by-Page (v2)

Dokumen ini merangkum status UX/UI seluruh halaman utama SILAB-KL setelah beberapa batch polish.
Tujuan: menandai mana yang sudah modern/elegan, mana yang masih parsial, dan prioritas polish berikutnya.

## Skala Status
- `Polished`: hierarchy visual, empty state, CTA, dan flow utama sudah rapi/modern.
- `Parsial`: sudah membaik, tapi masih ada area default/padat/kurang konsisten.
- `Perlu Polish`: masih terasa default/kuno atau belum cukup guiding.

## Ringkasan Cepat
- `Polished`: login, dashboard, borrowing, consumables, lab usage, tools, users, profile, security, student tools, print proof/QR preview.
- `Parsial`: dashboard shell header/sidebar, beberapa dialog sekunder lintas modul, beberapa modal konfirmasi/destruktif.
- `Perlu Polish`: tidak ada halaman utama yang sepenuhnya tertinggal, tapi masih ada komponen kecil/sekunder yang belum konsisten.

## Audit Per Halaman

### 1. `/` Login
- Status: `Polished`
- Sudah:
  - layout 2 panel (desktop), mobile tetap sederhana
  - visual modern (gradient + grid subtle)
  - hierarchy form jelas
- Sisa:
  - optional animasi halus / branding motion (nice-to-have)

### 2. `/dashboard`
- Status: `Polished`
- Sudah:
  - hero + fokus harian
  - kartu statistik lebih refined
  - analytics cards lebih konsisten
  - list activity/lab/overdue lebih modern
- Sisa:
  - optional collapse/expand untuk section analytics panjang di layar kecil

### 3. `/dashboard/borrowing`
- Status: `Polished` (operasional inti)
- Sudah:
  - task-oriented panel “Butuh Tindakan”
  - detail transaksi pakai tab (Ringkasan/Riwayat/Tindakan)
  - UX mahasiswa disederhanakan
  - empty states + status badge konsisten
  - responsive table helper + min-width
- Sisa:
  - beberapa dialog aksi masih bisa dipoles visual level micro (minor)
  - advanced search/filter chips (nice-to-have)

### 4. `/dashboard/consumables`
- Status: `Polished`
- Sudah:
  - CTA hierarchy
  - panel prioritas/Butuh Tindakan
  - tab jelas (stok/request/histori)
  - quick filter request
  - histori stok human-readable + responsive pass
- Sisa:
  - dialog proses request/fulfill masih bisa dipoles micro-layout (minor)

### 5. `/dashboard/lab-usage`
- Status: `Polished`
- Sudah:
  - CTA primer/sekunder jelas
  - tab jadwal/riwayat lebih guiding
  - empty states + helper text
  - riwayat table responsive pass
- Sisa:
  - dialog edit jadwal/detail history bisa dipoles visual minor

### 6. `/dashboard/tools` (Master Alat)
- Status: `Polished` (naik signifikan)
- Sudah:
  - hero + KPI compact
  - filter helper + table helper
  - dialog detail alat (histori dipisah dari edit)
  - dialog edit unit lebih modern
  - QR preview dialog lebih rapi
  - responsive pass + empty state proper
- Sisa:
  - beberapa dialog konfirmasi kecil masih “utility-first” (minor)

### 7. `/dashboard/users` (Kelola User)
- Status: `Polished`
- Sudah:
  - hero + helper operasional
  - tab daftar/audit lebih jelas
  - dialog create/edit/reset lebih rapi
  - audit filter + detail metadata
  - pagination/sorting
  - responsive table pass + microcopy audit lebih konsisten
- Sisa:
  - badge/label role/status bisa disempurnakan lagi (minor consistency)

### 8. `/dashboard/student-tools`
- Status: `Polished`
- Sudah:
  - panel langkah cepat + info status
  - microcopy edukatif untuk mahasiswa
  - katalog cards lebih ringan
  - empty state instruktif
- Sisa:
  - image/thumbnail alat masih placeholder (tergantung data/foto real)

### 9. `/dashboard/account/profile`
- Status: `Polished`
- Sudah:
  - hero section + ringkasan akun
  - form modern 2 kolom layout (desktop)
  - hierarchy dan CTA jelas
- Sisa:
  - none (minor polish only)

### 10. `/dashboard/account/security`
- Status: `Polished`
- Sudah:
  - hero + tips keamanan
  - layout 2 kolom
  - alert wajib ganti password tetap jelas
- Sisa:
  - none (minor polish only)

### 11. `/borrowing-proof/[id]`
- Status: `Polished` (preview layar) + `usable` untuk print
- Sudah:
  - toolbar non-print lebih modern
  - kontainer dokumen lebih rapi saat preview
  - section titles lebih jelas
- Sisa:
  - fine-tuning print typography/spacing agar lebih mirip form fisik (opsional)

## Audit Shell / Navigasi (Bukan Halaman Konten)

### `app/dashboard/layout.tsx` (header shell)
- Status: `Parsial`
- Sudah:
  - title + header user dropdown di kanan atas
- Masih bisa dipoles:
  - header lebih premium (height/spacing/background layering)
  - breadcrumb ringan (optional)
  - mobile/tablet spacing refinement

### `components/app-sidebar.tsx`
- Status: `Parsial` (informasi sudah bagus, visual bisa naik level)
- Sudah:
  - tree menu task-oriented (`Operasional`, `Master Data`, `Monitoring`, `Akun`)
  - role-aware nav
- Masih bisa dipoles:
  - active state lebih tegas/elegan
  - visual group spacing/label hierarchy
  - branding sidebar lebih refined

### `components/header-user-menu.tsx`
- Status: `Polished`
- Sudah:
  - avatar+fullname dropdown
  - profile card mini + role chip
  - menu akun konsisten

## Temuan Lintas Halaman (Cross-Cutting)

### Sudah membaik
- banyak empty state sudah proper
- dropdown `SelectTrigger` sudah konsisten `w-full` pada form-grid
- helper “geser tabel” sudah hadir di banyak tabel operasional
- status badge mulai konsisten

### Masih perlu batch lanjutan
1. Dialog sekunder/destruktif lintas modul
- beberapa modal konfirmasi masih utilitarian (fungsi bagus, visual belum premium)

2. Dashboard shell consistency
- header + sidebar masih belum setingkat polish halaman konten

3. Microcopy consistency lintas modul (lanjutan)
- masih ada beberapa istilah campuran teknis/non-teknis di label kecil, placeholder, dan deskripsi dialog

4. Responsive fine-tuning (bukan blocker)
- beberapa tabel sudah aman dengan `min-w`, tapi perlu cek UX gesture/hint di device nyata (tablet/HP landscape)

## Prioritas UX Batch Berikutnya (Disarankan)

### Prioritas 1 (impact tinggi)
1. `Dashboard shell` polish
   - `app/dashboard/layout.tsx`
   - `components/app-sidebar.tsx`

2. `Dialog consistency pass`
   - konfirmasi hapus/nonaktif/proses di semua modul
   - target: spacing, helper text, CTA hierarchy, destructive affordance

### Prioritas 2
3. `Microcopy consistency pass v2`
   - samakan semua istilah aksi/status lintas modul
   - audit placeholder dan helper text

4. `Responsive real-device pass`
   - fokus admin/PLP flow di laptop kecil / tablet

## Catatan
- Status `Polished` di dokumen ini berarti “sudah layak modern/elegan untuk UAT/pilot”, bukan “tidak bisa ditingkatkan lagi”.
- Fokus berikutnya sebaiknya berpindah dari halaman konten besar ke shell/dialog/microcopy agar konsistensi benar-benar terasa.


## Dark Mode Pass (Tambahan Audit)

### Status Umum
- `Aktif`: toggle dark/light sudah berjalan dari header (sebelah kiri avatar).
- `Token-based`: mayoritas halaman sudah mengikuti token global (`background/card/muted/border/sidebar`), sehingga dark mode menyebar konsisten.
- `Polish v1`: palet dark sudah disetel ulang agar lebih nyaman di mata (kontras cukup, tidak terlalu hitam pekat, sidebar lebih terbaca).

### Hasil Audit Cepat Per Halaman (Dark Mode)
- `/dashboard`: `Baik`
  - kartu statistik/analytics tetap terbaca
  - panel fokus harian dan komponen dashboard ikut theme token dengan baik
- `/dashboard/borrowing`: `Baik`
  - badge status dan panel helper tetap jelas
  - dialog panjang tetap terbaca
- `/dashboard/consumables`: `Baik`
  - tab, panel helper, tabel, dan dialog proses/detail konsisten
- `/dashboard/lab-usage`: `Baik`
  - card jadwal/riwayat dan dialog tetap nyaman
- `/dashboard/tools`: `Baik`
  - dialog detail/edit unit dan QR preview tetap readable
- `/dashboard/users`: `Baik`
  - tab daftar/audit dan dialog create/edit/reset/detail audit konsisten
- `/dashboard/student-tools`: `Baik`
  - katalog dan helper panel tetap jelas
- `/dashboard/account/profile` dan `/dashboard/account/security`: `Baik`
  - layout 2 kolom dan card tips/ringkasan tetap nyaman
- `/borrowing-proof/[id]`: `Cukup`
  - preview layar tetap usable, tapi target utama tetap layout print

### Temuan / Notes (Dark Mode)
- Mayoritas UI sudah token-based, sehingga dark mode stabil setelah token `.dark` ditambahkan.
- Area paling sensitif untuk fine-tuning lanjutan: badge status, panel warning/destructive, dan border halus pada card bertumpuk.

### Prioritas Fine-Tuning Dark Mode (Opsional)
1. Tuning kontras badge status (warning/success) bila terasa terlalu soft/terlalu tajam.
2. Tuning sidebar dark mode berdasarkan penggunaan nyata (durasi pakai lama).
3. Review halaman print preview (opsional, prioritas rendah).
