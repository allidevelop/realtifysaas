-- 00-init.sql — инициализация БД (ТЗ §6, §9).
-- Выполняется автоматически при первом старте тома Postgres.
-- Две схемы: public (Payload CMS) + gis (PostGIS-геоданные).
--
-- ВАЖНО: PostGIS ставим В СХЕМУ gis (типы, функции, spatial_ref_sys), чтобы
-- схема public оставалась чистой под таблицы Payload. Иначе drizzle-push Payload
-- видит чужую таблицу spatial_ref_sys и зависает на интерактивном вопросе.

CREATE SCHEMA IF NOT EXISTS gis;

-- Расширение PostGIS — внутри схемы gis.
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA gis;

-- search_path: public (Payload) + gis (geometry-типы и функции PostGIS).
ALTER DATABASE geo SET search_path TO public, gis;

-- Контрольный вывод в лог инициализации.
DO $$
BEGIN
  RAISE NOTICE 'PostGIS version: %', gis.postgis_full_version();
  RAISE NOTICE 'Schemas ready: public (Payload), gis (PostGIS)';
END $$;
