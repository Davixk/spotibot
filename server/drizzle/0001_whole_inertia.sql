CREATE TABLE "library_adds" (
	"account_id" uuid NOT NULL,
	"track_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_adds_account_id_track_id_pk" PRIMARY KEY("account_id","track_id")
);
--> statement-breakpoint
ALTER TABLE "account_configs" ADD COLUMN "auto_add_to_library" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "library_adds" ADD CONSTRAINT "library_adds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;