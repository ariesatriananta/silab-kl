import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "mahasiswa", "petugas_plp"])

export const toolAssetStatusEnum = pgEnum("tool_asset_status", [
  "available",
  "borrowed",
  "maintenance",
  "damaged",
  "inactive",
])

export const toolConditionEnum = pgEnum("tool_condition", ["baik", "maintenance", "damaged"])
export const toolAssetEventTypeEnum = pgEnum("tool_asset_event_type", [
  "created",
  "condition_update",
  "maintenance_update",
  "status_update",
  "return_update",
  "note_update",
])

export const borrowingStatusEnum = pgEnum("borrowing_status", [
  "submitted",
  "pending_approval",
  "approved_waiting_handover",
  "active",
  "partially_returned",
  "completed",
  "cancelled",
  "rejected",
])

export const borrowingItemTypeEnum = pgEnum("borrowing_item_type", ["tool_asset", "consumable"])

export const approvalDecisionEnum = pgEnum("approval_decision", ["approved", "rejected"])

export const materialRequestStatusEnum = pgEnum("material_request_status", [
  "pending",
  "approved",
  "fulfilled",
  "rejected",
  "cancelled",
])
export const consumableStockMovementTypeEnum = pgEnum("consumable_stock_movement_type", [
  "stock_in",
  "material_request_fulfill",
  "borrowing_handover_issue",
  "manual_adjustment",
])

// Master
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_username_uq").on(t.username),
    uniqueIndex("users_nip_uq").on(t.nip),
    uniqueIndex("users_nim_uq").on(t.nim),
    uniqueIndex("users_email_uq").on(t.email),
    index("users_role_idx").on(t.role),
  ],
)

export const labs = pgTable(
  "labs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("labs_code_uq").on(t.code), uniqueIndex("labs_name_uq").on(t.name)],
)

export const userLabAssignments = pgTable(
  "user_lab_assignments",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.labId], name: "user_lab_assignments_pk" }),
    index("user_lab_assignments_lab_idx").on(t.labId),
  ],
)

export const securityAuditLogs = pgTable(
  "security_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    category: varchar("category", { length: 50 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    outcome: varchar("outcome", { length: 20 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    targetType: varchar("target_type", { length: 50 }),
    targetId: uuid("target_id"),
    actorRole: userRoleEnum("actor_role"),
    identifier: varchar("identifier", { length: 200 }),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("security_audit_logs_created_idx").on(t.createdAt),
    index("security_audit_logs_category_idx").on(t.category),
    index("security_audit_logs_user_idx").on(t.userId),
    index("security_audit_logs_target_idx").on(t.targetType, t.targetId),
  ],
)

export const toolModels = pgTable(
  "tool_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    brand: varchar("brand", { length: 100 }),
    category: varchar("category", { length: 100 }).notNull(),
    locationDetail: varchar("location_detail", { length: 255 }),
    description: text("description"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tool_models_code_uq").on(t.code),
    index("tool_models_lab_idx").on(t.labId),
    index("tool_models_category_idx").on(t.category),
  ],
)

export const toolAssets = pgTable(
  "tool_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolModelId: uuid("tool_model_id")
      .notNull()
      .references(() => toolModels.id, { onDelete: "restrict" }),
    assetCode: varchar("asset_code", { length: 100 }).notNull(),
    inventoryCode: varchar("inventory_code", { length: 100 }),
    qrCodeValue: varchar("qr_code_value", { length: 255 }).notNull(),
    status: toolAssetStatusEnum("status").default("available").notNull(),
    condition: toolConditionEnum("condition").default("baik").notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tool_assets_asset_code_uq").on(t.assetCode),
    uniqueIndex("tool_assets_qr_code_value_uq").on(t.qrCodeValue),
    index("tool_assets_model_idx").on(t.toolModelId),
    index("tool_assets_status_idx").on(t.status),
  ],
)

export const toolAssetEvents = pgTable(
  "tool_asset_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolAssetId: uuid("tool_asset_id")
      .notNull()
      .references(() => toolAssets.id, { onDelete: "cascade" }),
    eventType: toolAssetEventTypeEnum("event_type").notNull(),
    conditionBefore: toolConditionEnum("condition_before"),
    conditionAfter: toolConditionEnum("condition_after"),
    statusBefore: toolAssetStatusEnum("status_before"),
    statusAfter: toolAssetStatusEnum("status_after"),
    note: text("note"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tool_asset_events_asset_idx").on(t.toolAssetId),
    index("tool_asset_events_created_idx").on(t.createdAt),
    index("tool_asset_events_actor_idx").on(t.actorUserId),
  ],
)

export const consumableItems = pgTable(
  "consumable_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    stockQty: integer("stock_qty").default(0).notNull(),
    minStockQty: integer("min_stock_qty").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("consumable_items_code_uq").on(t.code),
    index("consumable_items_lab_idx").on(t.labId),
  ],
)

