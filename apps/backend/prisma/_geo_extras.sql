-- ─────────────────────────────────────────────────────────────────────────────
-- PostGIS triggers (composed into 20261003000000_init/migration.sql, AFTER the tables).
-- `CREATE EXTENSION postgis` runs at the very TOP of that file instead: the geography
-- columns must exist as a type before any table can be created.
-- ─────────────────────────────────────────────────────────────────────────────

-- The `location` columns are plain geography(Point,4326) kept in sync with lat/lng by
-- trigger. A GENERATED column would work too, but Prisma cannot model generation
-- expressions and would see drift on every `migrate dev`; a trigger keeps the DDL an
-- exact match for the schema (column + GIST index are declared in schema.prisma).
CREATE OR REPLACE FUNCTION pawlink_set_location() RETURNS trigger AS $fn$
BEGIN
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    NEW.location := NULL;
  ELSE
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER cases_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON cases
  FOR EACH ROW EXECUTE FUNCTION pawlink_set_location();

CREATE TRIGGER services_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON services
  FOR EACH ROW EXECUTE FUNCTION pawlink_set_location();

CREATE TRIGGER adoptions_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON adoptions
  FOR EACH ROW EXECUTE FUNCTION pawlink_set_location();
