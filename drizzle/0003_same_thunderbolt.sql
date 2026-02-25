CREATE TYPE "public"."consumable_stock_movement_type" AS ENUM('stock_in', 'material_request_fulfill', 'borrowing_handover_issue', 'manual_adjustment');--> statement-breakpoint
CREATE TABLE "consumable_stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumable_item_id" uuid NOT NULL,
	"movement_type" "consumable_stock_movement_type" NOT NULL,
	"qty_delta" integer NOT NULL,
	"qty_before" integer NOT NULL,
	"qty_after" integer NOT NULL,
	"note" text,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumable_stock_movements" ADD CONSTRAINT "consumable_stock_movements_consumable_item_id_consumable_items_id_fk" FOREIGN KEY ("consumable_item_id") REFERENCES "public"."consumable_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumable_stock_movements" ADD CONSTRAINT "consumable_stock_movements_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consumable_stock_movements_item_idx" ON "consumable_stock_movements" USING btree ("consumable_item_id");--> statement-breakpoint
CREATE INDEX "consumable_stock_movements_created_idx" ON "consumable_stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "consumable_stock_movements_ref_idx" ON "consumable_stock_movements" USING btree ("reference_type","reference_id");