CREATE TABLE IF NOT EXISTS clinic_schema.employee_location_memberships (
  employee_id uuid NOT NULL,
  clinic_location_id uuid NOT NULL REFERENCES clinic_schema.clinic_locations(id),
  role text NOT NULL CHECK (role IN ('CLINIC_RECEPTIONIST', 'CLINIC_ADMIN')),
  active boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (employee_id, clinic_location_id),
  CHECK ((active = true AND revoked_at IS NULL) OR (active = false AND revoked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS employee_location_memberships_active_idx
  ON clinic_schema.employee_location_memberships (employee_id, clinic_location_id)
  WHERE active = true;
