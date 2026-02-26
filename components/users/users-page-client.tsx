"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownAZ, ArrowUpAZ, Eye, KeyRound, Plus, ShieldCheck, UserCog, Users } from "lucide-react"

import {
  createUserManagementAction,
  resetUserPasswordAction,
  updateUserManagementAction,
  type UserManagementActionResult,
} from "@/app/dashboard/users/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

export type UserLabOption = { id: string; name: string }
export type UserManagementRow = {
  id: string
  username: string
  fullName: string
  role: "admin" | "mahasiswa" | "petugas_plp"
  email: string | null
  nip: string | null
  nim: string | null
  isActive: boolean
  createdAt: string
  assignedLabIds: string[]
  assignedLabNames: string[]
}

export type UserAuditRow = {
  id: string
  createdAt: string
  category: string
  action: string
  outcome: "success" | "failure" | "blocked"
  actorLabel: string
  identifier: string | null
  targetType: string | null
  targetId: string | null
  metadataSummary: string | null
}

const roleLabel: Record<UserManagementRow["role"], string> = {
  admin: "Admin",
  mahasiswa: "Mahasiswa",
  petugas_plp: "Petugas PLP",
}

const roleBadgeClass: Record<UserManagementRow["role"], string> = {
  admin: "rounded-full border-primary/20 bg-primary/10 text-primary",
  mahasiswa: "rounded-full border-border/50 bg-muted/40 text-muted-foreground",
  petugas_plp: "rounded-full border-success/20 bg-success/10 text-success-foreground",
}

