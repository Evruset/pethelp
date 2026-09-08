const names = [
  'VETHELP_OWNER_V50_SHELL',
  'OWNER_V50_CATALOG',
  'OWNER_V50_CLINIC_DETAIL',
  'OWNER_DOCTOR_DISCOVERY_SCHEMA_READY_V1',
  'OWNER_V50_DOCTOR_DISCOVERY',
] as const;

describe('Owner Doctor Discovery rollout flags', () => {
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

  afterEach(() => {
    for (const name of names) restore(name, original[name]);
    jest.resetModules();
  });

  it.each([undefined, 'false', 'TRUE', 'True', ' true '])(
    'keeps discovery disabled unless its value is literal true: %p',
    (value) => expect(load({ ...enabledValues(), OWNER_V50_DOCTOR_DISCOVERY: value }).OWNER_V50_DOCTOR_DISCOVERY).toBe(false),
  );

  it.each(names.slice(0, -1))('requires the preceding exact-true dependency %s', (missing) => {
    const values = enabledValues();
    values[missing] = undefined;
    expect(load(values).OWNER_V50_DOCTOR_DISCOVERY).toBe(false);
  });

  it('enables only when the complete dependency chain is literal true', () => {
    expect(load(enabledValues())).toMatchObject({
      OWNER_DOCTOR_DISCOVERY_SCHEMA_READY_V1: true,
      OWNER_V50_CATALOG: true,
      OWNER_V50_CLINIC_DETAIL: true,
      OWNER_V50_DOCTOR_DISCOVERY: true,
    });
  });
});

function enabledValues(): Partial<Record<(typeof names)[number], string | undefined>> {
  return Object.fromEntries(names.map((name) => [name, 'true']));
}

function load(values: Partial<Record<(typeof names)[number], string | undefined>>) {
  for (const name of names) restore(name, values[name]);
  jest.resetModules();
  return (require('./feature-flags.config') as typeof import('./feature-flags.config')).featureFlags;
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
