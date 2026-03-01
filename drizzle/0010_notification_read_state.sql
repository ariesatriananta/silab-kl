CREATE TABLE "user_notification_states" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"borrowing_last_read_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notification_states" ADD CONSTRAINT "user_notification_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_notification_states_updated_idx" ON "user_notification_states" USING btree ("updated_at");