function UserFormFields({
  mode,
  labs,
  role,
  setRole,
  assignmentLabIds,
  setAssignmentLabIds,
  active,
  setActive,
  defaultValues,
}: {
  mode: "create" | "edit"
  labs: UserLabOption[]
  role: UserManagementRow["role"]
  setRole: (role: UserManagementRow["role"]) => void
  assignmentLabIds: string[]
  setAssignmentLabIds: (ids: string[]) => void
  active: boolean
  setActive: (value: boolean) => void
  defaultValues?: Partial<UserManagementRow>
}) {
  const toggleLab = (labId: string, checked: boolean) => {
    setAssignmentLabIds(
      checked ? Array.from(new Set([...assignmentLabIds, labId])) : assignmentLabIds.filter((id) => id !== labId),
    )
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-username`}>Username</Label>
          <Input id={`${mode}-username`} name="username" defaultValue={defaultValues?.username ?? ""} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-fullName`}>Nama Lengkap</Label>
          <Input id={`${mode}-fullName`} name="fullName" defaultValue={defaultValues?.fullName ?? ""} required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as UserManagementRow["role"])}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="petugas_plp">Petugas PLP</SelectItem>
              <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="role" value={role} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-email`}>Email (opsional)</Label>
          <Input id={`${mode}-email`} name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-nip`}>NIP (opsional)</Label>
          <Input id={`${mode}-nip`} name="nip" defaultValue={defaultValues?.nip ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-nim`}>NIM {role === "mahasiswa" ? "(wajib)" : "(khusus mahasiswa)"}</Label>
          <Input id={`${mode}-nim`} name="nim" defaultValue={defaultValues?.nim ?? ""} />
        </div>
      </div>

      {mode === "create" && (
        <div className="grid gap-2">
          <Label htmlFor="create-password">Password Awal</Label>
          <Input id="create-password" name="password" type="password" placeholder='Kosongkan untuk default "password"' />
          <p className="text-xs text-muted-foreground">
            Jika diisi `password`, user akan dipaksa ganti password saat login pertama.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-foreground">User Aktif</p>
          <p className="text-xs text-muted-foreground">User nonaktif tidak bisa login ke sistem.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <input type="hidden" name="isActive" value={String(active)} />
        </div>
      </div>

      {role === "petugas_plp" && (
        <div className="grid gap-2">
          <Label>Assignment Laboratorium (minimal 1)</Label>
          <div className="grid gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 sm:grid-cols-2">
            {labs.map((lab) => {
              const checked = assignmentLabIds.includes(lab.id)
              return (
                <label key={lab.id} className="flex items-start gap-2 rounded-md border border-border/30 bg-background/70 px-3 py-2 text-sm">
                  <Checkbox checked={checked} onCheckedChange={(value) => toggleLab(lab.id, value === true)} />
                  <span className="leading-tight text-foreground">{lab.name}</span>
                </label>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Assignment ini dipakai untuk membatasi akses operasional Petugas PLP ke lab tertentu.
          </p>
        </div>
      )}

      <input type="hidden" name="assignmentLabIds" value={JSON.stringify(assignmentLabIds)} />
    </>
  )
}

export function UsersPageClient({
  rows,
  labs,
  auditRows,
}: {
  rows: UserManagementRow[]
  labs: UserLabOption[]
  auditRows: UserAuditRow[]
}) {
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users")
  const [roleFilter, setRoleFilter] = useState<"all" | UserManagementRow["role"]>("all")
  const [sortBy, setSortBy] = useState<"name" | "username" | "createdAt">("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserManagementRow | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<UserManagementRow | null>(null)
  const [selectedAudit, setSelectedAudit] = useState<UserAuditRow | null>(null)
  const [auditSearch, setAuditSearch] = useState("")
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState<"all" | UserAuditRow["outcome"]>("all")
  const [auditActionFilter, setAuditActionFilter] = useState<"all" | "create_user" | "update_user" | "reset_user_password">("all")

  const [createRole, setCreateRole] = useState<UserManagementRow["role"]>("mahasiswa")
  const [createAssignments, setCreateAssignments] = useState<string[]>([])
  const [createActive, setCreateActive] = useState(true)

  const [editRole, setEditRole] = useState<UserManagementRow["role"]>("mahasiswa")
  const [editAssignments, setEditAssignments] = useState<string[]>([])
  const [editActive, setEditActive] = useState(true)
  const [resetPasswordValue, setResetPasswordValue] = useState("password")

  const [createState, createAction, createPending] = useActionState(
    createUserManagementAction,
    null as UserManagementActionResult | null,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateUserManagementAction,
    null as UserManagementActionResult | null,
  )
  const [resetState, resetAction, resetPending] = useActionState(
    resetUserPasswordAction,
    null as UserManagementActionResult | null,
  )

  const { toast } = useToast()
  const shown = useRef<string[]>([])

  useEffect(() => {
    const states = [
      createState ? { key: `create:${createState.ok}:${createState.message}`, title: "Kelola User", ...createState } : null,
      updateState ? { key: `update:${updateState.ok}:${updateState.message}`, title: "Kelola User", ...updateState } : null,
      resetState ? { key: `reset:${resetState.ok}:${resetState.message}`, title: "Reset Password", ...resetState } : null,
    ].filter(Boolean) as Array<{ key: string; title: string; ok: boolean; message: string }>
    for (const s of states) {
      if (shown.current.includes(s.key)) continue
      shown.current.push(s.key)
      toast({ title: s.title, description: s.message, variant: s.ok ? "default" : "destructive" })
    }
  }, [createState, resetState, toast, updateState])

  useEffect(() => {
    if (createState?.ok) {
      queueMicrotask(() => {
        setCreateOpen(false)
        setCreateRole("mahasiswa")
        setCreateAssignments([])
        setCreateActive(true)
      })
    }
  }, [createState])

  useEffect(() => {
    if (updateState?.ok) {
      queueMicrotask(() => setSelectedUser(null))
    }
  }, [updateState])

  useEffect(() => {
    if (resetState?.ok) {
      queueMicrotask(() => {
        setResetPasswordUser(null)
        setResetPasswordValue("password")
      })
    }
  }, [resetState])

  const openEditDialog = (row: UserManagementRow) => {
    setEditRole(row.role)
    setEditAssignments(row.assignedLabIds)
    setEditActive(row.isActive)
    setSelectedUser(row)
  }

  const filtered = useMemo(() => {
    const base = rows.filter((row) => {
      const roleMatch = roleFilter === "all" || row.role === roleFilter
      const s = search.trim().toLowerCase()
      const searchMatch =
        !s ||
        row.fullName.toLowerCase().includes(s) ||
        row.username.toLowerCase().includes(s) ||
        (row.nim ?? "").toLowerCase().includes(s) ||
        (row.nip ?? "").toLowerCase().includes(s)
      return roleMatch && searchMatch
    })
    const sorted = [...base].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1
      if (sortBy === "name") return a.fullName.localeCompare(b.fullName, "id") * direction
      if (sortBy === "username") return a.username.localeCompare(b.username, "id") * direction
      return a.createdAt.localeCompare(b.createdAt, "id") * direction
    })
    return sorted
  }, [roleFilter, rows, search, sortBy, sortDirection])
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.isActive).length,
    plp: rows.filter((r) => r.role === "petugas_plp").length,
    mahasiswa: rows.filter((r) => r.role === "mahasiswa").length,
  }

  const filteredAuditRows = useMemo(() => {
    const q = auditSearch.trim().toLowerCase()
    return auditRows.filter((row) => {
      const outcomeMatch = auditOutcomeFilter === "all" || row.outcome === auditOutcomeFilter
      const actionMatch = auditActionFilter === "all" || row.action === auditActionFilter
      const textMatch =
        !q ||
        row.actorLabel.toLowerCase().includes(q) ||
        row.action.toLowerCase().includes(q) ||
        (row.identifier ?? "").toLowerCase().includes(q) ||
        (row.targetType ?? "").toLowerCase().includes(q)
      return outcomeMatch && actionMatch && textMatch
    })
  }, [auditActionFilter, auditOutcomeFilter, auditRows, auditSearch])

  const auditOutcomeBadgeClass: Record<UserAuditRow["outcome"], string> = {
    success: "rounded-full border-success/20 bg-success/10 text-success-foreground",
    failure: "rounded-full border-destructive/20 bg-destructive/10 text-destructive",
    blocked: "rounded-full border-warning/20 bg-warning/10 text-warning-foreground",
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Kelola User</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola akun admin, petugas PLP, dan mahasiswa termasuk assignment laboratorium untuk petugas PLP.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Tambah User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Tambah User</DialogTitle>
                <DialogDescription>Buat akun baru dan atur role serta assignment lab jika diperlukan.</DialogDescription>
              </DialogHeader>
              <form action={createAction} className="grid gap-4">
                {createState && (
                  <div className={`rounded-lg border px-3 py-2 text-sm ${createState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                    {createState.message}
                  </div>
                )}
                <UserFormFields
                  mode="create"
                  labs={labs}
                  role={createRole}
                  setRole={(nextRole) => {
                    setCreateRole(nextRole)
                    if (nextRole !== "petugas_plp") setCreateAssignments([])
                  }}
                  assignmentLabIds={createAssignments}
                  setAssignmentLabIds={setCreateAssignments}
                  active={createActive}
                  setActive={setCreateActive}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createPending}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createPending}>
                    {createPending ? "Menyimpan..." : "Simpan User"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-border/50 bg-card shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total User</p><p className="mt-1 text-lg font-semibold">{summary.total}</p></CardContent></Card>
        <Card className="border-border/50 bg-card shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">User Aktif</p><p className="mt-1 text-lg font-semibold">{summary.active}</p></CardContent></Card>
        <Card className="border-border/50 bg-card shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Petugas PLP</p><p className="mt-1 text-lg font-semibold">{summary.plp}</p></CardContent></Card>
        <Card className="border-border/50 bg-card shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Mahasiswa</p><p className="mt-1 text-lg font-semibold">{summary.mahasiswa}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "users" | "audit")} className="flex flex-col gap-4">
        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/50 p-1 sm:w-auto">
          <TabsTrigger value="users" className="rounded-lg">Daftar User</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg">Audit User</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-0 space-y-4">
          <Card className="border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Filter & Urutan User</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Cari nama, username, NIM, atau NIP..."
                  className="sm:max-w-md"
                />
                <Select
                  value={roleFilter}
                  onValueChange={(v) => {
                    setRoleFilter(v as typeof roleFilter)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Filter role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Role</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="petugas_plp">Petugas PLP</SelectItem>
                    <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sortBy}
                  onValueChange={(v) => {
                    setSortBy(v as typeof sortBy)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nama</SelectItem>
                    <SelectItem value="username">Username</SelectItem>
                    <SelectItem value="createdAt">Tanggal Dibuat</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
                    setPage(1)
                  }}
                >
                  {sortDirection === "asc" ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}
                  {sortDirection === "asc" ? "A-Z / Lama-Baru" : "Z-A / Baru-Lama"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Gunakan halaman ini untuk mengatur akses user dan assignment lab Petugas PLP. Assignment dipakai oleh semua modul operasional.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Daftar User ({filtered.length}) {filtered.length > pageSize ? `- Halaman ${currentPage}/${totalPages}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
          <div className="px-6 pb-2 text-xs text-muted-foreground">
            Geser tabel ke samping pada layar kecil untuk melihat seluruh kolom.
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nama</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>NIM/NIP</TableHead>
                  <TableHead>Assignment Lab</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6">
                      <Empty className="border border-border/50 bg-muted/20 py-8">
                        <EmptyHeader>
                          <EmptyMedia variant="icon"><Users className="size-5" /></EmptyMedia>
                          <EmptyTitle className="text-base">User tidak ditemukan</EmptyTitle>
                          <EmptyDescription>Ubah filter pencarian atau tambahkan user baru.</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button size="sm" onClick={() => setCreateOpen(true)}>
                            <Plus className="size-4" />
                            Tambah User
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
                {pagedRows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{row.fullName}</p>
                        <p className="text-xs text-muted-foreground">{row.email ?? "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleBadgeClass[row.role]}>
                        {roleLabel[row.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.nim ?? row.nip ?? "-"}</TableCell>
                    <TableCell>
                      {row.role === "petugas_plp" ? (
                        row.assignedLabNames.length > 0 ? (
                          <div className="flex max-w-[240px] flex-wrap gap-1">
                            {row.assignedLabNames.map((lab) => (
                              <Badge key={`${row.id}-${lab}`} variant="secondary" className="text-xs">
                                {lab}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-destructive">Belum di-assign</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.isActive
                            ? "rounded-full border-success/20 bg-success/10 text-success-foreground"
                            : "rounded-full border-border/50 bg-muted/40 text-muted-foreground"
                        }
                      >
                        {row.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.createdAt}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openEditDialog(row)} aria-label="Kelola user">
                          <UserCog className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setResetPasswordUser(row)} aria-label="Reset password">
                          <KeyRound className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
              <div className="flex flex-col gap-3 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} user
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Sebelumnya
                  </Button>
                  <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                    Hal. {currentPage}/{totalPages}
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Berikutnya
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-0">
          <Card className="border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Filter Audit User</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Cari aktor, aksi, identifier, atau target..."
                  className="sm:max-w-md"
                />
                <Select value={auditActionFilter} onValueChange={(v) => setAuditActionFilter(v as typeof auditActionFilter)}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Filter aksi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Aksi</SelectItem>
                    <SelectItem value="create_user">Create User</SelectItem>
                    <SelectItem value="update_user">Update User</SelectItem>
                    <SelectItem value="reset_user_password">Reset Password</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={auditOutcomeFilter} onValueChange={(v) => setAuditOutcomeFilter(v as typeof auditOutcomeFilter)}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Hasil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Hasil</SelectItem>
                    <SelectItem value="success">Sukses</SelectItem>
                    <SelectItem value="failure">Gagal</SelectItem>
                    <SelectItem value="blocked">Diblokir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Gunakan filter ini untuk menelusuri perubahan akun, role, assignment lab, dan reset password.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Riwayat Audit User ({filteredAuditRows.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="px-6 pb-2 text-xs text-muted-foreground">
                Menampilkan log perubahan user, reset password, dan aksi manajemen user terbaru.
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Waktu</TableHead>
                      <TableHead>Aktor</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead>Hasil</TableHead>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="text-right">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuditRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6">
                          <Empty className="border border-border/50 bg-muted/20 py-8">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <ShieldCheck className="size-5" />
                              </EmptyMedia>
                              <EmptyTitle className="text-base">Belum ada audit user</EmptyTitle>
                              <EmptyDescription>
                                Riwayat akan muncul setelah ada aksi pembuatan, perubahan, atau reset password user.
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredAuditRows.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground">{log.createdAt}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-sm text-foreground">{log.actorLabel}</TableCell>
                        <TableCell>
                          <div className="max-w-[260px]">
                            <p className="text-sm text-foreground">{log.action}</p>
                            <p className="truncate text-xs text-muted-foreground">{log.category}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={auditOutcomeBadgeClass[log.outcome]}>
                            {log.outcome === "success" ? "Sukses" : log.outcome === "failure" ? "Gagal" : "Diblokir"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{log.identifier ?? "-"}</TableCell>
                        <TableCell className="max-w-[220px]">
                          <p className="truncate text-xs text-muted-foreground">{log.targetType ?? "-"}</p>
                          <p className="truncate text-xs text-muted-foreground">{log.targetId ?? "-"}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedAudit(log)}>
                              <Eye className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Kelola User</DialogTitle>
            <DialogDescription>
              {selectedUser ? `${selectedUser.fullName} (${selectedUser.username})` : "Ubah profil, role, dan assignment user."}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <form key={selectedUser.id} action={updateAction} className="grid gap-4">
              {updateState && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${updateState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                  {updateState.message}
                </div>
              )}
              <input type="hidden" name="userId" value={selectedUser.id} />
              <UserFormFields
                mode="edit"
                labs={labs}
                role={editRole}
                setRole={(nextRole) => {
                  setEditRole(nextRole)
                  if (nextRole !== "petugas_plp") setEditAssignments([])
                }}
                assignmentLabIds={editAssignments}
                setAssignmentLabIds={setEditAssignments}
                active={editActive}
                setActive={setEditActive}
                defaultValues={selectedUser}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelectedUser(null)} disabled={updatePending}>
                  Tutup
                </Button>
                <Button type="submit" disabled={updatePending}>
                  {updatePending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password User</DialogTitle>
            <DialogDescription>
              {resetPasswordUser
                ? `Atur password baru untuk ${resetPasswordUser.fullName} (${resetPasswordUser.username}).`
                : "Reset password user"}
            </DialogDescription>
          </DialogHeader>
          {resetPasswordUser && (
            <form action={resetAction} className="grid gap-3">
              {resetState && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${resetState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                  {resetState.message}
                </div>
              )}
              <input type="hidden" name="userId" value={resetPasswordUser.id} />
              <div className="grid gap-2">
                <Label htmlFor="resetPasswordValue">Password Baru</Label>
                <Input
                  id="resetPasswordValue"
                  name="newPassword"
                  type="password"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Gunakan `password` untuk memaksa user ganti password saat login pertama berikutnya.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setResetPasswordUser(null)} disabled={resetPending}>
                  Batal
                </Button>
                <Button type="submit" disabled={resetPending}>
                  {resetPending ? "Memproses..." : "Reset Password"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAudit} onOpenChange={(open) => !open && setSelectedAudit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Audit User</DialogTitle>
            <DialogDescription>
              {selectedAudit ? `${selectedAudit.action} - ${selectedAudit.createdAt}` : "Detail audit"}
            </DialogDescription>
          </DialogHeader>
          {selectedAudit && (
            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-muted-foreground">Waktu</p><p className="text-foreground">{selectedAudit.createdAt}</p></div>
                <div>
                  <p className="text-muted-foreground">Hasil</p>
                  <Badge variant="outline" className={auditOutcomeBadgeClass[selectedAudit.outcome]}>
                    {selectedAudit.outcome === "success" ? "Sukses" : selectedAudit.outcome === "failure" ? "Gagal" : "Diblokir"}
                  </Badge>
                </div>
                <div><p className="text-muted-foreground">Aktor</p><p className="text-foreground">{selectedAudit.actorLabel}</p></div>
                <div><p className="text-muted-foreground">Aksi</p><p className="font-mono text-xs text-foreground">{selectedAudit.action}</p></div>
                <div><p className="text-muted-foreground">Identifier</p><p className="font-mono text-xs text-foreground">{selectedAudit.identifier ?? "-"}</p></div>
                <div><p className="text-muted-foreground">Target</p><p className="font-mono text-xs text-foreground">{selectedAudit.targetType ?? "-"} / {selectedAudit.targetId ?? "-"}</p></div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Metadata (JSON)</p>
                <pre className="max-h-72 overflow-auto rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {selectedAudit.metadataSummary
                    ? (() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedAudit.metadataSummary), null, 2)
                        } catch {
                          return selectedAudit.metadataSummary
                        }
                      })()
                    : "Tidak ada metadata tambahan."}
                </pre>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedAudit(null)}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
