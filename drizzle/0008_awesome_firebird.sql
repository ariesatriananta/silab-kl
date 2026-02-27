CREATE INDEX "borrowing_approvals_tx_decision_idx" ON "borrowing_approvals" USING btree ("transaction_id","decision");--> statement-breakpoint
CREATE INDEX "borrowing_transactions_requester_requested_idx" ON "borrowing_transactions" USING btree ("requester_user_id","requested_at");--> statement-breakpoint
CREATE INDEX "borrowing_transactions_creator_requested_idx" ON "borrowing_transactions" USING btree ("created_by_user_id","requested_at");--> statement-breakpoint
CREATE INDEX "borrowing_transactions_lab_status_requested_idx" ON "borrowing_transactions" USING btree ("lab_id","status","requested_at");--> statement-breakpoint
CREATE INDEX "borrowing_transactions_status_requested_idx" ON "borrowing_transactions" USING btree ("status","requested_at");--> statement-breakpoint
CREATE INDEX "borrowing_transactions_approval_matrix_idx" ON "borrowing_transactions" USING btree ("approval_matrix_id");