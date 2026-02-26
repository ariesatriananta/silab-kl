"use client"

import { useActionState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Mail, ShieldCheck, UserCircle2 } from "lucide-react"

import {
  updateOwnProfileAction,
  type UpdateOwnProfileActionResult,
} from "@/app/dashboard/account/profile/actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export function AccountProfileClient({
  initialFullName,
  initialEmail,
  username,
  roleLabel,
}: {
  initialFullName: string
  initialEmail: string
  username: string
  roleLabel: string
}) {
  const [state, action, pending] = useActionState(
    updateOwnProfileAction,
    null as UpdateOwnProfileActionResult | null,
  )
  const { toast } = useToast()
  const seenToastKeys = useRef<string[]>([])
  const { update } = useSession()

  useEffect(() => {
    if (!state) return
    const key = `${state.ok}:${state.message}`
    if (seenToastKeys.current.includes(key)) return
    seenToastKeys.current.push(key)

    toast({
      title: "My Profile",
      description: state.message,
      variant: state.ok ? "default" : "destructive",
    })

    if (state.ok && state.data) {
      void update({
        name: state.data.fullName,
        email: state.data.email ?? undefined,
      })
    }
  }, [state, toast, update])

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">My Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola informasi profil yang ditampilkan di aplikasi. Perubahan nama dan email akan langsung dipakai di header akun.
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit rounded-full border-success/20 bg-success/10 px-3 py-1 text-success-foreground"
          >
            <ShieldCheck className="mr-1 size-3.5" />
            Akun Aktif
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle2 className="size-4.5" />
              Ringkasan Akun
            </CardTitle>
            <CardDescription>Informasi identitas akun yang digunakan untuk login dan hak akses.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Username</p>
              <p className="mt-1 font-mono text-sm text-foreground">{username}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</p>
              <p className="mt-1 text-sm font-medium text-foreground">{roleLabel}</p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email Saat Ini</p>
              <p className="mt-1 text-sm text-foreground">{initialEmail || "-"}</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <p className="font-medium text-foreground">Catatan</p>
              <p className="mt-1 text-muted-foreground">
                Untuk mengubah password akun, gunakan menu <span className="font-medium text-foreground">Ganti Password</span>.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle2 className="size-5" />
              Edit Profil
            </CardTitle>
            <CardDescription>
              Perbarui nama lengkap dan email agar informasi akun tetap akurat dan mudah dikenali petugas lain.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
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
                <Label htmlFor="fullName" className="text-sm">Nama Lengkap</Label>
                <div className="relative">
                  <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    name="fullName"
                    defaultValue={initialFullName}
                    className="h-11 pl-9"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Nama ini akan tampil di header akun dan beberapa bagian informasi transaksi.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm">Email (opsional)</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={initialEmail}
                    placeholder="nama@contoh.ac.id"
                    className="h-11 pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email dipakai sebagai informasi kontak akun. Boleh dikosongkan jika belum digunakan.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Simpan perubahan profil</p>
                  <p className="text-xs text-muted-foreground">
                    Perubahan akan langsung diterapkan pada tampilan akun Anda.
                  </p>
                </div>
                <Button type="submit" disabled={pending} className="sm:min-w-36">
                  {pending ? "Menyimpan..." : "Simpan Profil"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
