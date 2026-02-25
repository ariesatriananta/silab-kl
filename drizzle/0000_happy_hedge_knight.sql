CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."borrowing_item_type" AS ENUM('tool_asset', 'consumable');--> statement-breakpoint
CREATE TYPE "public"."borrowing_status" AS ENUM('submitted', 'pending_approval', 'approved_waiting_handover', 'active', 'partially_returned', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."material_request_status" AS ENUM('pending', 'approved', 'fulfilled', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tool_asset_status" AS ENUM('available', 'borrowed', 'maintenance', 'damaged', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."tool_condition" AS ENUM('baik', 'maintenance', 'damaged');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'mahasiswa', 'petugas_plp');--> statement-breakpoint
CREATE TABLE "borrowing_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"approver_user_id" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "borrowing_handover_consumable_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handover_id" uuid NOT NULL,
	"transaction_item_id" uuid NOT NULL,
	"consumable_item_id" uuid NOT NULL,
	"qty_issued" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrowing_handovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"handed_over_by_user_id" uuid NOT NULL,
	"handed_over_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrowing_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"transaction_item_id" uuid NOT NULL,
	"tool_asset_id" uuid NOT NULL,
	"return_condition" "tool_condition" NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "borrowing_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"received_by_user_id" uuid NOT NULL,
	"returned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrowing_transaction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"item_type" "borrowing_item_type" NOT NULL,
	"tool_asset_id" uuid,
	"consumable_item_id" uuid,
	"qty_requested" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrowing_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"lab_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"status" "borrowing_status" DEFAULT 'submitted' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"handed_over_at" timestamp with time zone,
	"due_date" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"rejection_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"min_stock_qty" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_id" uuid NOT NULL,
	"course_name" varchar(200) NOT NULL,
	"group_name" varchar(100) NOT NULL,
	"instructor_name" varchar(200) NOT NULL,
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"enrolled_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_id" uuid NOT NULL,
	"schedule_id" uuid,
	"course_name" varchar(200) NOT NULL,
	"group_name" varchar(100) NOT NULL,
	"student_count" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"consumable_item_id" uuid NOT NULL,
	"qty_requested" integer NOT NULL,
	"qty_fulfilled" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"lab_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"status" "material_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_model_id" uuid NOT NULL,
	"asset_code" varchar(100) NOT NULL,
	"inventory_code" varchar(100),
	"qr_code_value" varchar(255) NOT NULL,
	"status" "tool_asset_status" DEFAULT 'available' NOT NULL,
	"condition" "tool_condition" DEFAULT 'baik' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_lab_assignments" (
	"user_id" uuid NOT NULL,
	"lab_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_lab_assignments_pk" PRIMARY KEY("user_id","lab_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(100) NOT NULL,
	"nip" varchar(50),
	"nim" varchar(50),
	"full_name" varchar(200) NOT NULL,
	"email" varchar(255),
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "borrowing_approvals" ADD CONSTRAINT "borrowing_approvals_transaction_id_borrowing_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."borrowing_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_approvals" ADD CONSTRAINT "borrowing_approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_handover_consumable_lines" ADD CONSTRAINT "borrowing_handover_consumable_lines_handover_id_borrowing_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."borrowing_handovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_handover_consumable_lines" ADD CONSTRAINT "borrowing_handover_consumable_lines_transaction_item_id_borrowing_transaction_items_id_fk" FOREIGN KEY ("transaction_item_id") REFERENCES "public"."borrowing_transaction_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_handover_consumable_lines" ADD CONSTRAINT "borrowing_handover_consumable_lines_consumable_item_id_consumable_items_id_fk" FOREIGN KEY ("consumable_item_id") REFERENCES "public"."consumable_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_handovers" ADD CONSTRAINT "borrowing_handovers_transaction_id_borrowing_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."borrowing_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_handovers" ADD CONSTRAINT "borrowing_handovers_handed_over_by_user_id_users_id_fk" FOREIGN KEY ("handed_over_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_return_items" ADD CONSTRAINT "borrowing_return_items_return_id_borrowing_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."borrowing_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_return_items" ADD CONSTRAINT "borrowing_return_items_transaction_item_id_borrowing_transaction_items_id_fk" FOREIGN KEY ("transaction_item_id") REFERENCES "public"."borrowing_transaction_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_return_items" ADD CONSTRAINT "borrowing_return_items_tool_asset_id_tool_assets_id_fk" FOREIGN KEY ("tool_asset_id") REFERENCES "public"."tool_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_returns" ADD CONSTRAINT "borrowing_returns_transaction_id_borrowing_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."borrowing_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_returns" ADD CONSTRAINT "borrowing_returns_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_transaction_items" ADD CONSTRAINT "borrowing_transaction_items_transaction_id_borrowing_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."borrowing_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_transaction_items" ADD CONSTRAINT "borrowing_transaction_items_tool_asset_id_tool_assets_id_fk" FOREIGN KEY ("tool_asset_id") REFERENCES "public"."tool_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_transaction_items" ADD CONSTRAINT "borrowing_transaction_items_consumable_item_id_consumable_items_id_fk" FOREIGN KEY ("consumable_item_id") REFERENCES "public"."consumable_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD CONSTRAINT "borrowing_transactions_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD CONSTRAINT "borrowing_transactions_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD CONSTRAINT "borrowing_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD CONSTRAINT "borrowing_transactions_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumable_items" ADD CONSTRAINT "consumable_items_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_schedules" ADD CONSTRAINT "lab_schedules_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_schedules" ADD CONSTRAINT "lab_schedules_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_usage_logs" ADD CONSTRAINT "lab_usage_logs_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_usage_logs" ADD CONSTRAINT "lab_usage_logs_schedule_id_lab_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."lab_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_usage_logs" ADD CONSTRAINT "lab_usage_logs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_request_id_material_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."material_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_consumable_item_id_consumable_items_id_fk" FOREIGN KEY ("consumable_item_id") REFERENCES "public"."consumable_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_assets" ADD CONSTRAINT "tool_assets_tool_model_id_tool_models_id_fk" FOREIGN KEY ("tool_model_id") REFERENCES "public"."tool_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_models" ADD CONSTRAINT "tool_models_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lab_assignments" ADD CONSTRAINT "user_lab_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lab_assignments" ADD CONSTRAINT "user_lab_assignments_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "borrowing_approvals_tx_idx" ON "borrowing_approvals" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_approvals_tx_approver_uq" ON "borrowing_approvals" USING btree ("transaction_id","approver_user_id");--> statement-breakpoint
CREATE INDEX "borrowing_handover_consumable_lines_handover_idx" ON "borrowing_handover_consumable_lines" USING btree ("handover_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_handover_consumable_lines_tx_item_uq" ON "borrowing_handover_consumable_lines" USING btree ("transaction_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_handovers_tx_uq" ON "borrowing_handovers" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "borrowing_return_items_return_idx" ON "borrowing_return_items" USING btree ("return_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_return_items_tx_item_once_uq" ON "borrowing_return_items" USING btree ("transaction_item_id");--> statement-breakpoint
CREATE INDEX "borrowing_returns_tx_idx" ON "borrowing_returns" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "borrowing_transaction_items_tx_idx" ON "borrowing_transaction_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "borrowing_transaction_items_tool_idx" ON "borrowing_transaction_items" USING btree ("tool_asset_id");--> statement-breakpoint
CREATE INDEX "borrowing_transaction_items_consumable_idx" ON "borrowing_transaction_items" USING btree ("consumable_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_transactions_code_uq" ON "borrowing_transactions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "borrowing_transactions_lab_idx" ON "borrowing_transactions" USING btree ("lab_id");--> statement-breakpoint
CREATE INDEX "borrowing_transactions_status_idx" ON "borrowing_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "borrowing_transactions_due_date_idx" ON "borrowing_transactions" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "consumable_items_code_uq" ON "consumable_items" USING btree ("code");--> statement-breakpoint
CREATE INDEX "consumable_items_lab_idx" ON "consumable_items" USING btree ("lab_id");--> statement-breakpoint
CREATE INDEX "lab_schedules_lab_idx" ON "lab_schedules" USING btree ("lab_id");--> statement-breakpoint
CREATE INDEX "lab_schedules_start_idx" ON "lab_schedules" USING btree ("scheduled_start_at");--> statement-breakpoint
CREATE INDEX "lab_usage_logs_lab_idx" ON "lab_usage_logs" USING btree ("lab_id");--> statement-breakpoint
CREATE INDEX "lab_usage_logs_started_idx" ON "lab_usage_logs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "labs_code_uq" ON "labs" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "labs_name_uq" ON "labs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "material_request_items_request_idx" ON "material_request_items" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_request_items_req_consumable_uq" ON "material_request_items" USING btree ("request_id","consumable_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_requests_code_uq" ON "material_requests" USING btree ("code");--> statement-breakpoint
CREATE INDEX "material_requests_lab_idx" ON "material_requests" USING btree ("lab_id");--> statement-breakpoint
CREATE INDEX "material_requests_status_idx" ON "material_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_assets_asset_code_uq" ON "tool_assets" USING btree ("asset_code");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_assets_qr_code_value_uq" ON "tool_assets" USING btree ("qr_code_value");--> statement-breakpoint
CREATE INDEX "tool_assets_model_idx" ON "tool_assets" USING btree ("tool_model_id");--> statement-breakpoint
CREATE INDEX "tool_assets_status_idx" ON "tool_assets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_models_code_uq" ON "tool_models" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tool_models_lab_idx" ON "tool_models" USING btree ("lab_id");--> statement-breakpoint
CREATE INDEX "tool_models_category_idx" ON "tool_models" USING btree ("category");--> statement-breakpoint
CREATE INDEX "user_lab_assignments_lab_idx" ON "user_lab_assignments" USING btree ("lab_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_nip_uq" ON "users" USING btree ("nip");--> statement-breakpoint
CREATE UNIQUE INDEX "users_nim_uq" ON "users" USING btree ("nim");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");