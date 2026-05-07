UPDATE users
SET
  full_name = COALESCE(NULLIF(full_name, ''), 'System Admin'),
  email = 'sample@gmail.com',
  organization = 'Dummy Organization',
  department = COALESCE(NULLIF(department, ''), 'Administration'),
  position = COALESCE(NULLIF(position, ''), 'System Administrator'),
  is_first_login = FALSE,
  temp_password_changed = TRUE,
  updated_at = now()
WHERE lower(username) = 'admin';
