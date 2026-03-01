"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FlaskConical,
  Minus,
  Package,
  PackagePlus,
  Plus,
  Printer,
  Search,
  Trash2,
  XCircle,
} from "lucide-react"

import {
  approveBorrowingAction,
  approveBorrowingWithFeedbackAction,
  createBorrowingRequestAction,
  handoverBorrowingAction,
  rejectBorrowingAction,
  rejectBorrowingWithFeedbackAction,
  returnBorrowingToolAction,
  type BorrowingMutationResult,
  type CreateBorrowingActionResult,
} from "@/app/dashboard/borrowing/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useToast } from "@/hooks/use-toast"

type DisplayStatus =
  | "pending"
  | "approved_waiting_handover"
  | "active"
  | "overdue"
  | "partially_returned"
  | "completed"
  | "rejected"
  | "cancelled"

const statusConfig: Record<DisplayStatus, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "rounded-full bg-warning/10 text-warning-foreground border-warning/20" },
  approved_waiting_handover: {
    label: "Menunggu Serah Terima",
    className: "rounded-full bg-primary/10 text-primary border-primary/20",
  },
  active: { label: "Aktif", className: "rounded-full bg-primary/10 text-primary border-primary/20" },
  overdue: { label: "Terlambat", className: "rounded-full bg-destructive/10 text-destructive border-destructive/20" },
  partially_returned: {
    label: "Kembali Sebagian",
    className: "rounded-full bg-primary/10 text-primary border-primary/20",
  },
  completed: {
    label: "Dikembalikan",
    className: "rounded-full bg-success/10 text-success-foreground border-success/20",
  },
  rejected: { label: "Ditolak", className: "rounded-full bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Dibatalkan", className: "rounded-full bg-muted text-muted-foreground border-border" },
}

const approvalTriageConfig: Record<
  "step1_ready" | "step2_ready" | "blocked_matrix" | "unknown",
  { label: string; className: string }
> = {
  step1_ready: {
    label: "Siap Tahap 1",
    className: "rounded-full border-primary/20 bg-primary/10 text-primary",
  },
  step2_ready: {
    label: "Siap Tahap 2",
    className: "rounded-full border-success/20 bg-success/10 text-success-foreground",
  },
  blocked_matrix: {
    label: "Blocked Matrix",
    className: "rounded-full border-destructive/20 bg-destructive/10 text-destructive",
  },
  unknown: {
    label: "Cek Status",
    className: "rounded-full border-border bg-muted text-muted-foreground",
  },
}

const approvalDecisionLabel: Record<"approved" | "rejected", string> = {
  approved: "Disetujui",
  rejected: "Ditolak",
}

const roleLabel: Record<"admin" | "mahasiswa" | "petugas_plp" | "dosen", string> = {
  admin: "Admin",
  mahasiswa: "Mahasiswa",
  petugas_plp: "Petugas PLP",
  dosen: "Dosen",
}

const returnConditionLabel: Record<"baik" | "maintenance" | "damaged", string> = {
  baik: "Baik",
  maintenance: "Perlu Maintenance",
  damaged: "Rusak",
}

function getNextActionHint(input: {
  status: DisplayStatus
  approvalsCount?: number
  pendingReturnTools?: number
}) {
  if (input.status === "pending") {
    return {
      tone: "warning" as const,
      title: "Menunggu Approval",
      description: `Transaksi butuh total 2 approval (saat ini ${input.approvalsCount ?? 0}/2).`,
    }
  }
  if (input.status === "approved_waiting_handover") {
    return {
      tone: "primary" as const,
      title: "Siap Serah Terima",
      description: "Lanjutkan serah terima untuk mengaktifkan transaksi dan mengisi due date.",
    }
  }
  if (input.status === "active" || input.status === "overdue" || input.status === "partially_returned") {
    return {
      tone: input.status === "overdue" ? ("danger" as const) : ("primary" as const),
      title:
        input.status === "partially_returned"
          ? "Masih Ada Alat Belum Kembali"
          : input.status === "overdue"
            ? "Keterlambatan Pengembalian"
            : "Transaksi Aktif",
      description:
        input.pendingReturnTools && input.pendingReturnTools > 0
          ? `${input.pendingReturnTools} alat masih outstanding dan menunggu pengembalian.`
          : "Menunggu proses pengembalian alat.",
    }
  }
  if (input.status === "completed") {
    return {
      tone: "success" as const,
      title: "Transaksi Selesai",
      description: "Semua alat pada transaksi ini sudah dikembalikan.",
    }
  }
  if (input.status === "rejected") {
    return {
      tone: "danger" as const,
      title: "Transaksi Ditolak",
      description: "Tidak ada tindakan lanjutan kecuali membuat pengajuan baru.",
    }
  }
  return {
    tone: "muted" as const,
    title: "Tidak Ada Tindakan",
    description: "Transaksi tidak memerlukan tindakan operasional saat ini.",
  }
}

export type BorrowingListRow = {
  id: string
  code: string
  labId: string
  requesterUserId: string
  createdByUserId: string
  borrower: string
  nim: string | null
  borrowDate: string | null
  dueDate: string | null
  status: DisplayStatus
  purpose: string
  courseName: string
  materialTopic: string
  semesterLabel: string
  groupName: string
  advisorLecturerName: string | null
  itemCount: number
  pendingApprovalLabel: string | null
  pendingApprovalApprovers: string[]
  pendingApprovalTriage: "step1_ready" | "step2_ready" | "blocked_matrix" | "unknown" | null
  pendingRequiredApproverName: string | null
  adminOverrideReasonRequired: boolean
}

export type BorrowingDetail = {
  id: string
  code: string
  borrower: string
  nim: string | null
  status: DisplayStatus
  purpose: string
  courseName: string
  materialTopic: string
  semesterLabel: string
  groupName: string
  advisorLecturerName: string | null
  requestedAt: string
  borrowDate: string | null
  dueDate: string | null
  labName: string
  approvalsCount: number
  pendingApprovalLabel: string | null
  pendingApprovalApprovers: string[]
  pendingApprovalTriage: "step1_ready" | "step2_ready" | "blocked_matrix" | "unknown" | null
  pendingRequiredApproverName: string | null
  adminOverrideReasonRequired: boolean
  items: Array<{
    id: string
    itemType: "tool_asset" | "consumable"
    name: string
    qty: number
    toolAssetId?: string | null
    assetCode?: string | null
    unit?: string | null
    returned?: boolean
  }>
  approvalHistory: Array<{
    approverName: string
    approverRole: "admin" | "mahasiswa" | "petugas_plp" | "dosen"
    decision: "approved" | "rejected"
    decidedAt: string
    note: string | null
  }>
  handoverHistory: Array<{
    handedOverAt: string
    dueDate: string
    handedOverByName: string
    note: string | null
  }>
  returnEvents: Array<{
    returnedAt: string
    receivedByName: string
    note: string | null
    items: Array<{
      transactionItemId: string
      toolName: string
      assetCode: string
      returnCondition: "baik" | "maintenance" | "damaged"
      note: string | null
    }>
  }>
}

export type BorrowingCreateLabOption = { id: string; name: string }
export type BorrowingCreateRequesterOption = { id: string; label: string }
export type BorrowingCreateToolOption = { id: string; label: string; labId: string; modelId: string; modelCode: string }
export type BorrowingCreateConsumableOption = {
  id: string
  label: string
  labId: string
  stockQty: number
  unit: string
}
export type BorrowingCreateApprovalRouteOption = {
  labId: string
  matrixActive: boolean
  matrixValid: boolean
  isReady: boolean
  step1Role: "dosen" | null
  step2Role: "petugas_plp" | null
  dosenApprovers: Array<{ id: string; name: string; identifier: string | null }>
  plpApprovers: Array<{ id: string; name: string; identifier: string | null }>
}

