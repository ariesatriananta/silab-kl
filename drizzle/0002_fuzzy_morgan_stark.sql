ALTER TABLE "borrowing_transactions" ADD COLUMN "course_name" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD COLUMN "material_topic" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD COLUMN "semester_label" varchar(50) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD COLUMN "group_name" varchar(50) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "borrowing_transactions" ADD COLUMN "advisor_lecturer_name" varchar(200);