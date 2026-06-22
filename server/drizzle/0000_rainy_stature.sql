CREATE TABLE "account_configs" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"silence_threshold_seconds" integer DEFAULT 180 NOT NULL,
	"target_volume" integer DEFAULT 50 NOT NULL,
	"device_strategy" text DEFAULT 'first_available' NOT NULL,
	"target_device_id" text,
	"target_device_name" text,
	"play_context_uri" text,
	"play_uris" jsonb,
	"shuffle" boolean DEFAULT false NOT NULL,
	"cooldown_seconds" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"spotify_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"enc_refresh_token" text NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"reauth_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"poll_interval_seconds" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotify_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_id" text NOT NULL,
	"enc_client_secret" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_configs" ADD CONSTRAINT "account_configs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_app_id_spotify_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."spotify_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_app_user_unique" ON "accounts" USING btree ("app_id","spotify_user_id");