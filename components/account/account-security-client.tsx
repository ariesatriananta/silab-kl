"use client"

import { useActionState, useEffect, useRef } from "react"
import { signOut } from "next-auth/react"
import { KeyRound, ShieldAlert } from "lucide-react"

import {
  changeOwnPasswordAction,
  type ChangePasswordActionResult,
} from "@/app/dashboard/account/security/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            Keamanan Akun
          </CardTitle>
          <CardDescription>Ganti password akun Anda untuk menjaga keamanan akses SILAB-KL.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {mustChangePassword && (
            <Alert>
              <ShieldAlert className="size-4" />
              <AlertTitle>Wajib Ganti Password</AlertTitle>
              <AlertDescription>
                Akun `{displayName}` masih menggunakan password default. Anda harus mengganti password sebelum melanjutkan penggunaan aplikasi.
              </AlertDescription>
            </Alert>
          )}

          <form action={action} className="grid gap-4">
            {state && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  state.ok
                    ? "border-success/20 bg-success/5 text-success-foreground"
                    : "border-destructive/20 bg-destructive/5 text-destructive"
                }`}
              >
                {state.message}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">Password Saat Ini</Label>
              <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Password Baru</Label>
              <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan..." : "Ubah Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
