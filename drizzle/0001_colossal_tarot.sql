CREATE TYPE "public"."tool_asset_event_type" AS ENUM('created', 'condition_update', 'maintenance_update', 'status_update', 'return_update', 'note_update');--> statement-breakpoint
CREATE TABLE "tool_asset_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_asset_id" uuid NOT NULL,
	"event_type" "tool_asset_event_type" NOT NULL,
	"condition_before" "tool_condition",
	"condition_after" "tool_condition",
	"status_before" "tool_asset_status",
	"status_after" "tool_asset_status",
	"note" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_models" ADD COLUMN "brand" varchar(100);--> statement-breakpoint
ALTER TABLE "tool_models" ADD COLUMN "location_detail" varchar(255);--> statement-breakpoint
ALTER TABLE "tool_asset_events" ADD CONSTRAINT "tool_asset_events_tool_asset_id_tool_assets_id_fk" FOREIGN KEY ("tool_asset_id") REFERENCES "public"."tool_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_asset_events" ADD CONSTRAINT "tool_asset_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_asset_events_asset_idx" ON "tool_asset_events" USING btree ("tool_asset_id");--> statement-breakpoint
CREATE INDEX "tool_asset_events_created_idx" ON "tool_asset_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tool_asset_events_actor_idx" ON "tool_asset_events" USING btree ("actor_user_id");