"use client"

import { useEffect, useState } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Eye, EyeOff, FlaskConical, LogIn, ShieldCheck, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const router = useRouter()
  const { status } = useSession()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [identifier, setIdentifier] = useState("admin")
  const [password, setPassword] = useState("password")

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard")
    }
  }, [router, status])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const result = await signIn("credentials", {
      redirect: false,
      identifier,
      password,
      callbackUrl: "/dashboard",
    })

    if (result?.error) {
      if (result.error === "TooManyAttempts") {
        setErrorMessage("Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.")
      } else {
        setErrorMessage("Login gagal. Periksa username/NIP/NIM dan password.")
      }
      setIsLoading(false)
      return
    }

    router.push(result?.url ?? "/dashboard")
    router.refresh()
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,hsl(var(--primary)/0.14),transparent_40%),radial-gradient(circle_at_85%_20%,hsl(var(--accent)/0.16),transparent_42%),radial-gradient(circle_at_50%_90%,hsl(var(--primary)/0.08),transparent_45%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl items-center p-4 sm:p-6 lg:p-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden rounded-3xl border border-border/40 bg-gradient-to-br from-card/90 via-card/70 to-muted/30 p-8 shadow-xl backdrop-blur md:flex md:flex-col md:justify-between">
            <div className="space-y-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Sistem Informasi Laboratorium Terintegrasi
              </div>

              <div className="space-y-4">
                <Image
                  src="/logo.png"
                  alt="Logo Poltekkes Kemenkes Surabaya"
                  width={210}
                  height={70}
                  className="h-16 w-auto object-contain"
                  priority
                />
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    SILAB-KL
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Platform operasional laboratorium untuk pengelolaan alat, bahan, peminjaman, dan penggunaan ruang
                    pada Jurusan Kesehatan Lingkungan.
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  {
                    icon: ShieldCheck,
                    title: "Kontrol Akses Berbasis Peran",
                    desc: "Admin, Petugas PLP, dan Mahasiswa dengan alur kerja sesuai kebutuhan masing-masing.",
                  },
                  {
                    icon: FlaskConical,
                    title: "Operasional Lab Terpusat",
                    desc: "Peminjaman, bahan habis pakai, dan penggunaan ruang lab tercatat dalam satu sistem.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border/50 bg-background/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <item.icon className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-border/50 bg-background/75 px-4 py-3 text-xs text-muted-foreground">
              Gunakan akun yang dibuat oleh admin. Password default akan diminta diganti setelah login.
            </div>
          </section>

          <Card className="w-full border-border/50 bg-card/85 shadow-2xl backdrop-blur-sm">
            <CardHeader className="space-y-4 px-6 pb-2 pt-6 sm:px-8 sm:pt-8">
              <div className="flex items-center justify-center md:hidden">
                <Image
                  src="/logo.png"
                  alt="Logo Poltekkes Kemenkes Surabaya"
                  width={180}
                  height={60}
                  className="h-14 w-auto object-contain"
                  priority
                />
              </div>

              <div className="space-y-2 text-center md:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <LogIn className="size-3.5" />
                  Masuk ke SILAB-KL
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">Selamat datang kembali</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Masuk menggunakan username, NIP, atau NIM untuk melanjutkan.
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                {errorMessage && (
                  <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 rounded-2xl border border-border/50 bg-muted/10 p-4 sm:p-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="username" className="text-sm font-medium text-foreground">
                      Username / NIP / NIM
                    </Label>
                    <Input
                      id="username"
                      placeholder="Masukkan username, NIP, atau NIM"
                      className="h-11 bg-background"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Masukkan password"
                        className="h-11 bg-background pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full font-medium shadow-sm"
                  disabled={isLoading || status === "loading"}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Memproses...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="size-4" />
                      Masuk
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 flex flex-col gap-2 text-center md:text-left">
                <p className="text-xs text-muted-foreground">
                  Poltekkes Kemenkes Surabaya &copy; 2026
                </p>
                <p className="text-xs text-muted-foreground/90">
                  SILAB-KL • Sistem Informasi Laboratorium Jurusan Kesehatan Lingkungan
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
