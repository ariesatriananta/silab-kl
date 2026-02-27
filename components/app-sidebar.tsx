"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Wrench,
  ArrowLeftRight,
  FlaskConical,
  CalendarDays,
  GraduationCap,
  Users,
  Network,
  Loader2,
} from "lucide-react"
import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

type Role = "admin" | "mahasiswa" | "petugas_plp" | "dosen"

const mainNavItems: Array<{
  title: string
  href: string
  icon: typeof LayoutDashboard
  roles: Role[]
}> = [
  { title: "Peminjaman", href: "/dashboard/borrowing", icon: ArrowLeftRight, roles: ["admin", "petugas_plp", "dosen"] },
  { title: "Bahan Habis Pakai", href: "/dashboard/consumables", icon: FlaskConical, roles: ["admin", "petugas_plp"] },
  { title: "Penggunaan Lab", href: "/dashboard/lab-usage", icon: CalendarDays, roles: ["admin", "petugas_plp"] },
  { title: "Alat Laboratorium", href: "/dashboard/tools", icon: Wrench, roles: ["admin", "petugas_plp"] },
  { title: "Approval Matrix", href: "/dashboard/approval-matrix", icon: Network, roles: ["admin"] },
  { title: "Kelola User", href: "/dashboard/users", icon: Users, roles: ["admin"] },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "petugas_plp", "dosen"] },
]

const studentNavItems: Array<{
  title: string
  href: string
  icon: typeof GraduationCap
  roles: Role[]
}> = [{ title: "Katalog Alat", href: "/dashboard/student-tools", icon: GraduationCap, roles: ["mahasiswa"] }]

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const role = (session?.user?.role as Role | undefined) ?? "mahasiswa"
  const visibleMainNav = mainNavItems.filter((item) => item.roles.includes(role))
  const visibleStudentNav = studentNavItems.filter((item) => item.roles.includes(role))
  const operasionalNav = visibleMainNav.filter((item) =>
    ["/dashboard/borrowing", "/dashboard/consumables", "/dashboard/lab-usage"].includes(item.href),
  )
  const masterNav = visibleMainNav.filter((item) =>
    ["/dashboard/tools", "/dashboard/approval-matrix", "/dashboard/users"].includes(item.href),
  )
  const monitoringNav = visibleMainNav.filter((item) => item.href === "/dashboard")

  const menuButtonClassName =
    "relative rounded-lg border border-transparent px-2.5 py-2 pr-8 transition-all hover:border-sidebar-border/60 hover:bg-sidebar-accent/45 data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[0_1px_0_hsl(var(--sidebar-border)),0_8px_18px_hsl(var(--foreground)/0.05)] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:pr-0 group-data-[collapsible=icon]:[&>span]:hidden group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:data-[active=true]:border-transparent group-data-[collapsible=icon]:data-[active=true]:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)),0_6px_14px_hsl(var(--foreground)/0.06)]"

  const renderNavLink = (item: { href: string; title: string; icon: typeof LayoutDashboard }) => {
    const isPending = pendingHref === item.href && pathname !== item.href

    return (
      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title} className={menuButtonClassName}>
        <Link
          href={item.href}
          onClick={() => {
            if (pathname !== item.href) setPendingHref(item.href)
          }}
        >
          <item.icon className="size-4" />
          <span>{item.title}</span>
          {isPending && (
            <Loader2 className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-sidebar-foreground/70 group-data-[collapsible=icon]:right-1.5 group-data-[collapsible=icon]:top-1.5 group-data-[collapsible=icon]:size-3 group-data-[collapsible=icon]:translate-y-0" />
          )}
        </Link>
      </SidebarMenuButton>
    )
  }

  return (
    <Sidebar collapsible="icon" variant="floating" className="group-data-[collapsible=icon]:p-1.5">
      <SidebarHeader className="p-3 group-data-[collapsible=icon]:p-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-xl border border-sidebar-border/50 bg-sidebar-accent/30 px-3 py-3 transition-colors hover:bg-sidebar-accent/45 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2"
        >
          <div className="flex size-9 shrink-0 items-start justify-center pt-0.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:pt-0">
            <Image
              src="/icon-logo.png"
              alt="Logo SILAB-KL"
              width={32}
              height={32}
              className="size-8 object-contain drop-shadow-[0_2px_6px_hsl(var(--foreground)/0.14)]"
              priority
            />
          </div>
          <div className="min-w-0 flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold text-sidebar-foreground">SILAB-KL</span>
            <span className="text-xs leading-snug text-sidebar-foreground/70">
              Poltekkes Kemenkes
              <br />
              Surabaya
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <div className="px-3 group-data-[collapsible=icon]:hidden">
        <SidebarSeparator className="opacity-60" />
      </div>
      <SidebarContent className="overflow-x-hidden px-2 pb-2 group-data-[collapsible=icon]:px-0.5">
        {monitoringNav.length > 0 && (
          <SidebarGroup className="py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0.5">
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
              Monitoring
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {monitoringNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    {renderNavLink(item)}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {operasionalNav.length > 0 && (
          <SidebarGroup className="py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0.5">
            {monitoringNav.length > 0 && <SidebarSeparator className="mx-3 my-1 opacity-50 group-data-[collapsible=icon]:hidden" />}
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
              Operasional
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {operasionalNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    {renderNavLink(item)}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {masterNav.length > 0 && (
          <>
            <SidebarSeparator className="mx-3 my-1 opacity-50 group-data-[collapsible=icon]:hidden" />
            <SidebarGroup className="py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0.5">
              <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
                Master Data
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                {masterNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    {renderNavLink(item)}
                  </SidebarMenuItem>
                ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
        {visibleStudentNav.length > 0 && (
          <>
            <SidebarSeparator className="mx-3 my-1 opacity-50 group-data-[collapsible=icon]:hidden" />
            <SidebarGroup className="py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0.5">
              <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
                Mahasiswa
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                {visibleStudentNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    {renderNavLink(item)}
                  </SidebarMenuItem>
                ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarSeparator className="mx-3 opacity-50 group-data-[collapsible=icon]:hidden" />
      <SidebarFooter className="overflow-x-hidden p-3 pt-2 group-data-[collapsible=icon]:hidden">
        <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/25 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] leading-snug text-sidebar-foreground/70">
              Sistem Informasi Laboratorium
              <br />
              Jurusan Kesehatan Lingkungan
            </p>
            <p className="mt-1.5 text-[10px] leading-snug text-sidebar-foreground/60">
              © {new Date().getFullYear()} Poltekkes Kemenkes
              <br />
              Surabaya
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
