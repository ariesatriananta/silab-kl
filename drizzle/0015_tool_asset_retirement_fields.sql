ALTER TABLE "tool_assets" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tool_assets" ADD COLUMN "retired_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tool_assets" ADD COLUMN "retirement_reason" text;--> statement-breakpoint
ALTER TABLE "tool_assets" ADD CONSTRAINT "tool_assets_retired_by_user_id_users_id_fk" FOREIGN KEY ("retired_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
