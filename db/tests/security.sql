\set ON_ERROR_STOP on
BEGIN;
SELECT resolve_identity('https://test.invalid/','google-oauth2|alice') AS alice \gset
SELECT resolve_identity('https://test.invalid/','apple|bob') AS bob \gset
SELECT resolve_identity('https://test.invalid/','google-oauth2|alice') = :'alice' AS idempotent_identity \gset
\if :idempotent_identity
\else
\quit 1
\endif
SET LOCAL ROLE archive_api;
SELECT set_config('app.user_id',:'alice',true);
INSERT INTO trips(id,user_id,title) VALUES('11111111-1111-4111-8111-111111111111',:'alice','Alice trip');
INSERT INTO visits(id,user_id,place_id,visited_on) VALUES('22222222-2222-4222-8222-222222222222',:'alice','00000000-0000-4000-8000-000000000001','2026-09-05');
INSERT INTO places(id,user_id,country_code,name,location) VALUES('33333333-3333-4333-8333-333333333333',:'alice','JP','Alice private place',ST_SetSRID(ST_MakePoint(135,35),4326));
SELECT set_config('app.user_id',:'bob',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM places WHERE id='33333333-3333-4333-8333-333333333333') THEN RAISE EXCEPTION 'Private place leaked'; END IF;
 BEGIN
 INSERT INTO visits(user_id,place_id,visited_on) VALUES(current_archive_user(),'33333333-3333-4333-8333-333333333333','2026-09-05');
 RAISE EXCEPTION 'Cross-user place relation succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM trips) OR EXISTS(SELECT 1 FROM visits) THEN RAISE EXCEPTION 'Cross-user read leaked'; END IF;
 BEGIN
 INSERT INTO visits(user_id,place_id,trip_id,visited_on) VALUES(current_archive_user(),'00000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','2026-09-05');
 RAISE EXCEPTION 'Cross-user trip relation succeeded';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
UPDATE visits SET visited_on='2000-01-01' WHERE id='22222222-2222-4222-8222-222222222222';
SELECT set_config('app.user_id',:'alice',true);
DO $$ BEGIN
 IF (SELECT visited_on FROM visits WHERE id='22222222-2222-4222-8222-222222222222') <> '2026-09-05' THEN RAISE EXCEPTION 'Cross-user update succeeded'; END IF;
END $$;
INSERT INTO share_configurations(user_id) VALUES(:'alice');
DO $$ DECLARE share_id uuid; BEGIN
 SELECT slug INTO share_id FROM share_configurations;
 IF public_profile(share_id) IS NOT NULL THEN RAISE EXCEPTION 'Private profile leaked'; END IF;
END $$;
UPDATE share_configurations SET enabled=true;
DO $$ DECLARE profile jsonb; BEGIN
 SELECT public_profile(slug) INTO profile FROM share_configurations;
 IF profile IS NULL OR profile ? 'date' OR profile ? 'memo' OR profile ? 'location' THEN RAISE EXCEPTION 'Invalid public profile'; END IF;
END $$;
DELETE FROM users WHERE id=:'alice';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM visits) OR EXISTS(SELECT 1 FROM trips) OR EXISTS(SELECT 1 FROM share_configurations) THEN RAISE EXCEPTION 'Account delete failed'; END IF;
END $$;
ROLLBACK;
