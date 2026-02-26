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
} from "lucide-react"
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

type Role = "admin" | "mahasiswa" | "petugas_plp"

const mainNavItems: Array<{
  title: string
  href: string
  icon: typeof LayoutDashboard
  roles: Role[]
}> = [
  { title: "Peminjaman", href: "/dashboard/borrowing", icon: ArrowLeftRight, roles: ["admin", "petugas_plp"] },
  { title: "Bahan Habis Pakai", href: "/dashboard/consumables", icon: FlaskConical, roles: ["admin", "petugas_plp"] },
  { title: "Penggunaan Lab", href: "/dashboard/lab-usage", icon: CalendarDays, roles: ["admin", "petugas_plp"] },
  { title: "Alat Laboratorium", href: "/dashboard/tools", icon: Wrench, roles: ["admin", "petugas_plp"] },
  { title: "Kelola User", href: "/dashboard/users", icon: Users, roles: ["admin"] },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "petugas_plp"] },
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

  const role = (session?.user?.role as Role | undefined) ?? "mahasiswa"
  const visibleMainNav = mainNavItems.filter((item) => item.roles.includes(role))
  const visibleStudentNav = studentNavItems.filter((item) => item.roles.includes(role))
  const operasionalNav = visibleMainNav.filter((item) =>
    ["/dashboard/borrowing", "/dashboard/consumables", "/dashboard/lab-usage"].includes(item.href),
  )
  const masterNav = visibleMainNav.filter((item) => ["/dashboard/tools", "/dashboard/users"].includes(item.href))
  const monitoringNav = visibleMainNav.filter((item) => item.href === "/dashboard")

  const menuButtonClassName =
    "rounded-lg border border-transparent px-2.5 py-2 transition-all hover:border-sidebar-border/60 hover:bg-sidebar-accent/45 data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-[0_1px_0_hsl(var(--sidebar-border)),0_8px_18px_hsl(var(--foreground)/0.05)]"

  return (
    <Sidebar collapsible="icon" variant="floating" className="group-data-[collapsible=icon]:p-1.5">
      <SidebarHeader className="p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-xl border border-sidebar-border/50 bg-sidebar-accent/30 px-3 py-3 transition-colors hover:bg-sidebar-accent/45"
        >
          <div className="flex size-9 shrink-0 items-center justify-center">
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
            <span className="truncate text-xs text-sidebar-foreground/70">Poltekkes Kemenkes Surabaya</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="mx-3 w-[calc(100%-1.5rem)] opacity-60" />
      <SidebarContent className="overflow-x-hidden px-2 pb-2">
        {operasionalNav.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
              Operasional
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {operasionalNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title} className={menuButtonClassName}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {masterNav.length > 0 && (
          <>
            <SidebarSeparator className="mx-3 my-1 w-[calc(100%-1.5rem)] opacity-50" />
            <SidebarGroup className="py-1">
              <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
                Master Data
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {masterNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title} className={menuButtonClassName}>
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
        {monitoringNav.length > 0 && (
          <>
            <SidebarSeparator className="mx-3 my-1 w-[calc(100%-1.5rem)] opacity-50" />
            <SidebarGroup className="py-1">
              <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
                Monitoring
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {monitoringNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title} className={menuButtonClassName}>
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
        {visibleStudentNav.length > 0 && (
          <>
            <SidebarSeparator className="mx-3 my-1 w-[calc(100%-1.5rem)] opacity-50" />
            <SidebarGroup className="py-1">
              <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/60">
                Mahasiswa
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleStudentNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title} className={menuButtonClassName}>
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarSeparator className="mx-3 w-[calc(100%-1.5rem)] opacity-50" />
      <SidebarFooter className="overflow-x-hidden p-3 pt-2 group-data-[collapsible=icon]:hidden">
        <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/25 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] leading-snug text-sidebar-foreground/70">
              Sistem Informasi Laboratorium
              <br />
              Jurusan Kesling
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
