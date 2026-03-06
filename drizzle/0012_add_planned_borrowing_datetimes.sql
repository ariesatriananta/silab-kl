ALTER TABLE "borrowing_transactions"
ADD COLUMN "planned_borrow_at" timestamp with time zone,
ADD COLUMN "planned_return_at" timestamp with time zone;
