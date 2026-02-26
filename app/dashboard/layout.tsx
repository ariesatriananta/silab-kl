"use client"

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { usePathname } from "next/navigation"
import { HeaderUserMenu } from "@/components/header-user-menu"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/tools": "Alat Laboratorium",
  "/dashboard/borrowing": "Peminjaman",
  "/dashboard/consumables": "Bahan Habis Pakai",
  "/dashboard/lab-usage": "Penggunaan Laboratorium",
  "/dashboard/student-tools": "Katalog Alat Mahasiswa",
  "/dashboard/users": "Kelola User",
  "/dashboard/account/profile": "My Profile",
  "/dashboard/account/security": "Ganti Password",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const title = pageTitles[pathname] || "Dashboard"

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          <div className="ml-auto">
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
