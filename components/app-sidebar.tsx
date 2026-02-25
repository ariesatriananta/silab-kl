"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  LayoutDashboard,
  Wrench,
  ArrowLeftRight,
  FlaskConical,
  CalendarDays,
  GraduationCap,
  KeyRound,
  LogOut,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

type Role = "admin" | "mahasiswa" | "petugas_plp"

const mainNavItems: Array<{
  title: string
  href: string
  icon: typeof LayoutDashboard
  roles: Role[]
}> = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "petugas_plp"] },
  { title: "Alat Laboratorium", href: "/dashboard/tools", icon: Wrench, roles: ["admin", "petugas_plp"] },
  { title: "Peminjaman", href: "/dashboard/borrowing", icon: ArrowLeftRight, roles: ["admin", "petugas_plp"] },
  { title: "Bahan Habis Pakai", href: "/dashboard/consumables", icon: FlaskConical, roles: ["admin", "petugas_plp"] },
  { title: "Penggunaan Lab", href: "/dashboard/lab-usage", icon: CalendarDays, roles: ["admin", "petugas_plp"] },
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
  icon: typeof KeyRound
  roles: Role[]
}> = [{ title: "Keamanan Akun", href: "/dashboard/account/security", icon: KeyRound, roles: ["admin", "petugas_plp", "mahasiswa"] }]

export function AppSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const role = (session?.user?.role as Role | undefined) ?? "mahasiswa"
  const visibleMainNav = mainNavItems.filter((item) => item.roles.includes(role))
  const visibleStudentNav = studentNavItems.filter((item) => item.roles.includes(role))
  const visibleAccountNav = accountNavItems.filter((item) => item.roles.includes(role))
  const displayName = session?.user?.name ?? "Pengguna"
  const displayEmail = session?.user?.email ?? session?.user?.username ?? "-"
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "U"
  const roleLabel =
    role === "admin" ? "Admin" : role === "petugas_plp" ? "Petugas PLP" : "Mahasiswa"

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
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item) => (
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
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Profil Pengguna" size="lg">
              <Avatar className="size-6">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-xs font-medium">{displayName}</span>
                <span className="text-xs text-sidebar-foreground/60">{roleLabel}</span>
                <span className="text-xs text-sidebar-foreground/60 truncate">{displayEmail}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Keluar">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-1.5"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="size-4" />
                <span>Keluar</span>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