export const consumableStockMovements = pgTable(
  "consumable_stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    consumableItemId: uuid("consumable_item_id")
      .notNull()
      .references(() => consumableItems.id, { onDelete: "restrict" }),
    movementType: consumableStockMovementTypeEnum("movement_type").notNull(),
    qtyDelta: integer("qty_delta").notNull(),
    qtyBefore: integer("qty_before").notNull(),
    qtyAfter: integer("qty_after").notNull(),
    note: text("note"),
    referenceType: varchar("reference_type", { length: 50 }),
    referenceId: uuid("reference_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("consumable_stock_movements_item_idx").on(t.consumableItemId),
    index("consumable_stock_movements_created_idx").on(t.createdAt),
    index("consumable_stock_movements_ref_idx").on(t.referenceType, t.referenceId),
  ],
)

// Borrowing transaction
export const borrowingTransactions = pgTable(
  "borrowing_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "restrict" }),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    purpose: text("purpose").notNull(),
    courseName: varchar("course_name", { length: 200 }).default("").notNull(),
    materialTopic: varchar("material_topic", { length: 200 }).default("").notNull(),
    semesterLabel: varchar("semester_label", { length: 50 }).default("").notNull(),
    groupName: varchar("group_name", { length: 50 }).default("").notNull(),
    advisorLecturerName: varchar("advisor_lecturer_name", { length: 200 }),
    status: borrowingStatusEnum("status").default("submitted").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    rejectionReason: text("rejection_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("borrowing_transactions_code_uq").on(t.code),
    index("borrowing_transactions_lab_idx").on(t.labId),
    index("borrowing_transactions_status_idx").on(t.status),
    index("borrowing_transactions_due_date_idx").on(t.dueDate),
  ],
)

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("borrowing_transaction_items_tx_idx").on(t.transactionId),
    index("borrowing_transaction_items_tool_idx").on(t.toolAssetId),
    index("borrowing_transaction_items_consumable_idx").on(t.consumableItemId),
  ],
)

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
  ],
)

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("borrowing_handovers_tx_uq").on(t.transactionId)],
)

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
  ],
)

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("borrowing_returns_tx_idx").on(t.transactionId)],
)

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
    uniqueIndex("borrowing_return_items_tx_item_once_uq").on(t.transactionItemId),
  ],
)

// Consumables request module
export const materialRequests = pgTable(
  "material_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "restrict" }),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: materialRequestStatusEnum("status").default("pending").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processedByUserId: uuid("processed_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("material_requests_code_uq").on(t.code),
    index("material_requests_lab_idx").on(t.labId),
    index("material_requests_status_idx").on(t.status),
  ],
)

export const materialRequestItems = pgTable(
  "material_request_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => materialRequests.id, { onDelete: "cascade" }),
    consumableItemId: uuid("consumable_item_id")
      .notNull()
      .references(() => consumableItems.id, { onDelete: "restrict" }),
    qtyRequested: integer("qty_requested").notNull(),
    qtyFulfilled: integer("qty_fulfilled").default(0).notNull(),
  },
  (t) => [
    index("material_request_items_request_idx").on(t.requestId),
    uniqueIndex("material_request_items_req_consumable_uq").on(t.requestId, t.consumableItemId),
  ],
)

// Schedule & usage
export const labSchedules = pgTable(
  "lab_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "restrict" }),
    courseName: varchar("course_name", { length: 200 }).notNull(),
    groupName: varchar("group_name", { length: 100 }).notNull(),
    instructorName: varchar("instructor_name", { length: 200 }).notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }).notNull(),
    scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity").notNull(),
    enrolledCount: integer("enrolled_count").default(0).notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("lab_schedules_lab_idx").on(t.labId), index("lab_schedules_start_idx").on(t.scheduledStartAt)],
)

export const labUsageLogs = pgTable(
  "lab_usage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "restrict" }),
    scheduleId: uuid("schedule_id").references(() => labSchedules.id, { onDelete: "set null" }),
    courseName: varchar("course_name", { length: 200 }).notNull(),
    groupName: varchar("group_name", { length: 100 }).notNull(),
    studentCount: integer("student_count").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("lab_usage_logs_lab_idx").on(t.labId), index("lab_usage_logs_started_idx").on(t.startedAt)],
)

export const labUsageAttendances = pgTable(
  "lab_usage_attendances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    usageLogId: uuid("usage_log_id")
      .notNull()
      .references(() => labUsageLogs.id, { onDelete: "cascade" }),
    attendeeName: varchar("attendee_name", { length: 200 }).notNull(),
    attendeeNim: varchar("attendee_nim", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("lab_usage_attendances_usage_idx").on(t.usageLogId),
    index("lab_usage_attendances_nim_idx").on(t.attendeeNim),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
