CREATE TYPE "location_category" AS ENUM('garden', 'farm', 'market');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY DEFAULT public.gen_ksuid(),
	"name" text,
	"phone" text,
	"email" text CONSTRAINT "contacts_email_key" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"lat" numeric(10,7),
	"lng" numeric(10,7),
	"address" text,
	"ward" smallint,
	"website" text,
	"notes" text,
	"image_url" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_name_lat_lng_key" UNIQUE NULLS NOT DISTINCT("name","lat","lng"),
	CONSTRAINT "locations_lat_range" CHECK ("lat" between -90 and 90),
	CONSTRAINT "locations_lng_range" CHECK ("lng" between -180 and 180),
	CONSTRAINT "locations_lat_lng_paired" CHECK (("lat" is null) = ("lng" is null)),
	CONSTRAINT "locations_ward_positive" CHECK ("ward" > 0)
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "location_contacts_contact_id_idx" ON "location_contacts" ("contact_id");--> statement-breakpoint
ALTER TABLE "editors" ADD CONSTRAINT "editors_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location_contacts" ADD CONSTRAINT "location_contacts_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location_contacts" ADD CONSTRAINT "location_contacts_contact_id_contacts_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "contacts_all_editor" ON "contacts" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "editors_select_self" ON "editors" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "location_contacts_all_editor" ON "location_contacts" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "locations_select_public" ON "locations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (not "locations"."archived");--> statement-breakpoint
CREATE POLICY "locations_select_editor" ON "locations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "locations_insert_editor" ON "locations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "locations_update_editor" ON "locations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.editors where user_id = (select auth.uid()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select auth.uid())));