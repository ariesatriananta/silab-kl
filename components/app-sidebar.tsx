"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Wrench,
  ArrowLeftRight,
  FlaskConical,
  CalendarDays,
  GraduationCap,
  KeyRound,
  UserCircle2,
  Users,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
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

const accountNavItems: Array<{
  title: string
  href: string
  icon: typeof LayoutDashboard
  roles: Role[]
}> = [
  { title: "My Profile", href: "/dashboard/account/profile", icon: UserCircle2, roles: ["admin", "petugas_plp", "mahasiswa"] },
  { title: "Ganti Password", href: "/dashboard/account/security", icon: KeyRound, roles: ["admin", "petugas_plp", "mahasiswa"] },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const role = (session?.user?.role as Role | undefined) ?? "mahasiswa"
  const visibleMainNav = mainNavItems.filter((item) => item.roles.includes(role))
  const visibleStudentNav = studentNavItems.filter((item) => item.roles.includes(role))
  const visibleAccountNav = accountNavItems.filter((item) => item.roles.includes(role))
  const operasionalNav = visibleMainNav.filter((item) =>
    ["/dashboard/borrowing", "/dashboard/consumables", "/dashboard/lab-usage"].includes(item.href),
  )
  const masterNav = visibleMainNav.filter((item) => ["/dashboard/tools", "/dashboard/users"].includes(item.href))
  const monitoringNav = visibleMainNav.filter((item) => item.href === "/dashboard")

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">S</span>
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold text-sm text-sidebar-foreground">SILAB-KL</span>
            <span className="text-xs text-sidebar-foreground/60">Poltekkes Kemenkes Sby</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {operasionalNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operasional</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {operasionalNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Master Data</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {masterNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {monitoringNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Mahasiswa</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleStudentNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.href}
                        tooltip={item.title}
                      >
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
        {visibleAccountNav.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Akun</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleAccountNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
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
    </Sidebar>
  )
}
