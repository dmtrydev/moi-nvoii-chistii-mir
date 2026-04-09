-- Официальные наименования кодов ФККО (РПН), кэш для UI без повторных запросов к rpn.gov.ru
CREATE TABLE IF NOT EXISTS fkko_official_titles (
  code VARCHAR(11) PRIMARY KEY,
  title TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fkko_official_titles_code_fmt CHECK (code ~ '^[0-9]{11}$')
);

CREATE INDEX IF NOT EXISTS idx_fkko_official_titles_updated_at ON fkko_official_titles (updated_at DESC);
