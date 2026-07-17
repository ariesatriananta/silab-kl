ALTER TABLE "borrowing_transactions" ADD COLUMN "approval_round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowing_approvals" ADD COLUMN "approval_round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "borrowing_approvals_tx_approver_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "borrowing_approvals_tx_step_uq";--> statement-breakpoint
CREATE INDEX "borrowing_approvals_tx_round_idx" ON "borrowing_approvals" USING btree ("transaction_id","approval_round");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_approvals_tx_approver_uq" ON "borrowing_approvals" USING btree ("transaction_id","approver_user_id","approval_round");--> statement-breakpoint
CREATE UNIQUE INDEX "borrowing_approvals_tx_step_uq" ON "borrowing_approvals" USING btree ("transaction_id","step_order","approval_round");
