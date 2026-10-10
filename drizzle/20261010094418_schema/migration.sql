CREATE TYPE "location_category" AS ENUM('garden', 'farm', 'market');--> statement-breakpoint
CREATE TYPE "location_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY DEFAULT public.gen_ksuid(),
	"name" text,
	"phone" text,
	"email" text CONSTRAINT "contacts_email_key" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "editors" (
	"user_id" uuid PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "editors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "location_contacts" (
	"location_id" text,
	"contact_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_contacts_pkey" PRIMARY KEY("location_id","contact_id")
);
--> statement-breakpoint
ALTER TABLE "location_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY DEFAULT public.gen_ksuid(),
	"name" text NOT NULL,
	"category" "location_category" NOT NULL,
	"status" "location_status" DEFAULT 'draft'::"location_status" NOT NULL,
	"lat" numeric(10,7),
	"lng" numeric(10,7),
	"address" text,
	"ward" smallint,
	"website" text,
	"notes" text,
	"image_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "locations_name_lat_lng_key" UNIQUE NULLS NOT DISTINCT("name","lat","lng"),
	CONSTRAINT "locations_lat_range" CHECK ("lat" between -90 and 90),
	CONSTRAINT "locations_lng_range" CHECK ("lng" between -180 and 180),
	CONSTRAINT "locations_lat_lng_paired" CHECK (("lat" is null) = ("lng" is null)),
	CONSTRAINT "locations_ward_positive" CHECK ("ward" > 0),
	CONSTRAINT "locations_image_path_relative" CHECK ("image_path" !~ '^(/|[a-z]+://)')
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "market_schedules" (
	"id" text PRIMARY KEY DEFAULT public.gen_ksuid(),
	"location_id" text NOT NULL,
	"day_of_week" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"season_start" date,
	"season_end" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "market_schedules_day_of_week_range" CHECK ("day_of_week" between 0 and 6),
	CONSTRAINT "market_schedules_hours_order" CHECK ("closes_at" > "opens_at"),
	CONSTRAINT "market_schedules_season_paired" CHECK (("season_start" is null) = ("season_end" is null)),
	CONSTRAINT "market_schedules_season_order" CHECK ("season_end" >= "season_start")
);
--> statement-breakpoint
ALTER TABLE "market_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "location_contacts_contact_id_idx" ON "location_contacts" ("contact_id");--> statement-breakpoint
CREATE INDEX "market_schedules_location_id_idx" ON "market_schedules" ("location_id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "editors" ADD CONSTRAINT "editors_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location_contacts" ADD CONSTRAINT "location_contacts_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location_contacts" ADD CONSTRAINT "location_contacts_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "market_schedules" ADD CONSTRAINT "market_schedules_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "market_schedules" ADD CONSTRAINT "market_schedules_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "market_schedules" ADD CONSTRAINT "market_schedules_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "contacts_select_editor" ON "contacts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "contacts_insert_editor" ON "contacts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "contacts_update_editor" ON "contacts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "contacts_delete_editor" ON "contacts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "editors_select_self" ON "editors" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "location_contacts_select_editor" ON "location_contacts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "location_contacts_insert_editor" ON "location_contacts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "location_contacts_update_editor" ON "location_contacts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "location_contacts_delete_editor" ON "location_contacts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "locations_select_public" ON "locations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("locations"."status" = 'published');--> statement-breakpoint
CREATE POLICY "locations_select_editor" ON "locations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "locations_insert_editor" ON "locations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "locations_update_editor" ON "locations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "market_schedules_select_public" ON "market_schedules" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (select 1 from public.locations l where l.id = "market_schedules"."location_id"));--> statement-breakpoint
CREATE POLICY "market_schedules_select_editor" ON "market_schedules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "market_schedules_insert_editor" ON "market_schedules" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "market_schedules_update_editor" ON "market_schedules" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "market_schedules_delete_editor" ON "market_schedules" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid())));