export function BorrowingPageClient({
  role,
  currentUserId,
  accessibleLabIds,
  rows,
  details,
  createOptions,
  pagination,
  initialListFilters,
  prefill,
}: {
  role: "admin" | "mahasiswa" | "petugas_plp" | "dosen"
  currentUserId: string
  accessibleLabIds: string[] | null
  rows: BorrowingListRow[]
  details: Record<string, BorrowingDetail>
  createOptions: {
    labs: BorrowingCreateLabOption[]
    requesters: BorrowingCreateRequesterOption[]
    tools: BorrowingCreateToolOption[]
    consumables: BorrowingCreateConsumableOption[]
    approvalRoutes: BorrowingCreateApprovalRouteOption[]
  }
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }
  initialListFilters: {
    status: DisplayStatus | "all" | "approved_waiting_handover"
    scope: "all" | "mine" | "my_labs" | "waiting_me"
  }
  prefill?: {
    openCreate?: boolean
    labId?: string
    toolModelCode?: string
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pagingPending, startPagingTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<string>(initialListFilters.status)
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine" | "my_labs" | "waiting_me">(initialListFilters.scope)
  const [selectedBorrowingId, setSelectedBorrowingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedLabId, setSelectedLabId] = useState(createOptions.labs[0]?.id ?? "")
  const [selectedRequesterId, setSelectedRequesterId] = useState(
    role === "mahasiswa" ? currentUserId : createOptions.requesters[0]?.id ?? "",
  )
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])
  const [consumableQtyMap, setConsumableQtyMap] = useState<Record<string, number>>({})
  const [toolQuery, setToolQuery] = useState("")
  const [consumableQuery, setConsumableQuery] = useState("")
  const [toolVisibleCount, setToolVisibleCount] = useState(30)
  const [consumableVisibleCount, setConsumableVisibleCount] = useState(30)
  const [courseName, setCourseName] = useState("")
  const [materialTopic, setMaterialTopic] = useState("")
  const [semesterLabel, setSemesterLabel] = useState("")
  const [groupName, setGroupName] = useState("")
  const [approvalNote, setApprovalNote] = useState("")
  const [rejectNote, setRejectNote] = useState("")
  const [handoverNote, setHandoverNote] = useState("")
  const [returnNote, setReturnNote] = useState("")
  const [returnSelectionMap, setReturnSelectionMap] = useState<
    Record<string, "baik" | "maintenance" | "damaged">
  >({})
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    mode: "approve" | "reject"
    source: "list" | "detail"
    transactionId: string | null
  }>({
    open: false,
    mode: "approve",
    source: "list",
    transactionId: null,
  })
  const quickApproveFormRef = useRef<HTMLFormElement>(null)
  const quickRejectFormRef = useRef<HTMLFormElement>(null)
  const detailApproveFormRef = useRef<HTMLFormElement>(null)
  const detailRejectFormRef = useRef<HTMLFormElement>(null)

  const [createState, createAction, createPending] = useActionState(
    createBorrowingRequestAction,
    null as CreateBorrowingActionResult | null,
  )
  const [approveState, approveAction, approvePending] = useActionState(
    approveBorrowingWithFeedbackAction,
    null as BorrowingMutationResult | null,
  )
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectBorrowingWithFeedbackAction,
    null as BorrowingMutationResult | null,
  )
  const [handoverState, handoverAction, handoverPending] = useActionState(
    handoverBorrowingAction,
    null as BorrowingMutationResult | null,
  )
  const [returnState, returnAction, returnPending] = useActionState(
    returnBorrowingToolAction,
    null as BorrowingMutationResult | null,
  )
  const { toast } = useToast()
  const feedbackRef = useRef<string[]>([])

  const canApprove = role === "petugas_plp" || role === "dosen" || role === "admin"
  const canHandover = role === "admin" || role === "petugas_plp"
  const canCreate = role !== "dosen"
  const isMahasiswa = role === "mahasiswa"

  useEffect(() => {
    queueMicrotask(() => {
      setStatusFilter(initialListFilters.status)
      setScopeFilter(initialListFilters.scope)
    })
  }, [initialListFilters.status, initialListFilters.scope])

  const filtered = rows
  const summary = {
    pending: rows.filter((b) => b.status === "pending" || b.status === "approved_waiting_handover").length,
    active: rows.filter((b) => b.status === "active" || b.status === "partially_returned").length,
    overdue: rows.filter((b) => b.status === "overdue").length,
    completed: rows.filter((b) => b.status === "completed").length,
  }
  const actionable = {
    approval: rows.filter((b) => b.status === "pending").length,
    handover: rows.filter((b) => b.status === "approved_waiting_handover").length,
    returning: rows.filter((b) => b.status === "active" || b.status === "partially_returned").length,
    overdue: rows.filter((b) => b.status === "overdue").length,
  }

  const selectedBorrowing = selectedBorrowingId ? details[selectedBorrowingId] : null

  const availableToolsForLab = useMemo(
    () => createOptions.tools.filter((item) => item.labId === selectedLabId),
    [createOptions.tools, selectedLabId],
  )
  const availableConsumablesForLab = useMemo(
    () => createOptions.consumables.filter((item) => item.labId === selectedLabId),
    [createOptions.consumables, selectedLabId],
  )
  const toolById = useMemo(() => new Map(createOptions.tools.map((t) => [t.id, t])), [createOptions.tools])
  const consumableById = useMemo(
    () => new Map(createOptions.consumables.map((c) => [c.id, c])),
    [createOptions.consumables],
  )
  const selectedTools = useMemo(
    () => selectedToolIds.map((id) => toolById.get(id)).filter(Boolean) as BorrowingCreateToolOption[],
    [selectedToolIds, toolById],
  )
  const selectedConsumableIds = useMemo(
    () =>
      Object.entries(consumableQtyMap)
        .filter(([, qty]) => qty > 0)
        .map(([id]) => id),
    [consumableQtyMap],
  )
  const selectedConsumables = useMemo(
    () =>
      selectedConsumableIds
        .map((id) => ({ id, item: consumableById.get(id), qty: consumableQtyMap[id] ?? 0 }))
        .filter((entry) => entry.item) as Array<{ id: string; item: BorrowingCreateConsumableOption; qty: number }>,
    [selectedConsumableIds, consumableById, consumableQtyMap],
  )
  const deferredToolQuery = useDeferredValue(toolQuery)
  const deferredConsumableQuery = useDeferredValue(consumableQuery)
  const selectedApprovalRoute = useMemo(
    () => createOptions.approvalRoutes.find((route) => route.labId === selectedLabId) ?? null,
    [createOptions.approvalRoutes, selectedLabId],
  )
  const autoAdvisorLecturerName = selectedApprovalRoute?.dosenApprovers[0]?.name ?? ""
  const isApprovalRouteReady = selectedApprovalRoute?.isReady ?? false
  const toolSearchResults = useMemo(() => {
    const q = deferredToolQuery.trim().toLowerCase()
    return availableToolsForLab
      .filter((item) => !selectedToolIds.includes(item.id))
      .filter((item) => (q ? item.label.toLowerCase().includes(q) : true))
      .slice(0, toolVisibleCount)
  }, [availableToolsForLab, deferredToolQuery, selectedToolIds, toolVisibleCount])
  const toolSearchTotal = useMemo(() => {
    const q = deferredToolQuery.trim().toLowerCase()
    return availableToolsForLab
      .filter((item) => !selectedToolIds.includes(item.id))
      .filter((item) => (q ? item.label.toLowerCase().includes(q) : true)).length
  }, [availableToolsForLab, deferredToolQuery, selectedToolIds])
  const consumableSearchResults = useMemo(() => {
    const q = deferredConsumableQuery.trim().toLowerCase()
    return availableConsumablesForLab
      .filter((item) => !selectedConsumableIds.includes(item.id))
      .filter((item) => (q ? item.label.toLowerCase().includes(q) : true))
      .slice(0, consumableVisibleCount)
  }, [availableConsumablesForLab, consumableVisibleCount, deferredConsumableQuery, selectedConsumableIds])
  const consumableSearchTotal = useMemo(() => {
    const q = deferredConsumableQuery.trim().toLowerCase()
    return availableConsumablesForLab
      .filter((item) => !selectedConsumableIds.includes(item.id))
      .filter((item) => (q ? item.label.toLowerCase().includes(q) : true)).length
  }, [availableConsumablesForLab, deferredConsumableQuery, selectedConsumableIds])
  const itemsPayload = useMemo(
    () =>
      JSON.stringify({
        toolAssetIds: selectedToolIds,
        consumables: Object.entries(consumableQtyMap)
          .filter(([, qty]) => qty > 0)
          .map(([consumableItemId, qty]) => ({ consumableItemId, qty })),
      }),
    [consumableQtyMap, selectedToolIds],
  )
  const returnableToolItems = (selectedBorrowing?.items ?? []).filter(
    (item) => item.itemType === "tool_asset" && !item.returned,
  )
  const selectedReturnItemIds = useMemo(
    () => returnableToolItems.map((item) => item.id).filter((id) => Boolean(returnSelectionMap[id])),
    [returnSelectionMap, returnableToolItems],
  )
  const returnItemsPayload = useMemo(
    () =>
      JSON.stringify(
        selectedReturnItemIds.map((transactionItemId) => ({
          transactionItemId,
          returnCondition: returnSelectionMap[transactionItemId] ?? "baik",
        })),
      ),
    [selectedReturnItemIds, returnSelectionMap],
  )
  const selectedBorrowingActionHint = selectedBorrowing
    ? getNextActionHint({
        status: selectedBorrowing.status,
        approvalsCount: selectedBorrowing.approvalsCount,
        pendingReturnTools: returnableToolItems.length,
      })
    : null

  useEffect(() => {
    if (!selectedBorrowingId) {
      setReturnSelectionMap({})
      return
    }
    const borrowing = details[selectedBorrowingId]
    if (!borrowing) {
      setReturnSelectionMap({})
      return
    }
    const ids = borrowing.items
      .filter((item) => item.itemType === "tool_asset" && !item.returned)
      .map((item) => item.id)
    setReturnSelectionMap((prev) => {
      const next: Record<string, "baik" | "maintenance" | "damaged"> = {}
      for (const id of ids) {
        next[id] = prev[id] ?? "baik"
      }
      return next
    })
  }, [details, selectedBorrowingId])
  const detailHasAvailableActions = !!(
    selectedBorrowing &&
    ((canApprove && selectedBorrowing.status === "pending") ||
      (canHandover && selectedBorrowing.status === "approved_waiting_handover") ||
      (canHandover &&
        (selectedBorrowing.status === "active" ||
          selectedBorrowing.status === "overdue" ||
          selectedBorrowing.status === "partially_returned")))
  )

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextPage > 1) params.set("page", String(nextPage))
    else params.delete("page")
    const target = params.toString() ? `${pathname}?${params.toString()}` : pathname
    startPagingTransition(() => {
      router.replace(target, { scroll: false })
    })
  }

  const applyListFilters = (next: Partial<{ status: string; scope: "all" | "mine" | "my_labs" | "waiting_me"; page: number }>) => {
    const params = new URLSearchParams(searchParams.toString())
    const nextStatus = next.status ?? statusFilter
    const nextScope = next.scope ?? scopeFilter
    const nextPage = next.page ?? 1
    if (nextStatus !== "all") params.set("status", nextStatus)
    else params.delete("status")
    if (nextScope !== "all")
      params.set("scope", nextScope)
    else params.delete("scope")
    if (nextPage > 1) params.set("page", String(nextPage))
    else params.delete("page")
    const target = params.toString() ? `${pathname}?${params.toString()}` : pathname
    startPagingTransition(() => {
      router.replace(target, { scroll: false })
    })
  }

  const handleLabChange = (labId: string) => {
    setSelectedLabId(labId)
    setSelectedToolIds([])
    setConsumableQtyMap({})
    setToolQuery("")
    setConsumableQuery("")
    setToolVisibleCount(30)
    setConsumableVisibleCount(30)
  }

  const setConsumableQty = (consumableId: string, qty: number) => {
    setConsumableQtyMap((prev) => ({
      ...prev,
      [consumableId]: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0,
    }))
  }
  const addTool = (toolId: string) => {
    setSelectedToolIds((prev) => (prev.includes(toolId) ? prev : [...prev, toolId]))
  }
  const removeTool = (toolId: string) => {
    setSelectedToolIds((prev) => prev.filter((id) => id !== toolId))
  }
  const addConsumable = (consumableId: string) => {
    setConsumableQtyMap((prev) => ({
      ...prev,
      [consumableId]: prev[consumableId] && prev[consumableId] > 0 ? prev[consumableId] : 1,
    }))
  }
  const incrementConsumableQty = (consumableId: string) => {
    setConsumableQtyMap((prev) => ({
      ...prev,
      [consumableId]: (prev[consumableId] ?? 0) + 1,
    }))
  }
  const decrementConsumableQty = (consumableId: string) => {
    setConsumableQtyMap((prev) => {
      const current = prev[consumableId] ?? 0
      if (current <= 1) return prev
      return { ...prev, [consumableId]: current - 1 }
    })
  }
  const removeConsumable = (consumableId: string) => {
    setConsumableQtyMap((prev) => {
      const next = { ...prev }
      delete next[consumableId]
      return next
    })
  }

  const openApprovalConfirm = (mode: "approve" | "reject", source: "list" | "detail", transactionId: string) => {
    setConfirmDialog({ open: true, mode, source, transactionId })
  }

  const submitConfirmedApproval = () => {
    const form =
      confirmDialog.source === "list"
        ? confirmDialog.mode === "approve"
          ? quickApproveFormRef.current
          : quickRejectFormRef.current
        : confirmDialog.mode === "approve"
          ? detailApproveFormRef.current
          : detailRejectFormRef.current

    if (!form) {
      setConfirmDialog((prev) => ({ ...prev, open: false }))
      return
    }

    if (!form.reportValidity()) return

    setConfirmDialog((prev) => ({ ...prev, open: false }))
    form.requestSubmit()
  }

  useEffect(() => {
    const feedbacks = [
      createState ? { key: `create:${createState.ok}:${createState.message}`, title: "Pengajuan", ...createState } : null,
      approveState ? { key: `approve:${approveState.ok}:${approveState.message}`, title: "Approval", ...approveState } : null,
      rejectState ? { key: `reject:${rejectState.ok}:${rejectState.message}`, title: "Penolakan", ...rejectState } : null,
      handoverState ? { key: `handover:${handoverState.ok}:${handoverState.message}`, title: "Serah Terima", ...handoverState } : null,
      returnState ? { key: `return:${returnState.ok}:${returnState.message}`, title: "Pengembalian", ...returnState } : null,
    ].filter(Boolean) as Array<{ key: string; title: string; ok: boolean; message: string }>

    for (const item of feedbacks) {
      if (feedbackRef.current.includes(item.key)) continue
      feedbackRef.current.push(item.key)
      toast({
        title: item.title,
        description: item.message,
        variant: item.ok ? "default" : "destructive",
      })
    }
  }, [approveState, createState, handoverState, rejectState, returnState, toast])

  useEffect(() => {
    if (!createState?.ok) return
    queueMicrotask(() => {
      setCreateOpen(false)
      setSelectedToolIds([])
      setConsumableQtyMap({})
      setToolQuery("")
      setConsumableQuery("")
      setToolVisibleCount(30)
      setConsumableVisibleCount(30)
      setCourseName("")
      setMaterialTopic("")
      setSemesterLabel("")
      setGroupName("")
    })
  }, [createState])

  useEffect(() => {
    if (!prefill?.openCreate) return
    queueMicrotask(() => {
      setCreateOpen(true)
      if (prefill.labId && createOptions.labs.some((l) => l.id === prefill.labId)) {
        setSelectedLabId(prefill.labId)
      }
      if (prefill.toolModelCode) {
        const firstTool = createOptions.tools.find(
          (t) =>
            t.modelCode === prefill.toolModelCode &&
            (!prefill.labId || t.labId === prefill.labId),
        )
        if (firstTool) {
          if (!prefill.labId) setSelectedLabId(firstTool.labId)
          setSelectedToolIds([firstTool.id])
        }
      }
    })
  }, [createOptions.labs, createOptions.tools, prefill])

  return (
    <div className="min-w-0 overflow-x-hidden flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Peminjaman</h1>
          <p className="text-sm text-muted-foreground">
            {role === "mahasiswa"
              ? "Pantau status pengajuan Anda dan lihat detail proses peminjaman hingga selesai."
              : "Kelola pengajuan, approval, serah terima, dan pengembalian alat/bahan secara bertahap."}
          </p>
        </div>
        {canCreate && <div className="shrink-0">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus className="size-4" />
              Buat Pengajuan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] md:max-w-[50vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Buat Pengajuan Peminjaman</DialogTitle>
              <DialogDescription>
                Mendukung multi-item alat dan bahan habis pakai dalam satu pengajuan.
              </DialogDescription>
            </DialogHeader>
            <form action={createAction} className="grid gap-4">
              {createState && (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    createState.ok
                      ? "border-success/20 bg-success/5 text-success-foreground"
                      : "border-destructive/20 bg-destructive/5 text-destructive"
                  }`}
                >
                  {createState.message}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="labId">Laboratorium</Label>
                <Select name="labId" value={selectedLabId} onValueChange={handleLabChange}>
                  <SelectTrigger id="labId" className="w-full">
                    <SelectValue placeholder="Pilih lab" />
                  </SelectTrigger>
                  <SelectContent>
                    {createOptions.labs.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="purpose">Keperluan</Label>
                  <Input id="purpose" name="purpose" placeholder="Contoh: Praktikum Hematologi" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="courseName">Mata Kuliah</Label>
                  <Input
                    id="courseName"
                    name="courseName"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Contoh: Kimia Lingkungan"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="materialTopic">Materi</Label>
                  <Input
                    id="materialTopic"
                    name="materialTopic"
                    value={materialTopic}
                    onChange={(e) => setMaterialTopic(e.target.value)}
                    placeholder="Contoh: Titrasi Asam Basa"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="semesterLabel">Semester</Label>
                  <Input
                    id="semesterLabel"
                    name="semesterLabel"
                    value={semesterLabel}
                    onChange={(e) => setSemesterLabel(e.target.value)}
                    placeholder="Contoh: 4"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="groupName">Kelompok</Label>
                  <Input
                    id="groupName"
                    name="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="A / B / C"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="advisorLecturerName">Dosen</Label>
                  <Input
                    id="advisorLecturerName"
                    name="advisorLecturerName"
                    value={autoAdvisorLecturerName}
                    readOnly
                    placeholder="Belum ada Approver-1 pada matrix lab"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-3 rounded-xl border border-border/70 bg-white/90 p-4 dark:bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Katalog Alat</Label>
                    <Badge variant="outline" className="rounded-full">
                      {toolSearchTotal} tersedia
                    </Badge>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={toolQuery}
                      onChange={(e) => {
                        setToolQuery(e.target.value)
                        setToolVisibleCount(30)
                      }}
                      placeholder="Cari alat (nama/kode unit/model)..."
                    />
                  </div>
                  <div className="max-h-52 space-y-2 overflow-auto rounded-lg border border-border/70 bg-white p-2 dark:bg-card">
                    {toolSearchResults.length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground">Tidak ada alat yang cocok / tersedia.</p>
                    )}
                    {toolSearchResults.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => addTool(tool.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent bg-background px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                      >
                        <p className="text-sm text-foreground">{tool.label}</p>
                        <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          <PackagePlus className="size-3" />
                          Tambah
                        </span>
                      </button>
                    ))}
                    {toolSearchTotal > toolSearchResults.length && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setToolVisibleCount((prev) => prev + 30)}
                      >
                        Lihat lebih banyak ({toolSearchTotal - toolSearchResults.length} tersisa)
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl border border-border/60 bg-background p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Alat Terpilih</Label>
                    <Badge variant="outline" className="rounded-full">
                      {selectedTools.length} item
                    </Badge>
                  </div>
                  <div className="max-h-52 space-y-2 overflow-auto rounded-lg border border-border/70 bg-muted/10 p-2">
                    {selectedTools.length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground">Belum ada alat dipilih.</p>
                    )}
                    {selectedTools.map((tool) => (
                      <div key={tool.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                        <p className="text-sm text-foreground">{tool.label}</p>
                        <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => removeTool(tool.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-3 rounded-xl border border-border/70 bg-white/90 p-4 dark:bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Katalog Bahan Habis Pakai</Label>
                    <Badge variant="outline" className="rounded-full">
                      {consumableSearchTotal} tersedia
                    </Badge>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={consumableQuery}
                      onChange={(e) => {
                        setConsumableQuery(e.target.value)
                        setConsumableVisibleCount(30)
                      }}
                      placeholder="Cari bahan / satuan..."
                    />
                  </div>
                  <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-border/70 bg-white p-2 dark:bg-card">
                    {consumableSearchResults.length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground">Tidak ada bahan yang cocok / tersedia.</p>
                    )}
                    {consumableSearchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addConsumable(item.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent bg-background px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Stok: {item.stockQty} {item.unit}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          <FlaskConical className="size-3" />
                          Tambah
                        </span>
                      </button>
                    ))}
                    {consumableSearchTotal > consumableSearchResults.length && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setConsumableVisibleCount((prev) => prev + 30)}
                      >
                        Lihat lebih banyak ({consumableSearchTotal - consumableSearchResults.length} tersisa)
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl border border-border/60 bg-background p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Bahan Terpilih</Label>
                    <Badge variant="outline" className="rounded-full">
                      {selectedConsumables.length} item
                    </Badge>
                  </div>
                  <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-border/70 bg-muted/10 p-2">
                    {selectedConsumables.length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground">Belum ada bahan dipilih.</p>
                    )}
                    {selectedConsumables.map(({ id, item, qty }) => (
                      <div key={id} className="space-y-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-foreground">{item.label}</p>
                          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => removeConsumable(id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Stok: {item.stockQty} {item.unit}
                          </p>
                          <div className="flex items-center rounded-md border border-border/70">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 rounded-none rounded-l-md"
                              onClick={() => decrementConsumableQty(id)}
                              disabled={qty <= 1}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              value={qty}
                              onChange={(e) => setConsumableQty(id, Number(e.target.value))}
                              className="h-8 w-20 rounded-none border-0 text-center focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 rounded-none rounded-r-md"
                              onClick={() => incrementConsumableQty(id)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid items-start gap-3 lg:grid-cols-2">
                <div className="grid gap-2 self-start">
                  <Label htmlFor="requesterUserId">Pemohon</Label>
                  {role === "mahasiswa" ? (
                    <>
                      <input type="hidden" name="requesterUserId" value={selectedRequesterId} />
                      <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm">Akun Anda</div>
                    </>
                  ) : (
                    <Select name="requesterUserId" value={selectedRequesterId} onValueChange={setSelectedRequesterId}>
                      <SelectTrigger id="requesterUserId" className="w-full">
                        <SelectValue placeholder="Pilih mahasiswa" />
                      </SelectTrigger>
                      <SelectContent>
                        {createOptions.requesters.map((requester) => (
                          <SelectItem key={requester.id} value={requester.id}>
                            {requester.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div
                  className={`rounded-xl border px-3 py-3 text-sm ${
                    isApprovalRouteReady
                      ? "border-success/25 bg-success/5"
                      : "border-warning/25 bg-warning/5"
                  }`}
                >
                  <p className="font-medium text-foreground">Rute Approval</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tahap 1</p>
                      <p className="text-sm font-medium text-foreground">Dosen</p>
                      {selectedApprovalRoute?.dosenApprovers.length ? (
                        <p className="text-xs text-muted-foreground">
                          {selectedApprovalRoute.dosenApprovers
                            .map((item) =>
                              item.identifier ? `${item.name} (${item.identifier})` : item.name,
                            )
                            .join(", ")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Belum ada dosen ter-assign.</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tahap 2</p>
                      <p className="text-sm font-medium text-foreground">Petugas PLP</p>
                      {selectedApprovalRoute?.plpApprovers.length ? (
                        <p className="text-xs text-muted-foreground">
                          {selectedApprovalRoute.plpApprovers
                            .map((item) =>
                              item.identifier ? `${item.name} (${item.identifier})` : item.name,
                            )
                            .join(", ")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Belum ada petugas PLP ter-assign.</p>
                      )}
                    </div>
                  </div>
                  {!isApprovalRouteReady && (
                    <p className="mt-2 text-xs text-warning-foreground">
                      Matrix approval lab belum siap. Admin harus aktifkan matrix urutan Dosen ke Petugas PLP dan assign
                      user pada lab ini.
                    </p>
                  )}
                </div>
              </div>

              {(selectedTools.length === 0 && selectedConsumables.length === 0) && (
                <div className="rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
                  Pilih minimal 1 alat atau 1 bahan sebelum kirim pengajuan.
                </div>
              )}

              <input type="hidden" name="itemsPayload" value={itemsPayload} />

              <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Tip: fokus isi data akademik dulu, lalu pilih alat/bahan. Setelah submit, proses dilanjutkan di detail transaksi.
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createPending}>
                  Batal
                </Button>
                <Button type="submit" disabled={createPending || !isApprovalRouteReady}>
                  {createPending ? "Menyimpan..." : "Kirim Pengajuan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>}
      </div>

      <div className={`grid gap-3 ${role === "mahasiswa" ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-border/50 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="size-4 text-warning-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold text-card-foreground">{summary.pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aktif</p>
                <p className="text-lg font-bold text-card-foreground">{summary.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                <XCircle className="size-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Terlambat</p>
                <p className="text-lg font-bold text-card-foreground">{summary.overdue}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="size-4 text-success-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dikembalikan</p>
                <p className="text-lg font-bold text-card-foreground">{summary.completed}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {role !== "mahasiswa" && (
        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-card-foreground">Butuh Tindakan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => applyListFilters({ status: "pending", page: 1 })}
              className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-left transition-colors hover:bg-warning/10"
            >
              <p className="text-xs text-muted-foreground">Approval Pending</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{actionable.approval}</p>
              <p className="mt-1 text-xs text-muted-foreground">Butuh approval ke-1 atau ke-2</p>
            </button>
            <button
              type="button"
              onClick={() => applyListFilters({ status: "approved_waiting_handover", page: 1 })}
              className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
            >
              <p className="text-xs text-muted-foreground">Menunggu Serah Terima</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{actionable.handover}</p>
              <p className="mt-1 text-xs text-muted-foreground">Siap diaktifkan via handover</p>
            </button>
            <button
              type="button"
              onClick={() => applyListFilters({ status: "active", page: 1 })}
              className="rounded-lg border border-border/50 bg-muted/30 p-3 text-left transition-colors hover:bg-muted/50"
            >
              <p className="text-xs text-muted-foreground">Transaksi Aktif</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{actionable.returning}</p>
              <p className="mt-1 text-xs text-muted-foreground">Menunggu pengembalian alat</p>
            </button>
            <button
              type="button"
              onClick={() => applyListFilters({ status: "overdue", page: 1 })}
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-left transition-colors hover:bg-destructive/10"
            >
              <p className="text-xs text-muted-foreground">Keterlambatan</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{actionable.overdue}</p>
              <p className="mt-1 text-xs text-muted-foreground">Prioritas tindak lanjut</p>
            </button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">
            {isMahasiswa ? "Filter Pengajuan Saya" : "Filter Daftar"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isMahasiswa ? (
            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Fokus mahasiswa</p>
              <p className="mt-1 text-muted-foreground">
                Pantau status pengajuan, lihat jadwal pengembalian, lalu cek detail transaksi jika perlu.
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,18rem)_minmax(0,18rem)_1fr] xl:items-center">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                applyListFilters({ status: v, page: 1 })
              }}
            >
              <SelectTrigger className={isMahasiswa ? "w-full sm:w-64 bg-card" : "w-56 bg-card"}>
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="approved_waiting_handover">Menunggu Serah Terima</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="partially_returned">Kembali Sebagian</SelectItem>
                <SelectItem value="overdue">Terlambat</SelectItem>
                <SelectItem value="completed">Dikembalikan</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
            {!isMahasiswa && (
              <Select
                value={scopeFilter}
                onValueChange={(v) => {
                  setScopeFilter(v as "all" | "mine" | "my_labs" | "waiting_me")
                  applyListFilters({ scope: v as "all" | "mine" | "my_labs" | "waiting_me", page: 1 })
                }}
              >
                <SelectTrigger className="w-full bg-card xl:w-56">
                  <SelectValue placeholder="Filter Ruang Lingkup" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {(role === "dosen" || role === "petugas_plp") && (
                    <SelectItem value="waiting_me">Menunggu Saya</SelectItem>
                  )}
                  <SelectItem value="mine">Milik Saya</SelectItem>
                  <SelectItem value="my_labs" disabled={!accessibleLabIds || accessibleLabIds.length === 0}>
                    Lab Saya
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {isMahasiswa && (
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Arti Status Pengajuan
              </p>
              <div className="mt-2 space-y-1 text-sm text-foreground">
                <p><span className="font-medium">Menunggu</span>: sedang diproses approval petugas.</p>
                <p><span className="font-medium">Menunggu Serah Terima</span>: approval selesai, tunggu serah terima alat.</p>
                <p><span className="font-medium">Aktif</span>: alat sudah dipinjam dan belum dikembalikan.</p>
                <p><span className="font-medium">Dikembalikan</span>: transaksi selesai.</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tips Penggunaan
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Gunakan filter status untuk memantau progres pengajuan Anda. Buka detail transaksi untuk melihat item, riwayat approval, dan jadwal pengembalian.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Di layar HP, geser tabel ke samping untuk melihat semua kolom.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Daftar Peminjaman ({pagination.totalItems})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Halaman {pagination.page}/{pagination.totalPages} • {pagination.totalItems} transaksi
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="px-6 pb-2 text-xs text-muted-foreground">
            {isMahasiswa
              ? "Geser tabel ke samping pada layar kecil untuk melihat detail status dan tanggal."
              : "Geser tabel ke samping pada layar kecil untuk melihat seluruh kolom dan aksi."}
          </div>
          <div className="w-full overflow-x-auto">
            <Table className={isMahasiswa ? "min-w-[820px]" : "min-w-[1120px]"}>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Kode Transaksi</TableHead>
                  {!isMahasiswa && <TableHead className="font-semibold">Peminjam</TableHead>}
                  {!isMahasiswa && <TableHead className="font-semibold">NIM</TableHead>}
                  <TableHead className="font-semibold">Tgl Pinjam</TableHead>
                  <TableHead className="font-semibold">Tgl Kembali</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  {!isMahasiswa && <TableHead className="font-semibold">Menunggu Approval</TableHead>}
                  <TableHead className="font-semibold">Keperluan</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isMahasiswa ? 6 : 9} className="py-6">
                      <Empty className="border border-border/50 bg-muted/20 py-8">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Package className="size-5" />
                          </EmptyMedia>
                          <EmptyTitle className="text-base">Belum ada transaksi peminjaman</EmptyTitle>
                          <EmptyDescription>
                            {isMahasiswa
                              ? "Anda belum punya pengajuan. Mulai dari katalog alat atau tombol Buat Pengajuan untuk mengajukan peminjaman."
                              : "Buat pengajuan baru untuk memulai alur approval, serah terima, dan pengembalian."}
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            {canCreate && <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                              <Plus className="size-4" />
                              Buat Pengajuan
                            </Button>}
                            {isMahasiswa && (
                              <Button type="button" size="sm" variant="outline" asChild>
                                <Link href="/dashboard/student-tools">Buka Katalog Alat</Link>
                              </Button>
                            )}
                          </div>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((borrow) => {
                  const status = statusConfig[borrow.status]
                  const showApprovalActions = canApprove && role !== "admin" && borrow.status === "pending"
                  return (
                    <TableRow key={borrow.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">{borrow.code}</TableCell>
                      {!isMahasiswa && (
                        <TableCell className="font-medium text-foreground">{borrow.borrower}</TableCell>
                      )}
                      {!isMahasiswa && (
                        <TableCell className="font-mono text-xs text-muted-foreground">{borrow.nim ?? "-"}</TableCell>
                      )}
                      <TableCell className="text-muted-foreground">{borrow.borrowDate ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{borrow.dueDate ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      {!isMahasiswa && (
                        <TableCell className="max-w-[260px]">
                          {borrow.pendingApprovalLabel ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-xs font-medium text-foreground">{borrow.pendingApprovalLabel}</p>
                                {borrow.pendingApprovalTriage && (
                                  <Badge variant="outline" className={approvalTriageConfig[borrow.pendingApprovalTriage].className}>
                                    {approvalTriageConfig[borrow.pendingApprovalTriage].label}
                                  </Badge>
                                )}
                              </div>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {borrow.pendingApprovalApprovers.length > 0
                                  ? borrow.pendingApprovalApprovers.join(", ")
                                  : "Belum ada approver ter-assign"}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className={`${isMahasiswa ? "max-w-[160px]" : "max-w-[220px]"} truncate text-muted-foreground`}>
                        {borrow.purpose}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedBorrowingId(borrow.id)} aria-label="Lihat detail">
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" asChild>
                            <Link
                              href={`/borrowing-proof/${borrow.id}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Cetak bukti"
                              title="Cetak bukti"
                            >
                              <Printer className="size-4" />
                            </Link>
                          </Button>
                          {showApprovalActions && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-success-foreground hover:text-success-foreground"
                                aria-label="Setujui"
                                onClick={() => openApprovalConfirm("approve", "list", borrow.id)}
                              >
                                <CheckCircle2 className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                aria-label="Tolak"
                                onClick={() => openApprovalConfirm("reject", "list", borrow.id)}
                              >
                                <XCircle className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Menampilkan {(pagination.page - 1) * pagination.pageSize + (rows.length > 0 ? 1 : 0)}-
              {(pagination.page - 1) * pagination.pageSize + rows.length} dari {pagination.totalItems} transaksi
              {statusFilter !== "all" || scopeFilter !== "all" ? " (filter status/ruang lingkup diterapkan pada halaman ini)" : ""}.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || pagingPending}
                onClick={() => goToPage(pagination.page - 1)}
              >
                Sebelumnya
              </Button>
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                {pagination.page}/{pagination.totalPages}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || pagingPending}
                onClick={() => goToPage(pagination.page + 1)}
              >
                {pagingPending ? "Memuat..." : "Berikutnya"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedBorrowing} onOpenChange={() => setSelectedBorrowingId(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-[50vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Peminjaman {selectedBorrowing?.code}</DialogTitle>
            <DialogDescription>Informasi transaksi peminjaman dari database.</DialogDescription>
          </DialogHeader>
          {selectedBorrowing && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/borrowing-proof/${selectedBorrowing.id}`} target="_blank" rel="noreferrer">
                    <Printer className="size-4" />
                    Cetak Bukti
                  </Link>
                </Button>
              </div>
              {selectedBorrowingActionHint && (
                <div
                  className={`rounded-lg border px-3 py-3 ${
                    selectedBorrowingActionHint.tone === "warning"
                      ? "border-warning/20 bg-warning/5"
                      : selectedBorrowingActionHint.tone === "danger"
                        ? "border-destructive/20 bg-destructive/5"
                        : selectedBorrowingActionHint.tone === "success"
                          ? "border-success/20 bg-success/5"
                          : selectedBorrowingActionHint.tone === "primary"
                            ? "border-primary/20 bg-primary/5"
                            : "border-border/50 bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{selectedBorrowingActionHint.title}</p>
                      <p className="text-xs text-muted-foreground">{selectedBorrowingActionHint.description}</p>
                    </div>
                  </div>
                </div>
              )}
              <Tabs defaultValue="summary" className="flex flex-col gap-4">
                <TabsList
                  className={`grid h-12 w-full items-stretch gap-1 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-1 ${
                    detailHasAvailableActions ? "grid-cols-3" : "grid-cols-2"
                  }`}
                >
                  <TabsTrigger
                    value="summary"
                    className="h-full w-full rounded-xl border border-transparent bg-transparent py-0 text-sm font-medium leading-none text-muted-foreground transition-all data-[state=active]:border-primary/25 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    Ringkasan
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="h-full w-full rounded-xl border border-transparent bg-transparent py-0 text-sm font-medium leading-none text-muted-foreground transition-all data-[state=active]:border-primary/25 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    Riwayat
                  </TabsTrigger>
                  {detailHasAvailableActions && (
                    <TabsTrigger
                      value="actions"
                      className="h-full w-full rounded-xl border border-transparent bg-transparent py-0 text-sm font-medium leading-none text-muted-foreground transition-all data-[state=active]:border-primary/25 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                    >
                      Tindakan
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="summary" className="mt-0 space-y-4">
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Ringkasan Transaksi</p>
                    <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Peminjam</p>
                        <p className="font-medium text-foreground">{selectedBorrowing.borrower}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">NIM</p>
                        <p className="font-mono text-foreground">{selectedBorrowing.nim ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Laboratorium</p>
                        <p className="text-foreground">{selectedBorrowing.labName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant="outline" className={statusConfig[selectedBorrowing.status].className}>
                          {statusConfig[selectedBorrowing.status].label}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tanggal Pengajuan</p>
                        <p className="text-foreground">{selectedBorrowing.requestedAt}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tanggal Pinjam / Due Date</p>
                        <p className="text-foreground">
                          {selectedBorrowing.borrowDate ?? "-"} / {selectedBorrowing.dueDate ?? "-"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Keperluan</p>
                        <p className="text-foreground">{selectedBorrowing.purpose}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Mata Kuliah</p>
                        <p className="text-foreground">{selectedBorrowing.courseName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Materi</p>
                        <p className="text-foreground">{selectedBorrowing.materialTopic}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Semester</p>
                        <p className="text-foreground">{selectedBorrowing.semesterLabel}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Kelompok</p>
                        <p className="text-foreground">{selectedBorrowing.groupName}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Dosen Pembimbing</p>
                        <p className="text-foreground">{selectedBorrowing.advisorLecturerName ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Jumlah Approval</p>
                        <p className="text-foreground">{selectedBorrowing.approvalsCount}/2</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Approval Aktif Saat Ini</p>
                        <div className="flex items-center gap-2">
                          <p className="text-foreground">{selectedBorrowing.pendingApprovalLabel ?? "-"}</p>
                          {selectedBorrowing.pendingApprovalTriage && (
                            <Badge variant="outline" className={approvalTriageConfig[selectedBorrowing.pendingApprovalTriage].className}>
                              {approvalTriageConfig[selectedBorrowing.pendingApprovalTriage].label}
                            </Badge>
                          )}
                        </div>
                        {selectedBorrowing.pendingApprovalLabel && (
                          <p className="text-xs text-muted-foreground">
                            {selectedBorrowing.pendingApprovalApprovers.length > 0
                              ? selectedBorrowing.pendingApprovalApprovers.join(", ")
                              : "Belum ada approver ter-assign"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Item Pengajuan</p>
                    <div className="flex flex-col gap-2">
                      {selectedBorrowing.items.length === 0 && (
                        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                          Belum ada item pada transaksi ini.
                        </div>
                      )}
                      {selectedBorrowing.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">{item.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.itemType === "tool_asset"
                                ? `Alat${item.assetCode ? ` - ${item.assetCode}` : ""}`
                                : `Bahan - ${item.unit ?? "-"}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.itemType === "tool_asset" && item.returned && (
                              <Badge variant="outline" className="border-success/20 bg-success/10 text-success-foreground">
                                Sudah Kembali
                              </Badge>
                            )}
                            <Badge variant="secondary">{item.qty}x</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-0 space-y-4">
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Riwayat Approval</p>
                    <div className="flex flex-col gap-2">
                      {selectedBorrowing.approvalHistory.length === 0 ? (
                        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                          Belum ada riwayat approval.
                        </div>
                      ) : (
                        selectedBorrowing.approvalHistory.map((approval, index) => (
                          <div
                            key={`${approval.decidedAt}-${approval.approverName}-${index}`}
                            className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm text-foreground">
                                {approval.approverName} ({roleLabel[approval.approverRole]})
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={
                                    approval.decision === "approved"
                                      ? "border-success/20 bg-success/10 text-success-foreground"
                                      : "border-destructive/20 bg-destructive/10 text-destructive"
                                  }
                                >
                                  {approvalDecisionLabel[approval.decision]}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{approval.decidedAt}</span>
                              </div>
                            </div>
                            {approval.note && (
                              <p className="mt-1 text-xs text-muted-foreground">Catatan: {approval.note}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Riwayat Serah Terima</p>
                    <div className="flex flex-col gap-2">
                      {selectedBorrowing.handoverHistory.length === 0 ? (
                        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                          Belum ada riwayat serah terima.
                        </div>
                      ) : (
                        selectedBorrowing.handoverHistory.map((event, index) => (
                          <div
                            key={`${event.handedOverAt}-${event.handedOverByName}-${index}`}
                            className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm text-foreground">Diserahkan oleh {event.handedOverByName}</div>
                              <span className="text-xs text-muted-foreground">{event.handedOverAt}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Due date: {event.dueDate}</p>
                            {event.note && (
                              <p className="mt-1 text-xs text-muted-foreground">Catatan: {event.note}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Riwayat Pengembalian</p>
                    <div className="flex flex-col gap-2">
                      {selectedBorrowing.returnEvents.length === 0 ? (
                        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                          Belum ada riwayat pengembalian.
                        </div>
                      ) : (
                        selectedBorrowing.returnEvents.map((event, index) => (
                          <div
                            key={`${event.returnedAt}-${event.receivedByName}-${index}`}
                            className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm text-foreground">Diterima oleh {event.receivedByName}</div>
                              <span className="text-xs text-muted-foreground">{event.returnedAt}</span>
                            </div>
                            <div className="mt-2 flex flex-col gap-1">
                              {event.items.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Tidak ada item tercatat.</p>
                              ) : (
                                event.items.map((item) => (
                                  <div
                                    key={item.transactionItemId}
                                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                                  >
                                    <span className="text-foreground">
                                      {item.toolName} - {item.assetCode}
                                    </span>
                                    <Badge variant="outline" className="border-border/60 bg-background">
                                      {returnConditionLabel[item.returnCondition]}
                                    </Badge>
                                  </div>
                                ))
                              )}
                            </div>
                            {event.note && (
                              <p className="mt-2 text-xs text-muted-foreground">Catatan event: {event.note}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </TabsContent>

                {detailHasAvailableActions && (
                <TabsContent value="actions" className="mt-0 space-y-4">
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">Tindakan Operasional</p>
                    <p className="text-xs text-muted-foreground">
                      Hanya tampilkan tindakan yang sesuai dengan status transaksi saat ini.
                    </p>
                  </div>

                  {canApprove && selectedBorrowing.status === "pending" && (
                <>
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Approval kedua akan mengubah status menjadi <span className="font-medium text-foreground">Menunggu Serah Terima</span>.
                    </p>
                    {role === "admin" && selectedBorrowing.adminOverrideReasonRequired && (
                      <div className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                        Admin fallback aktif: alasan approval/penolakan wajib diisi karena approver matrix saat ini adalah{" "}
                        <span className="font-medium">{selectedBorrowing.pendingRequiredApproverName ?? "user lain"}</span>.
                      </div>
                    )}
                    {(approveState || rejectState) && (
                      <div className="grid gap-2">
                        {approveState && (
                          <div
                            className={`rounded-xl border px-3 py-2 text-sm ${
                              approveState.ok
                                ? "border-success/20 bg-success/5 text-success-foreground"
                                : "border-destructive/20 bg-destructive/5 text-destructive"
                            }`}
                          >
                            {approveState.message}
                          </div>
                        )}
                        {rejectState && (
                          <div
                            className={`rounded-xl border px-3 py-2 text-sm ${
                              rejectState.ok
                                ? "border-success/20 bg-success/5 text-success-foreground"
                                : "border-destructive/20 bg-destructive/5 text-destructive"
                            }`}
                          >
                            {rejectState.message}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <form ref={detailApproveFormRef} action={approveAction} className="flex flex-col gap-2">
                        <input type="hidden" name="transactionId" value={selectedBorrowing.id} />
                        <Label htmlFor="approvalNote">
                          {role === "admin" && selectedBorrowing.adminOverrideReasonRequired
                            ? "Alasan Approval (wajib untuk admin fallback)"
                            : "Catatan Approval (opsional)"}
                        </Label>
                        <Textarea
                          id="approvalNote"
                          name="note"
                          value={approvalNote}
                          onChange={(e) => setApprovalNote(e.target.value)}
                          placeholder="Contoh: disetujui untuk praktikum minggu ini"
                          maxLength={500}
                          required={role === "admin" && selectedBorrowing.adminOverrideReasonRequired}
                        />
                        <Button
                          type="button"
                          className="w-full"
                          disabled={approvePending}
                          onClick={() => openApprovalConfirm("approve", "detail", selectedBorrowing.id)}
                        >
                          <CheckCircle2 className="size-4" />
                          {approvePending ? "Memproses..." : "Setujui"}
                        </Button>
                      </form>
                      <form ref={detailRejectFormRef} action={rejectAction} className="flex flex-col gap-2">
                        <input type="hidden" name="transactionId" value={selectedBorrowing.id} />
                        <Label htmlFor="rejectNote">
                          {role === "admin" && selectedBorrowing.adminOverrideReasonRequired
                            ? "Alasan Penolakan (wajib untuk admin fallback)"
                            : "Alasan Penolakan (opsional)"}
                        </Label>
                        <Textarea
                          id="rejectNote"
                          name="note"
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="Contoh: alat tidak tersedia pada jadwal diminta"
                          maxLength={500}
                          required={role === "admin" && selectedBorrowing.adminOverrideReasonRequired}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          className="w-full"
                          disabled={rejectPending}
                          onClick={() => openApprovalConfirm("reject", "detail", selectedBorrowing.id)}
                        >
                          <XCircle className="size-4" />
                          {rejectPending ? "Memproses..." : "Tolak"}
                        </Button>
                      </form>
                    </div>
                  </div>
                </>
              )}

              {canHandover && selectedBorrowing.status === "approved_waiting_handover" && (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Serah Terima Transaksi</p>
                      <p className="mt-1">
                      Serah terima akan mengaktifkan transaksi, mengisi due date, mengubah status alat menjadi dipinjam, dan mengurangi stok bahan.
                      </p>
                    </div>
                    {handoverState && (
                      <div className={`rounded-xl border px-3 py-2 text-sm ${handoverState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                        {handoverState.message}
                      </div>
                    )}
                    <form action={handoverAction} className="grid gap-3">
                      <input type="hidden" name="transactionId" value={selectedBorrowing.id} />
                      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
                        <div className="grid gap-2">
                          <Label htmlFor="handoverDueDate">Due Date</Label>
                          <Input id="handoverDueDate" name="dueDate" type="date" required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="handoverNote">Catatan Serah Terima (opsional)</Label>
                          <Textarea
                            id="handoverNote"
                            name="note"
                            value={handoverNote}
                            onChange={(e) => setHandoverNote(e.target.value)}
                            maxLength={500}
                            placeholder="Contoh: diserahkan lengkap sesuai pengajuan"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="submit" disabled={handoverPending}>
                          {handoverPending ? "Memproses..." : "Proses Serah Terima"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </>
              )}

              {canHandover &&
                (selectedBorrowing.status === "active" ||
                  selectedBorrowing.status === "overdue" ||
                  selectedBorrowing.status === "partially_returned") && (
                  <>
                    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
                      <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Pengembalian Alat</p>
                        <p className="mt-1">
                        Pengembalian parsial: pilih satu atau beberapa alat per submit. Status transaksi berubah otomatis menjadi kembali sebagian atau dikembalikan.
                        </p>
                      </div>
                      {returnState && (
                        <div className={`rounded-xl border px-3 py-2 text-sm ${returnState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                          {returnState.message}
                        </div>
                      )}
                      {returnableToolItems.length === 0 ? (
                        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                          Semua alat pada transaksi ini sudah dikembalikan.
                        </div>
                      ) : (
                        <form action={returnAction} className="grid gap-3">
                          <input type="hidden" name="transactionId" value={selectedBorrowing.id} />
                          <input type="hidden" name="returnItemsPayload" value={returnItemsPayload} />
                          <div className="grid gap-2">
                            <Label>Alat Dikembalikan (bisa multi pilih)</Label>
                            <div className="grid gap-2">
                              {returnableToolItems.map((item) => {
                                const checked = Boolean(returnSelectionMap[item.id])
                                return (
                                  <div
                                    key={item.id}
                                    className="grid gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 sm:grid-cols-[1fr_220px]"
                                  >
                                    <label className="flex cursor-pointer items-start gap-2">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(value) => {
                                          const isChecked = value === true
                                          setReturnSelectionMap((prev) => {
                                            const next = { ...prev }
                                            if (!isChecked) {
                                              delete next[item.id]
                                            } else {
                                              next[item.id] = next[item.id] ?? "baik"
                                            }
                                            return next
                                          })
                                        }}
                                        className="mt-0.5"
                                      />
                                      <span className="text-sm text-foreground">
                                        {item.name}
                                        {item.assetCode ? ` - ${item.assetCode}` : ""}
                                      </span>
                                    </label>
                                    <Select
                                      value={returnSelectionMap[item.id] ?? "baik"}
                                      onValueChange={(value) =>
                                        setReturnSelectionMap((prev) => ({
                                          ...prev,
                                          [item.id]: value as "baik" | "maintenance" | "damaged",
                                        }))
                                      }
                                      disabled={!checked}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Kondisi" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="baik">Baik</SelectItem>
                                        <SelectItem value="maintenance">Perlu Maintenance</SelectItem>
                                        <SelectItem value="damaged">Rusak</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="returnNote">Catatan Pengembalian (opsional)</Label>
                            <Textarea
                              id="returnNote"
                              name="note"
                              value={returnNote}
                              onChange={(e) => setReturnNote(e.target.value)}
                              maxLength={500}
                              placeholder="Contoh: ada goresan ringan pada bodi"
                            />
                          </div>
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button type="submit" disabled={returnPending || selectedReturnItemIds.length === 0}>
                              {returnPending ? "Memproses..." : "Terima Kembali"}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  </>
                )}
                  {!(
                    (canApprove && selectedBorrowing.status === "pending") ||
                    (canHandover && selectedBorrowing.status === "approved_waiting_handover") ||
                    (canHandover &&
                      (selectedBorrowing.status === "active" ||
                        selectedBorrowing.status === "overdue" ||
                        selectedBorrowing.status === "partially_returned"))
                  ) && (
                    <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                      Tidak ada tindakan yang tersedia untuk transaksi ini pada role Anda.
                    </div>
                  )}
                </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <form ref={quickApproveFormRef} action={approveBorrowingAction} className="hidden">
        <input
          type="hidden"
          name="transactionId"
          value={confirmDialog.source === "list" ? (confirmDialog.transactionId ?? "") : ""}
        />
      </form>
      <form ref={quickRejectFormRef} action={rejectBorrowingAction} className="hidden">
        <input
          type="hidden"
          name="transactionId"
          value={confirmDialog.source === "list" ? (confirmDialog.transactionId ?? "") : ""}
        />
      </form>

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.mode === "approve" ? "Konfirmasi Persetujuan" : "Konfirmasi Penolakan"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.mode === "approve"
                ? "Yakin ingin menyetujui pengajuan ini?"
                : "Yakin ingin menolak pengajuan ini?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                submitConfirmedApproval()
              }}
              className={
                confirmDialog.mode === "reject"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {confirmDialog.mode === "approve" ? "Ya, Setujui" : "Ya, Tolak"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
