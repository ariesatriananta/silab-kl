ALTER TABLE "borrowing_approval_matrices" ADD COLUMN "step1_approver_user_id" uuid;--> statement-breakpoint
ALTER TABLE "borrowing_approval_matrices" ADD COLUMN "step2_approver_user_id" uuid;--> statement-breakpoint
ALTER TABLE "borrowing_approval_matrices" ADD CONSTRAINT "borrowing_approval_matrices_step1_approver_user_id_users_id_fk" FOREIGN KEY ("step1_approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowing_approval_matrices" ADD CONSTRAINT "borrowing_approval_matrices_step2_approver_user_id_users_id_fk" FOREIGN KEY ("step2_approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "borrowing_approval_matrices_step1_user_idx" ON "borrowing_approval_matrices" USING btree ("step1_approver_user_id");--> statement-breakpoint
CREATE INDEX "borrowing_approval_matrices_step2_user_idx" ON "borrowing_approval_matrices" USING btree ("step2_approver_user_id");
