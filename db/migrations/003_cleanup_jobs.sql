BEGIN;
CREATE TABLE cleanup_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,object_keys text[],due_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes');
ALTER TABLE cleanup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleanup_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY owner ON cleanup_jobs USING(user_id=current_archive_user()) WITH CHECK(user_id=current_archive_user());
CREATE FUNCTION claim_cleanup_jobs() RETURNS TABLE(id uuid,user_id uuid,object_keys text[]) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 WITH stale AS (DELETE FROM photos WHERE status='pending' AND created_at<now()-interval '24 hours' RETURNING photos.user_id,storage_key)
 INSERT INTO cleanup_jobs(user_id,object_keys) SELECT stale.user_id,ARRAY[storage_key] FROM stale;
 RETURN QUERY SELECT j.id,j.user_id,j.object_keys FROM cleanup_jobs j WHERE j.due_at<=now() ORDER BY j.due_at LIMIT 50;
END $$;
CREATE FUNCTION finish_cleanup_job(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job cleanup_jobs;
BEGIN
 SELECT * INTO job FROM cleanup_jobs WHERE id=p_id AND due_at<=now();
 IF NOT FOUND THEN RETURN; END IF;
 IF job.object_keys IS NULL THEN DELETE FROM users WHERE id=job.user_id AND deleting; END IF;
 DELETE FROM cleanup_jobs WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION claim_cleanup_jobs(),finish_cleanup_job(uuid) FROM PUBLIC;
COMMIT;
