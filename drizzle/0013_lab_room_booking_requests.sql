CREATE TYPE "lab_room_booking_request_status" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

CREATE TABLE "lab_room_booking_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(40) NOT NULL,
  "lab_id" uuid NOT NULL,
  "requester_user_id" uuid NOT NULL,
  "status" "lab_room_booking_request_status" DEFAULT 'pending' NOT NULL,
  "course_name" varchar(200) NOT NULL,
  "material_topic" varchar(200) NOT NULL,
  "study_program" varchar(100) NOT NULL,
  "semester_class_label" varchar(100) NOT NULL,
  "group_name" varchar(100) NOT NULL,
  "advisor_lecturer_name" varchar(200) NOT NULL,
  "planned_start_at" timestamp with time zone NOT NULL,
  "planned_end_at" timestamp with time zone NOT NULL,
  "note" text,
  "approved_by_user_id" uuid,
  "approved_at" timestamp with time zone,
  "rejection_reason" text,
  "rejected_by_user_id" uuid,
  "rejected_at" timestamp with time zone,
  "cancel_reason" text,
  "cancelled_by_user_id" uuid,
  "cancelled_at" timestamp with time zone,
  "schedule_id" uuid,
  "usage_log_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "lab_room_booking_requests"
  ADD CONSTRAINT "lab_room_booking_requests_lab_id_labs_id_fk"
  FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "lab_room_booking_requests"
  ADD CONSTRAINT "lab_room_booking_requests_requester_user_id_users_id_fk"
  FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id")
  ON DELETE restrict ON UPDATE no action;

ALTER TABLE "lab_room_booking_requests"
  ADD CONSTRAINT "lab_room_booking_requests_approved_by_user_id_users_id_fk"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "lab_room_booking_requests"
  ADD CONSTRAINT "lab_room_booking_requests_rejected_by_user_id_users_id_fk"
  FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "lab_room_booking_requests"
  ADD CONSTRAINT "lab_room_booking_requests_cancelled_by_user_id_users_id_fk"
  FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "lab_room_booking_requests"
  ADD CONSTRAINT "lab_room_booking_requests_schedule_id_lab_schedules_id_fk"
  FOREIGN KEY ("schedule_id") REFERENCES "public"."lab_schedules"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "lab_room_booking_requests"
  ADD CONSTRAINT "lab_room_booking_requests_usage_log_id_lab_usage_logs_id_fk"
  FOREIGN KEY ("usage_log_id") REFERENCES "public"."lab_usage_logs"("id")
  ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "lab_room_booking_requests_code_uq" ON "lab_room_booking_requests" ("code");
CREATE INDEX "lab_room_booking_requests_lab_idx" ON "lab_room_booking_requests" ("lab_id");
CREATE INDEX "lab_room_booking_requests_requester_idx" ON "lab_room_booking_requests" ("requester_user_id");
CREATE INDEX "lab_room_booking_requests_status_idx" ON "lab_room_booking_requests" ("status");
CREATE INDEX "lab_room_booking_requests_planned_start_idx" ON "lab_room_booking_requests" ("planned_start_at");
