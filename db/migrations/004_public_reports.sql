BEGIN;
CREATE TABLE public_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_slug uuid NOT NULL,reason text NOT NULL CHECK(reason IN('privacy','spam','other')),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_reports FORCE ROW LEVEL SECURITY;
CREATE FUNCTION record_public_report(p_slug uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM share_configurations WHERE slug=p_slug AND enabled) THEN
 INSERT INTO public_reports(profile_slug,reason) VALUES(p_slug,p_reason);
 END IF;
 DELETE FROM public_reports WHERE created_at<now()-interval '30 days';
END $$;
REVOKE ALL ON FUNCTION record_public_report(uuid,text) FROM PUBLIC;
COMMIT;
