"use client"

import { useActionState, useEffect, useRef } from "react"
import { signOut } from "next-auth/react"
import { KeyRound, Lock, ShieldAlert, ShieldCheck } from "lucide-react"

import {
  changeOwnPasswordAction,
  type ChangePasswordActionResult,
} from "@/app/dashboard/account/security/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export function AccountSecurityClient({
  mustChangePassword,
  displayName,
}: {
  mustChangePassword: boolean
  displayName: string
}) {
  const [state, action, pending] = useActionState(
    changeOwnPasswordAction,
    null as ChangePasswordActionResult | null,
  )
  const { toast } = useToast()
  const seenToastKeys = useRef<string[]>([])

  useEffect(() => {
    if (!state) return
    const key = `${state.ok}:${state.message}`
    if (seenToastKeys.current.includes(key)) return
    seenToastKeys.current.push(key)
    toast({
      title: "Keamanan Akun",
      description: state.message,
      variant: state.ok ? "default" : "destructive",
    })

    if (state.ok) {
      const timer = setTimeout(() => {
        signOut({ callbackUrl: "/" })
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [state, toast])

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Ganti Password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Perbarui password akun untuk menjaga keamanan akses ke SILAB-KL. Setelah berhasil, Anda akan logout otomatis untuk login ulang.
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary"
          >
            <ShieldCheck className="mr-1 size-3.5" />
            Keamanan Akun
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4.5" />
              Panduan Keamanan
            </CardTitle>
            <CardDescription>Tips singkat agar password akun tetap aman.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rekomendasi</p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                <li>Gunakan minimal 8 karakter</li>
                <li>Kombinasikan huruf dan angka</li>
                <li>Jangan gunakan password default</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catatan</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Setelah password diganti, sesi saat ini akan diakhiri dan Anda perlu login ulang dengan password baru.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5" />
              Form Ganti Password
            </CardTitle>
            <CardDescription>
              Ubah password untuk akun <span className="font-medium text-foreground">{displayName}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {mustChangePassword && (
              <Alert className="border-warning/20 bg-warning/5">
                <ShieldAlert className="size-4 text-warning-foreground" />
                <AlertTitle>Wajib Ganti Password</AlertTitle>
                <AlertDescription>
                  Akun `{displayName}` masih menggunakan password default. Anda harus mengganti password sebelum melanjutkan penggunaan aplikasi.
                </AlertDescription>
              </Alert>
            )}

            {state && (
              <div
                className={`rounded-xl border px-3 py-2.5 text-sm ${
                  state.ok
                    ? "border-success/20 bg-success/5 text-success-foreground"
                    : "border-destructive/20 bg-destructive/5 text-destructive"
                }`}
              >
                {state.message}
              </div>
            )}

            <form action={action} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Password Saat Ini</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    className="h-11 pl-9"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">Password Baru</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      className="h-11 pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      className="h-11 pl-9"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Simpan password baru</p>
                  <p className="text-xs text-muted-foreground">
                    Setelah berhasil, sistem akan logout otomatis untuk login ulang.
                  </p>
                </div>
                <Button type="submit" disabled={pending} className="sm:min-w-36">
                  {pending ? "Menyimpan..." : "Ubah Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
