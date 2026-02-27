"use client"

import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { ChevronDown, KeyRound, LogOut, Shield, UserCircle2 } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function HeaderUserMenu() {
  const { data: session } = useSession()

  const displayName = session?.user?.name ?? "Pengguna"
  const displayEmail = session?.user?.email ?? session?.user?.username ?? "-"
  const role = session?.user?.role ?? "mahasiswa"
  const roleLabel =
    role === "admin"
      ? "Admin"
      : role === "petugas_plp"
        ? "Petugas PLP"
        : role === "dosen"
          ? "Dosen"
          : "Mahasiswa"
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-full border border-border/60 bg-background/90 px-2 pr-3 shadow-sm transition hover:bg-muted/40"
        >
          <Avatar className="size-7 ring-1 ring-border/60">
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-col items-start sm:flex">
            <span className="max-w-[170px] truncate text-sm font-medium text-foreground">{displayName}</span>
            <span className="text-[11px] text-muted-foreground">{roleLabel}</span>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-xl border-border/60 p-2 shadow-lg">
        <DropdownMenuLabel className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
          <div className="flex items-start gap-3">
            <Avatar className="size-9 ring-1 ring-border/60">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{displayEmail}</p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-border/50 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                <Shield className="size-3" />
                {roleLabel}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account/profile">
            <UserCircle2 className="size-4" />
            Profil Saya
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account/security">
            <KeyRound className="size-4" />
            Ganti Password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="rounded-lg"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="size-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
