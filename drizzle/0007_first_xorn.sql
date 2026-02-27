CREATE TABLE "borrowing_approval_matrices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_id" uuid NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrowing_approval_matrix_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"approver_role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "borrowing_approvals" ADD COLUMN "step_order" integer;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD COLUMN "approval_matrix_id" uuid;--> statement-breakpoint
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY transaction_id ORDER BY decided_at ASC, id ASC) AS rn
  FROM borrowing_approvals
)
UPDATE borrowing_approvals b
SET step_order = ranked.rn
FROM ranked
WHERE b.id = ranked.id;--> statement-breakpoint
ALTER TABLE "borrowing_approvals" ALTER COLUMN "step_order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowing_approval_matrices" ADD CONSTRAINT "borrowing_approval_matrices_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_approval_matrix_steps" ADD CONSTRAINT "borrowing_approval_matrix_steps_matrix_id_borrowing_approval_matrices_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "public"."borrowing_approval_matrices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_approval_matrices_lab_uq" ON "borrowing_approval_matrices" USING btree ("lab_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_approval_matrix_steps_matrix_step_uq" ON "borrowing_approval_matrix_steps" USING btree ("matrix_id","step_order");--> statement-breakpoint
CREATE INDEX "borrowing_approval_matrix_steps_matrix_idx" ON "borrowing_approval_matrix_steps" USING btree ("matrix_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_approvals_tx_step_uq" ON "borrowing_approvals" USING btree ("transaction_id","step_order");
