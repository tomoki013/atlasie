-- Execute as the migration owner, after 001_foundation.sql.
-- Password/login should be provisioned through your secret manager.
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='archive_api') THEN CREATE ROLE archive_api NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA public TO archive_api;
GRANT SELECT ON countries,places TO archive_api;
GRANT INSERT ON places TO archive_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON users,auth_identities,trips,visits,memories,photos,memory_photos,share_configurations,guest_imports TO archive_api;
GRANT EXECUTE ON FUNCTION resolve_identity(text,text),public_profile(uuid),current_archive_user() TO archive_api;
GRANT INSERT ON cleanup_jobs TO archive_api;
GRANT EXECUTE ON FUNCTION claim_cleanup_jobs(),finish_cleanup_job(uuid) TO archive_api;
GRANT EXECUTE ON FUNCTION record_public_report(uuid,text) TO archive_api;
