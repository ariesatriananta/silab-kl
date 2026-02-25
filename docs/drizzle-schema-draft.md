# Draft Drizzle Schema (Postgres) - SILAB-KL MVP

Catatan:
- Ini draft schema implementable untuk `Drizzle ORM`, tetapi disimpan sebagai dokumen dulu agar repo tidak rusak sebelum dependency Drizzle dipasang.
- Setelah setup package (`drizzle-orm`, driver Neon, drizzle-kit), isi code block ini bisa dipindah ke `lib/db/schema.ts`.

## Prinsip Naming

- Gunakan `snake_case` untuk nama tabel/kolom DB
- Gunakan enum untuk field status/role yang stabil
- Simpan timestamp dengan timezone (`timestamp(..., { withTimezone: true })`)

## Draft Kode

```ts
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// -------------------------
// Enums
// -------------------------

export const userRoleEnum = pgEnum("user_role", ["admin", "mahasiswa", "petugas_plp"]);

export const toolAssetStatusEnum = pgEnum("tool_asset_status", [
  "available",
  "borrowed",
  "maintenance",
  "damaged",
  "inactive",
]);

export const toolConditionEnum = pgEnum("tool_condition", [
  "baik",
  "maintenance",
  "damaged",
]);

export const borrowingStatusEnum = pgEnum("borrowing_status", [
  "submitted",
  "pending_approval",
  "approved_waiting_handover",
  "active",
  "partially_returned",
  "completed",
  "cancelled",
  "rejected",
]);

export const borrowingItemTypeEnum = pgEnum("borrowing_item_type", ["tool_asset", "consumable"]);

export const approvalDecisionEnum = pgEnum("approval_decision", ["approved", "rejected"]);

export const materialRequestStatusEnum = pgEnum("material_request_status", [
  "pending",
  "approved",
  "fulfilled",
  "rejected",
  "cancelled",
]);

// -------------------------
// Common helper columns
// -------------------------

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

// -------------------------
// Master tables
// -------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: varchar("username", { length: 100 }).notNull(),
    nip: varchar("nip", { length: 50 }),
    nim: varchar("nim", { length: 50 }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    email: varchar("email", { length: 255 }),
    role: userRoleEnum("role").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("users_username_uq").on(t.username),
    uniqueIndex("users_nip_uq").on(t.nip),
    uniqueIndex("users_nim_uq").on(t.nim),
    uniqueIndex("users_email_uq").on(t.email),
    index("users_role_idx").on(t.role),
    check(
      "users_identity_by_role_chk",
      sql`(
        (${t.role} = 'mahasiswa' AND ${t.nim} IS NOT NULL)
        OR
        (${t.role} IN ('admin', 'petugas_plp'))
      )`
    ),
  ]
);

export const labs = pgTable(
  "labs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("labs_code_uq").on(t.code),
    uniqueIndex("labs_name_uq").on(t.name),
  ]
);

export const userLabAssignments = pgTable(
  "user_lab_assignments",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    labId: uuid("lab_id").notNull().references(() => labs.id, { onDelete: "cascade" }),
    createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.labId], name: "user_lab_assignments_pk" }),
    index("user_lab_assignments_lab_idx").on(t.labId),
  ]
);

export const toolModels = pgTable(
  "tool_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    labId: uuid("lab_id").notNull().references(() => labs.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("tool_models_code_uq").on(t.code),
    index("tool_models_lab_idx").on(t.labId),
    index("tool_models_category_idx").on(t.category),
  ]
);

export const toolAssets = pgTable(
  "tool_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolModelId: uuid("tool_model_id").notNull().references(() => toolModels.id, { onDelete: "restrict" }),
    assetCode: varchar("asset_code", { length: 100 }).notNull(),
    inventoryCode: varchar("inventory_code", { length: 100 }),
    qrCodeValue: varchar("qr_code_value", { length: 255 }).notNull(),
    status: toolAssetStatusEnum("status").default("available").notNull(),
    condition: toolConditionEnum("condition").default("baik").notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("tool_assets_asset_code_uq").on(t.assetCode),
    uniqueIndex("tool_assets_qr_code_value_uq").on(t.qrCodeValue),
    index("tool_assets_model_idx").on(t.toolModelId),
    index("tool_assets_status_idx").on(t.status),
  ]
);

export const consumableItems = pgTable(
  "consumable_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    labId: uuid("lab_id").notNull().references(() => labs.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    stockQty: integer("stock_qty").default(0).notNull(),
    minStockQty: integer("min_stock_qty").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("consumable_items_code_uq").on(t.code),
    index("consumable_items_lab_idx").on(t.labId),
    check("consumable_items_stock_non_negative_chk", sql`${t.stockQty} >= 0`),
    check("consumable_items_min_stock_non_negative_chk", sql`${t.minStockQty} >= 0`),
  ]
);

// -------------------------
// Borrowing transaction
// -------------------------

export const borrowingTransactions = pgTable(
  "borrowing_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull(),
    labId: uuid("lab_id").notNull().references(() => labs.id, { onDelete: "restrict" }),
    requesterUserId: uuid("requester_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    purpose: text("purpose").notNull(),
    status: borrowingStatusEnum("status").default("submitted").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    rejectionReason: text("rejection_reason"),
    notes: text("notes"),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("borrowing_transactions_code_uq").on(t.code),
    index("borrowing_transactions_lab_idx").on(t.labId),
    index("borrowing_transactions_requester_idx").on(t.requesterUserId),
    index("borrowing_transactions_status_idx").on(t.status),
    index("borrowing_transactions_due_date_idx").on(t.dueDate),
  ]
);

export const borrowingTransactionItems = pgTable(
  "borrowing_transaction_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => borrowingTransactions.id, { onDelete: "cascade" }),
    itemType: borrowingItemTypeEnum("item_type").notNull(),
    toolAssetId: uuid("tool_asset_id").references(() => toolAssets.id, { onDelete: "restrict" }),
    consumableItemId: uuid("consumable_item_id").references(() => consumableItems.id, { onDelete: "restrict" }),
    qtyRequested: integer("qty_requested").notNull(),
    notes: text("notes"),
    createdAt,
  },
  (t) => [
    index("borrowing_transaction_items_tx_idx").on(t.transactionId),
    index("borrowing_transaction_items_tool_asset_idx").on(t.toolAssetId),
    index("borrowing_transaction_items_consumable_idx").on(t.consumableItemId),
    uniqueIndex("borrowing_tx_items_tool_asset_unique_per_tx")
      .on(t.transactionId, t.toolAssetId),
    check("borrowing_tx_items_qty_positive_chk", sql`${t.qtyRequested} > 0`),
    check(
      "borrowing_tx_items_type_ref_consistency_chk",
      sql`(
        (${t.itemType} = 'tool_asset' AND ${t.toolAssetId} IS NOT NULL AND ${t.consumableItemId} IS NULL AND ${t.qtyRequested} = 1)
        OR
        (${t.itemType} = 'consumable' AND ${t.toolAssetId} IS NULL AND ${t.consumableItemId} IS NOT NULL)
      )`
    ),
  ]
);

export const borrowingApprovals = pgTable(
  "borrowing_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => borrowingTransactions.id, { onDelete: "cascade" }),
    approverUserId: uuid("approver_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    decision: approvalDecisionEnum("decision").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
  },
  (t) => [
    index("borrowing_approvals_tx_idx").on(t.transactionId),
    uniqueIndex("borrowing_approvals_tx_approver_uq").on(t.transactionId, t.approverUserId),
  ]
);

// No partial handover => one handover header per transaction (optional until executed)
export const borrowingHandovers = pgTable(
  "borrowing_handovers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => borrowingTransactions.id, { onDelete: "cascade" }),
    handedOverByUserId: uuid("handed_over_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }).defaultNow().notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    note: text("note"),
    createdAt,
  },
  (t) => [
    uniqueIndex("borrowing_handovers_tx_uq").on(t.transactionId),
    index("borrowing_handovers_due_date_idx").on(t.dueDate),
  ]
);

// Snapshot & stock deduction lines for consumables at handover
export const borrowingHandoverConsumableLines = pgTable(
  "borrowing_handover_consumable_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    handoverId: uuid("handover_id")
      .notNull()
      .references(() => borrowingHandovers.id, { onDelete: "cascade" }),
    transactionItemId: uuid("transaction_item_id")
      .notNull()
      .references(() => borrowingTransactionItems.id, { onDelete: "restrict" }),
    consumableItemId: uuid("consumable_item_id")
      .notNull()
      .references(() => consumableItems.id, { onDelete: "restrict" }),
    qtyIssued: integer("qty_issued").notNull(),
  },
  (t) => [
    index("borrowing_handover_consumable_lines_handover_idx").on(t.handoverId),
    uniqueIndex("borrowing_handover_consumable_lines_tx_item_uq").on(t.transactionItemId),
    check("borrowing_handover_consumable_lines_qty_positive_chk", sql`${t.qtyIssued} > 0`),
  ]
);

// -------------------------
// Return (partial return allowed, tools only)
// -------------------------

export const borrowingReturns = pgTable(
  "borrowing_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => borrowingTransactions.id, { onDelete: "cascade" }),
    receivedByUserId: uuid("received_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    returnedAt: timestamp("returned_at", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
    createdAt,
  },
  (t) => [
    index("borrowing_returns_tx_idx").on(t.transactionId),
    index("borrowing_returns_returned_at_idx").on(t.returnedAt),
  ]
);

export const borrowingReturnItems = pgTable(
  "borrowing_return_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    returnId: uuid("return_id")
      .notNull()
      .references(() => borrowingReturns.id, { onDelete: "cascade" }),
    transactionItemId: uuid("transaction_item_id")
      .notNull()
      .references(() => borrowingTransactionItems.id, { onDelete: "restrict" }),
    toolAssetId: uuid("tool_asset_id")
      .notNull()
      .references(() => toolAssets.id, { onDelete: "restrict" }),
    returnCondition: toolConditionEnum("return_condition").notNull(),
    note: text("note"),
  },
  (t) => [
    index("borrowing_return_items_return_idx").on(t.returnId),
    uniqueIndex("borrowing_return_items_tx_item_unique_once").on(t.transactionItemId),
    uniqueIndex("borrowing_return_items_tool_asset_unique_per_return_event").on(t.returnId, t.toolAssetId),
  ]
);

// -------------------------
// Consumable requests (module "Permintaan Bahan")
// -------------------------

export const materialRequests = pgTable(
  "material_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull(),
    labId: uuid("lab_id").notNull().references(() => labs.id, { onDelete: "restrict" }),
    requesterUserId: uuid("requester_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    status: materialRequestStatusEnum("status").default("pending").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processedByUserId: uuid("processed_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex("material_requests_code_uq").on(t.code),
    index("material_requests_lab_idx").on(t.labId),
    index("material_requests_status_idx").on(t.status),
  ]
);

export const materialRequestItems = pgTable(
  "material_request_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id").notNull().references(() => materialRequests.id, { onDelete: "cascade" }),
    consumableItemId: uuid("consumable_item_id").notNull().references(() => consumableItems.id, { onDelete: "restrict" }),
    qtyRequested: integer("qty_requested").notNull(),
    qtyFulfilled: integer("qty_fulfilled").default(0).notNull(),
  },
  (t) => [
    index("material_request_items_request_idx").on(t.requestId),
    uniqueIndex("material_request_items_unique_consumable_per_request").on(t.requestId, t.consumableItemId),
    check("material_request_items_qty_requested_positive_chk", sql`${t.qtyRequested} > 0`),
    check("material_request_items_qty_fulfilled_non_negative_chk", sql`${t.qtyFulfilled} >= 0`),
  ]
);

// -------------------------
// Schedule & usage
// -------------------------

export const labSchedules = pgTable(
  "lab_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    labId: uuid("lab_id").notNull().references(() => labs.id, { onDelete: "restrict" }),
    courseName: varchar("course_name", { length: 200 }).notNull(),
    groupName: varchar("group_name", { length: 100 }).notNull(),
    instructorName: varchar("instructor_name", { length: 200 }).notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }).notNull(),
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity").notNull(),
    enrolledCount: integer("enrolled_count").default(0).notNull(),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
  },
  (t) => [
    index("lab_schedules_lab_idx").on(t.labId),
    index("lab_schedules_start_idx").on(t.scheduledStartAt),
    check("lab_schedules_time_order_chk", sql`${t.scheduledEndAt} > ${t.scheduledStartAt}`),
    check("lab_schedules_capacity_positive_chk", sql`${t.capacity} > 0`),
    check("lab_schedules_enrolled_non_negative_chk", sql`${t.enrolledCount} >= 0`),
  ]
);

export const labUsageLogs = pgTable(
  "lab_usage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    labId: uuid("lab_id").notNull().references(() => labs.id, { onDelete: "restrict" }),
    scheduleId: uuid("schedule_id").references(() => labSchedules.id, { onDelete: "set null" }),
    courseName: varchar("course_name", { length: 200 }).notNull(),
    groupName: varchar("group_name", { length: 100 }).notNull(),
    studentCount: integer("student_count").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt,
  },
  (t) => [
    index("lab_usage_logs_lab_idx").on(t.labId),
    index("lab_usage_logs_started_idx").on(t.startedAt),
    check("lab_usage_logs_time_order_chk", sql`${t.endedAt} > ${t.startedAt}`),
    check("lab_usage_logs_student_count_positive_chk", sql`${t.studentCount} > 0`),
  ]
);
```

## Catatan Implementasi App-Level (Tidak Cukup di DB)

- Validasi `petugas_plp` hanya boleh approve transaksi pada lab assignment
- Validasi total approval sukses = 2 sebelum handover
- Validasi approver 2 orang berbeda (DB bantu unique per approver, app memastikan count=2)
- Validasi tidak ada partial handover
- Validasi stok bahan cukup tepat saat handover (dalam transaksi DB)
- Update status `tool_assets` saat handover/return
- Hitung `partially_returned/completed`

## Query/Index yang Akan Sering Dipakai

- daftar transaksi per status / per lab
- outstanding & overdue transaksi
- stok bahan rendah (`stock_qty <= min_stock_qty`)
- daftar asset per model/status/lab
- jadwal lab per tanggal

## Rekomendasi Tahap Implementasi Schema

1. Buat tabel master (`users`, `labs`, `assignments`, `tool_*`, `consumable_items`)
2. Buat tabel transaksi peminjaman + approval + handover + return
3. Buat tabel jadwal/usage dan permintaan bahan
4. Seed data dummy
5. Implement service layer + UI migration dari mock
