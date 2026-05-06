-- Ускорение админского подстрочного поиска по лицензиям/площадкам.
-- Нужен pg_trgm для LIKE '%...%' по lower(...).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Сортировка/фильтры админского списка.
CREATE INDEX IF NOT EXISTS idx_licenses_created_at_desc
  ON licenses (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_licenses_status_created_at_desc_active
  ON licenses (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_import_registry_status
  ON licenses (import_registry_status);

CREATE INDEX IF NOT EXISTS idx_licenses_registry_inactive
  ON licenses (import_registry_inactive);

-- Триграм-индексы по ключевым строковым полям лицензии.
CREATE INDEX IF NOT EXISTS idx_licenses_company_name_trgm
  ON licenses USING GIN (lower(coalesce(company_name, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_inn_trgm
  ON licenses USING GIN (lower(coalesce(inn, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_address_trgm
  ON licenses USING GIN (lower(coalesce(address, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_region_trgm
  ON licenses USING GIN (lower(coalesce(region, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_comment_trgm
  ON licenses USING GIN (lower(coalesce(moderated_comment, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_rejection_note_trgm
  ON licenses USING GIN (lower(coalesce(rejection_note, '')) gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Ускорение EXISTS-поиска по площадкам.
CREATE INDEX IF NOT EXISTS idx_license_sites_address_trgm
  ON license_sites USING GIN (lower(coalesce(address, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_license_sites_region_trgm
  ON license_sites USING GIN (lower(coalesce(region, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_license_sites_site_label_trgm
  ON license_sites USING GIN (lower(coalesce(site_label, '')) gin_trgm_ops);

-- Ускорение EXISTS-поиска по гранулярным записям ФККО.
CREATE INDEX IF NOT EXISTS idx_sfa_fkko_code_trgm
  ON site_fkko_activities USING GIN (lower(fkko_code) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sfa_waste_name_trgm
  ON site_fkko_activities USING GIN (lower(coalesce(waste_name, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sfa_activity_type_trgm
  ON site_fkko_activities USING GIN (lower(coalesce(activity_type, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sfa_hazard_class_trgm
  ON site_fkko_activities USING GIN (lower(coalesce(hazard_class, '')) gin_trgm_ops);
