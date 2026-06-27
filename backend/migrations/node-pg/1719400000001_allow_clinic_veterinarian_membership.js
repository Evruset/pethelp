exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      memberships_table regclass;
      role_constraint text;
    BEGIN
      memberships_table := COALESCE(
        to_regclass('auth_schema.employee_location_memberships'),
        to_regclass('clinic_schema.employee_location_memberships')
      );

      IF memberships_table IS NULL THEN
        RAISE EXCEPTION 'employee_location_memberships table was not found';
      END IF;

      SELECT c.conname
      INTO role_constraint
      FROM pg_constraint c
      WHERE c.conrelid = memberships_table
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%CLINIC_RECEPTIONIST%'
        AND pg_get_constraintdef(c.oid) LIKE '%CLINIC_ADMIN%'
      ORDER BY c.conname
      LIMIT 1;

      IF role_constraint IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE %s DROP CONSTRAINT %I',
          memberships_table,
          role_constraint
        );
      END IF;

      EXECUTE format(
        'ALTER TABLE %s
         ADD CONSTRAINT employee_location_memberships_role_check
         CHECK (role IN (%L, %L, %L))',
        memberships_table,
        'CLINIC_RECEPTIONIST',
        'CLINIC_ADMIN',
        'CLINIC_VETERINARIAN'
      );
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE
      memberships_table regclass;
    BEGIN
      memberships_table := COALESCE(
        to_regclass('auth_schema.employee_location_memberships'),
        to_regclass('clinic_schema.employee_location_memberships')
      );

      IF memberships_table IS NULL THEN
        RAISE EXCEPTION 'employee_location_memberships table was not found';
      END IF;

      EXECUTE format(
        'ALTER TABLE %s
         DROP CONSTRAINT IF EXISTS employee_location_memberships_role_check',
        memberships_table
      );

      EXECUTE format(
        'ALTER TABLE %s
         ADD CONSTRAINT employee_location_memberships_role_check
         CHECK (role IN (%L, %L))',
        memberships_table,
        'CLINIC_RECEPTIONIST',
        'CLINIC_ADMIN'
      );
    END $$;
  `);
};
