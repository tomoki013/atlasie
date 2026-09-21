BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL DEFAULT '旅するひと' CHECK (length(display_name) <= 80), created_at timestamptz NOT NULL DEFAULT now(), deleting boolean NOT NULL DEFAULT false);
CREATE TABLE auth_identities (issuer text NOT NULL, subject text NOT NULL, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, PRIMARY KEY(issuer,subject));
CREATE TABLE countries (code char(2) PRIMARY KEY, name text NOT NULL, continent text);
CREATE TABLE places (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), country_code char(2) NOT NULL REFERENCES countries, name text NOT NULL, location geography(Point,4326) NOT NULL, provider text, external_id text, UNIQUE(provider,external_id));
CREATE INDEX places_location ON places USING gist(location);
CREATE TABLE trips (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id));
CREATE TABLE visits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, place_id uuid NOT NULL REFERENCES places, trip_id uuid, visited_on date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id), FOREIGN KEY(trip_id,user_id) REFERENCES trips(id,user_id));
CREATE INDEX visits_user_date ON visits(user_id,visited_on DESC);
CREATE TABLE memories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, visit_id uuid NOT NULL, title text NOT NULL DEFAULT '' CHECK(length(title)<=100), body text NOT NULL DEFAULT '' CHECK(length(body)<=500), UNIQUE(id,user_id), UNIQUE(visit_id,user_id), FOREIGN KEY(visit_id,user_id) REFERENCES visits(id,user_id) ON DELETE CASCADE);
CREATE TABLE photos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, visit_id uuid NOT NULL, storage_key text NOT NULL UNIQUE, display_key text UNIQUE, mime_type text NOT NULL CHECK(mime_type='image/jpeg'), byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 8388608), status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','ready')), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id), FOREIGN KEY(visit_id,user_id) REFERENCES visits(id,user_id) ON DELETE CASCADE);
CREATE TABLE memory_photos (user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, memory_id uuid NOT NULL, photo_id uuid NOT NULL, PRIMARY KEY(memory_id,photo_id), FOREIGN KEY(memory_id,user_id) REFERENCES memories(id,user_id) ON DELETE CASCADE, FOREIGN KEY(photo_id,user_id) REFERENCES photos(id,user_id) ON DELETE CASCADE);
CREATE TABLE share_configurations (user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE, slug uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, enabled boolean NOT NULL DEFAULT false);
CREATE TABLE guest_imports (user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, import_key uuid NOT NULL, digest text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,import_key));
CREATE FUNCTION current_archive_user() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','auth_identities','trips','visits','memories','photos','memory_photos','share_configurations','guest_imports'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 IF t='users' THEN
 EXECUTE format('CREATE POLICY owner ON %I USING(id=current_archive_user()) WITH CHECK(id=current_archive_user())',t);
 ELSE
 EXECUTE format('CREATE POLICY owner ON %I USING(user_id=current_archive_user()) WITH CHECK(user_id=current_archive_user())',t);
 END IF;
 END LOOP;
END $$;
-- Narrow SECURITY DEFINER function resolves an already-verified Auth0 subject.
-- The API login role must not own tables or have BYPASSRLS.
CREATE FUNCTION resolve_identity(p_issuer text,p_subject text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_issuer || ':' || p_subject,0));
 SELECT user_id INTO uid FROM auth_identities WHERE issuer=p_issuer AND subject=p_subject;
 IF uid IS NULL THEN
 INSERT INTO users DEFAULT VALUES RETURNING id INTO uid;
 INSERT INTO auth_identities VALUES(p_issuer,p_subject,uid);
 END IF;
 RETURN uid;
END $$;
REVOKE ALL ON FUNCTION resolve_identity(text,text) FROM PUBLIC;
-- Owner must be the controlled migration role with BYPASSRLS; never the API role.
CREATE FUNCTION public_profile(p_slug uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('displayName',u.display_name,'countries',COALESCE((SELECT jsonb_agg(DISTINCT p.country_code) FROM visits v JOIN places p ON p.id=v.place_id WHERE v.user_id=u.id),'[]'::jsonb),'stats',jsonb_build_object('visits',(SELECT count(*) FROM visits WHERE user_id=u.id),'photos',(SELECT count(*) FROM photos WHERE user_id=u.id AND status='ready')))
 FROM share_configurations s JOIN users u ON u.id=s.user_id WHERE s.slug=p_slug AND s.enabled AND NOT u.deleting
$$;
REVOKE ALL ON FUNCTION public_profile(uuid) FROM PUBLIC;
COMMIT;
