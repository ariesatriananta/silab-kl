CREATE TABLE "lab_usage_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usage_log_id" uuid NOT NULL,
	"attendee_name" varchar(200) NOT NULL,
	"attendee_nim" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_usage_attendances" ADD CONSTRAINT "lab_usage_attendances_usage_log_id_lab_usage_logs_id_fk" FOREIGN KEY ("usage_log_id") REFERENCES "public"."lab_usage_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lab_usage_attendances_usage_idx" ON "lab_usage_attendances" USING btree ("usage_log_id");--> statement-breakpoint
CREATE INDEX "lab_usage_attendances_nim_idx" ON "lab_usage_attendances" USING btree ("attendee_nim");