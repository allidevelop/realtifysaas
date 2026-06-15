-- 02-gis-admin.sql — таблицы геопортала (ТЗ §9). Идемпотентно (IF NOT EXISTS).
-- Выполняется при инициализации тома; на работающей БД — применить вручную:
--   psql ... -f infra/sql/02-gis-admin.sql
-- PostGIS установлен в схему gis (см. 00-init.sql); search_path = public, gis.

-- Территориальные единицы (области/районы/громады/микрорайоны).
CREATE TABLE IF NOT EXISTS gis.admin_units (
  id            serial PRIMARY KEY,
  code_katottg  text,
  koatuu        text,
  level         smallint NOT NULL,           -- 1=область, 2=район, 3=громада, 4=микрорайон
  name          text NOT NULL,
  parent_id     integer REFERENCES gis.admin_units(id) ON DELETE CASCADE,
  population     integer,
  geom          geometry(MultiPolygon, 4326) NOT NULL,
  version_date  date NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX IF NOT EXISTS admin_units_geom_gix ON gis.admin_units USING GIST (geom);
CREATE INDEX IF NOT EXISTS admin_units_level_idx ON gis.admin_units (level);
CREATE INDEX IF NOT EXISTS admin_units_parent_idx ON gis.admin_units (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS admin_units_katottg_uq
  ON gis.admin_units (code_katottg) WHERE code_katottg IS NOT NULL;

-- Объявления (наполняются ETL на этапе 3; точка на карте + привязка к АТЕ).
CREATE TABLE IF NOT EXISTS gis.listings (
  id            bigserial PRIMARY KEY,
  segment       text NOT NULL,               -- apartment/house/commercial/land
  operation     text NOT NULL,               -- sale/rent
  area          numeric,
  price         numeric,
  currency      text NOT NULL DEFAULT 'UAH',
  published_at  date,
  source        text,
  geom          geometry(Point, 4326),
  admin_unit_id integer REFERENCES gis.admin_units(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS listings_geom_gix ON gis.listings USING GIST (geom);
CREATE INDEX IF NOT EXISTS listings_admin_idx ON gis.listings (admin_unit_id);
CREATE INDEX IF NOT EXISTS listings_period_idx ON gis.listings (published_at);

-- Агрегаты по АТЕ/периоду/сегменту (предрасчёт для choropleth, ТЗ §9, §13).
CREATE TABLE IF NOT EXISTS gis.aggregated_metrics (
  id            bigserial PRIMARY KEY,
  admin_unit_id integer NOT NULL REFERENCES gis.admin_units(id) ON DELETE CASCADE,
  period        text NOT NULL,               -- YYYY-MM
  segment       text NOT NULL,
  operation     text NOT NULL,
  metric_type   text NOT NULL,               -- avg_price_sqm / median_price_sqm / count / ...
  value         numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'UAH',
  CONSTRAINT aggregated_metrics_uq
    UNIQUE (admin_unit_id, period, segment, operation, metric_type, currency)
);
CREATE INDEX IF NOT EXISTS agg_metrics_lookup_idx
  ON gis.aggregated_metrics (period, segment, operation, metric_type);
CREATE INDEX IF NOT EXISTS agg_metrics_admin_idx ON gis.aggregated_metrics (admin_unit_id);
