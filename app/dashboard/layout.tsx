"use client"

import { Sparkles } from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { usePathname } from "next/navigation"
import { HeaderUserMenu } from "@/components/header-user-menu"
import { ThemeToggle } from "@/components/theme-toggle"

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Ringkasan operasional harian laboratorium",
  },
  "/dashboard/tools": {
    title: "Alat Laboratorium",
    subtitle: "Master alat, unit, status, dan QR identifikasi",
  },
  "/dashboard/borrowing": {
    title: "Peminjaman",
    subtitle: "Pengajuan, approval, serah terima, dan pengembalian",
  },
  "/dashboard/consumables": {
    title: "Bahan Habis Pakai",
    subtitle: "Stok, permintaan bahan, dan histori pergerakan",
  },
  "/dashboard/lab-usage": {
    title: "Penggunaan Laboratorium",
    subtitle: "Jadwal, riwayat sesi, dan absensi penggunaan",
  },
  "/dashboard/student-tools": {
    title: "Katalog Alat Mahasiswa",
    subtitle: "Cari alat dan ajukan peminjaman dari katalog",
  },
  "/dashboard/users": {
    title: "Kelola User",
    subtitle: "Akses akun, role, dan assignment laboratorium",
  },
  "/dashboard/account/profile": {
    title: "Profil Saya",
    subtitle: "Perbarui informasi akun Anda",
  },
  "/dashboard/account/security": {
    title: "Ganti Password",
    subtitle: "Kelola keamanan akun Anda",
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const meta = pageMeta[pathname] ?? pageMeta["/dashboard"]

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-gradient-to-b from-muted/15 to-background">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:px-6">
          <SidebarTrigger className="-ml-1 rounded-lg border border-border/60 bg-background shadow-sm hover:bg-muted/40" />
          <Separator orientation="vertical" className="h-7" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-foreground">{meta.title}</h1>
              <span className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground md:inline-flex">
                <Sparkles className="size-3" />
                SILAB-KL
              </span>
            </div>
            <p className="hidden truncate text-xs text-muted-foreground lg:block">{meta.subtitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <HeaderUserMenu />
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
