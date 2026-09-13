CREATE TABLE "research_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"evidence_cid" text,
	"evidence_mime_type" text,
	"evidence_size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "research_logs" ADD CONSTRAINT "research_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_logs" ADD CONSTRAINT "research_logs_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_logs_project_id_idx" ON "research_logs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "research_logs_author_user_id_idx" ON "research_logs" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "research_logs_created_at_idx" ON "research_logs" USING btree ("created_at");