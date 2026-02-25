CREATE TABLE "security_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"user_id" uuid,
	"target_type" varchar(50),
	"target_id" uuid,
	"actor_role" "user_role",
	"identifier" varchar(200),
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_audit_logs_created_idx" ON "security_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_audit_logs_category_idx" ON "security_audit_logs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "security_audit_logs_user_idx" ON "security_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_audit_logs_target_idx" ON "security_audit_logs" USING btree ("target_type","target_id");