INSERT INTO organizations (name, type, is_active)
VALUES
  ('Dummy Organization', 'GOVERNMENT', TRUE),
  ('Taoyuan City Government', 'GOVERNMENT', TRUE),
  ('Taoyuan Public Works Bureau', 'AGENCY', TRUE)
ON CONFLICT (name)
DO UPDATE SET
  type = EXCLUDED.type,
  is_active = TRUE;
