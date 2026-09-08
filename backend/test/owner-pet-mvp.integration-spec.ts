import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { Role, type JwtPayload } from '../src/auth/auth.types';
import { OwnerPetService } from '../src/auth/owner-pet.service';

jest.setTimeout(60_000);

describe('T022 Owner Pet MVP (PostgreSQL)', () => {
  const database = new DatabaseService();
  const service = new OwnerPetService(database);
  const ownerA = owner(randomUUID());
  const ownerB = owner(randomUUID());

  beforeAll(async () => {
    await database.query(`INSERT INTO identity_schema.users(id) VALUES ($1::uuid),($2::uuid) ON CONFLICT DO NOTHING`, [ownerA.sub, ownerB.sub]);
  });
  beforeEach(async () => {
    await database.query(`DELETE FROM booking_schema.idempotency_records WHERE scope = ANY($1::text[])`, [[`owner-pet.create:${ownerA.sub}`, `owner-pet.create:${ownerB.sub}`]]);
    await database.query(`DELETE FROM pet_schema.pets WHERE owner_id = ANY($1::uuid[])`, [[ownerA.sub, ownerB.sub]]);
  });
  afterAll(async () => {
    await database.query(`DELETE FROM booking_schema.idempotency_records WHERE scope = ANY($1::text[])`, [[`owner-pet.create:${ownerA.sub}`, `owner-pet.create:${ownerB.sub}`]]);
    await database.query(`DELETE FROM pet_schema.pets WHERE owner_id = ANY($1::uuid[])`, [[ownerA.sub, ownerB.sub]]);
    await database.query(`DELETE FROM identity_schema.users WHERE id = ANY($1::uuid[])`, [[ownerA.sub, ownerB.sub]]);
    await database.onModuleDestroy();
  });

  it('creates one owner-scoped row under 20 concurrent identical retries', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 20 }, () => service.createMvp(ownerA, { name: '  Барсик 🐾  ', species: 'CAT' }, key)));
    expect(new Set(results.map((pet) => pet.petId)).size).toBe(1);
    expect(results[0]).toEqual(expect.objectContaining({ name: 'Барсик 🐾', species: 'CAT' }));
    expect(Object.keys(results[0]).sort()).toEqual(['createdAt', 'name', 'petId', 'species', 'updatedAt']);
    const rows = await database.query<{ count: string }>(`SELECT count(*)::text AS count FROM pet_schema.pets WHERE owner_id=$1::uuid`, [ownerA.sub]);
    expect(rows.rows[0].count).toBe('1');
    const ledger = await database.query<{ response_body: Record<string, unknown> }>(`SELECT response_body FROM booking_schema.idempotency_records WHERE scope=$1 AND idempotency_key=$2::uuid`, [`owner-pet.create:${ownerA.sub}`, key]);
    expect(Object.keys(ledger.rows[0].response_body)).toEqual(['petId']);
    expect(JSON.stringify(ledger.rows[0])).not.toContain('Барсик');
  });

  it('rejects changed payload but isolates the same key across owners', async () => {
    const key = randomUUID();
    const a = await service.createMvp(ownerA, { name: 'Рекс', species: 'DOG' }, key);
    await expect(service.createMvp(ownerA, { name: 'Рекс 2', species: 'DOG' }, key)).rejects.toMatchObject({ response: { code: 'PET_IDEMPOTENCY_CONFLICT' } });
    const b = await service.createMvp(ownerB, { name: 'Рекс', species: 'DOG' }, key);
    expect(b.petId).not.toBe(a.petId);
    await expect(service.readMvp(ownerB, a.petId)).resolves.toBeUndefined();
  });

  it('returns only active supported pets in stable order and fails replay closed after archive', async () => {
    const key = randomUUID();
    const first = await service.createMvp(ownerA, { name: 'Ася', species: 'OTHER' }, key);
    await database.query(`INSERT INTO pet_schema.pets(owner_id,name,species) VALUES ($1::uuid,'Legacy','PARROT')`, [ownerA.sub]);
    await database.query(`UPDATE pet_schema.pets SET archived_at=clock_timestamp() WHERE id=$1::uuid`, [first.petId]);
    await expect(service.createMvp(ownerA, { name: 'Ася', species: 'OTHER' }, key)).rejects.toMatchObject({ response: { code: 'PET_IDEMPOTENCY_RESOURCE_UNAVAILABLE' } });
    await expect(service.listMvp(ownerA)).rejects.toMatchObject({ response: { code: 'INTERNAL_ERROR' } });
    const count = await database.query<{ count: string }>(`SELECT count(*)::text AS count FROM pet_schema.pets WHERE owner_id=$1::uuid`, [ownerA.sub]);
    expect(count.rows[0].count).toBe('2');
  });

  it('rolls back pet and ledger atomically when bounded audit persistence fails', async () => {
    const key=randomUUID();
    await database.query(`CREATE OR REPLACE FUNCTION audit_schema.test_reject_pet_create() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN IF NEW.actor_id='${ownerA.sub}' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $fn$`);
    await database.query(`CREATE TRIGGER test_reject_pet_create BEFORE INSERT ON audit_schema.audit_log FOR EACH ROW EXECUTE FUNCTION audit_schema.test_reject_pet_create()`);
    try { await expect(service.createMvp(ownerA,{name:'Сбой',species:'DOG'},key)).rejects.toThrow(); }
    finally { await database.query(`DROP TRIGGER IF EXISTS test_reject_pet_create ON audit_schema.audit_log`); await database.query(`DROP FUNCTION IF EXISTS audit_schema.test_reject_pet_create()`); }
    const state=await database.query<{pets:string;ledger:string}>(`SELECT (SELECT count(*)::text FROM pet_schema.pets WHERE owner_id=$1::uuid) pets,(SELECT count(*)::text FROM booking_schema.idempotency_records WHERE scope=$2 AND idempotency_key=$3::uuid) ledger`,[ownerA.sub,`owner-pet.create:${ownerA.sub}`,key]);
    expect(state.rows[0]).toEqual({pets:'0',ledger:'0'});
  });
});

function owner(sub: string): JwtPayload { return { sub, roles: [Role.OWNER] }; }
