const { Client } = require('pg');
const {
  SOURCE,
  uuid,
  assertOwned,
  resetSql,
} = require('../../dev/local/rich-demo-namespace.cjs');

const RESET = process.env.DEMO_RESET === '1';
const DB = process.env.DATABASE_URL || 'postgres://vethelp:vethelp@postgres:5432/vethelp';
const now = new Date();

const ids = {
  clinic: '90000000-0000-4000-8000-000000000001',
  foreignClinic: '90000000-0000-4000-8000-000000000002',
  main: '91000000-0000-4000-8000-000000000001',
  branch: '91000000-0000-4000-8000-000000000002',
  foreign: '91000000-0000-4000-8000-000000000003',
};
const employeeId = n => uuid('93', n);
const ownerId = n => uuid('94', n);
const petId = n => uuid('95', n);
const serviceId = n => uuid('92', n);
const doctorId = n => uuid('925', n);
const slotId = n => uuid('96', n);
const holdId = n => uuid('97', n);
const appointmentId = n => uuid('98', n);
const eventId = n => uuid('99', n);

function at(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function qi(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Unsafe identifier: ${value}`);
  return `"${value}"`;
}

async function main() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  const cache = new Map();

  async function cols(schema, table) {
    const key = `${schema}.${table}`;
    if (cache.has(key)) return cache.get(key);
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
      [schema, table],
    );
    const set = new Set(result.rows.map(row => row.column_name));
    cache.set(key, set);
    return set;
  }

  async function exists(schema, table) {
    const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS ok', [`${schema}.${table}`]);
    return result.rows[0]?.ok === true;
  }

  async function assertReservedSet(schema, table, prefix, allowedIds) {
    if (!(await exists(schema, table))) return;
    const result = await client.query(
      `SELECT id::text
       FROM ${qi(schema)}.${qi(table)}
       WHERE id::text LIKE $1
         AND NOT (id = ANY($2::uuid[]))
       ORDER BY id`,
      [`${prefix}%`, allowedIds],
    );
    if (result.rows.length) {
      throw new Error(`${SOURCE} reservation collision in ${schema}.${table}: ${result.rows.map(row => row.id).join(',')}`);
    }
  }

  async function upsert(schema, table, row) {
    const available = await cols(schema, table);
    const entries = Object.entries(row).filter(([key]) => available.has(key));
    if (!entries.some(([key]) => key === 'id')) throw new Error(`${schema}.${table} has no id`);
    const ownershipKeys = {
      'clinic_schema.clinics': ['public_name'],
      'clinic_schema.clinic_locations': ['clinic_id', 'address'],
      'clinic_schema.clinic_services': ['clinic_location_id', 'code'],
      'catalog_schema.doctors': ['clinic_location_id', 'full_name'],
      'pet_schema.pets': ['owner_id', 'name'],
      'clinic_schema.appointment_slots': ['source', 'external_slot_id'],
      'booking_schema.booking_holds': ['slot_id', 'owner_id', 'pet_id'],
      'booking_schema.appointments': ['hold_id', 'slot_id'],
      'booking_schema.appointment_events': ['actor_id', 'event_type'],
    }[`${schema}.${table}`] || [];
    if (ownershipKeys.length) {
      const existing = await client.query(
        `SELECT ${ownershipKeys.map(qi).join(',')}
         FROM ${qi(schema)}.${qi(table)}
         WHERE id=$1::uuid
         FOR UPDATE`,
        [row.id],
      );
      if (existing.rows[0] && ownershipKeys.some((key) =>
        String(existing.rows[0][key] ?? '') !== String(row[key] ?? ''))) {
        throw new Error(`${SOURCE} ownership collision for ${schema}.${table} ${row.id}`);
      }
    }
    const names = entries.map(([key]) => qi(key));
    const params = entries.map((_, i) => `$${i + 1}`);
    const values = entries.map(([, value]) => value);
    const updates = entries
      .filter(([key]) => key !== 'id' && key !== 'created_at')
      .map(([key]) => `${qi(key)}=EXCLUDED.${qi(key)}`);
    await client.query(
      `INSERT INTO ${qi(schema)}.${qi(table)} (${names.join(',')}) VALUES (${params.join(',')})
       ON CONFLICT (id) DO UPDATE SET ${updates.length ? updates.join(',') : 'id=EXCLUDED.id'}`,
      values,
    );
  }

  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'Europe/Moscow'");

    await assertReservedSet('clinic_schema', 'clinics', '90000000-', Object.values(ids).filter(id => id.startsWith('90')));
    await assertReservedSet('clinic_schema', 'clinic_locations', '91000000-', [ids.main, ids.branch, ids.foreign]);
    await assertReservedSet('clinic_schema', 'clinic_services', '92000000-', Array.from({ length: 10 }, (_, i) => serviceId(i + 1)));
    await assertReservedSet('catalog_schema', 'doctors', '92500000-', Array.from({ length: 8 }, (_, i) => doctorId(i + 1)));
    await assertReservedSet('identity_schema', 'users', '93000000-', Array.from({ length: 12 }, (_, i) => employeeId(i + 1)));
    await assertReservedSet('identity_schema', 'users', '94000000-', Array.from({ length: 10 }, (_, i) => ownerId(i + 1)));
    await assertReservedSet('pet_schema', 'pets', '95000000-', Array.from({ length: 15 }, (_, i) => petId(i + 1)));
    await assertReservedSet('clinic_schema', 'appointment_slots', '96000000-', Array.from({ length: 160 }, (_, i) => slotId(i + 1)));
    await assertReservedSet('booking_schema', 'booking_holds', '97000000-', Array.from({ length: 20 }, (_, i) => holdId(i + 1)));
    await assertReservedSet('booking_schema', 'appointments', '98000000-', Array.from({ length: 20 }, (_, i) => appointmentId(i + 1)));
    await assertReservedSet('booking_schema', 'appointment_events', '99000000-', Array.from({ length: 20 }, (_, i) => eventId(i + 1)));
    const priorRichMarker = await exists('booking_schema', 'appointment_events')
      ? (await client.query(`
          SELECT EXISTS(
            SELECT 1
            FROM booking_schema.appointment_events
            WHERE actor_id = 'LOCAL_RICH_DEMO'
              AND payload_json::jsonb ->> 'fixtureSource' = $1
          ) AS owned
        `, [SOURCE])).rows[0]?.owned === true
      : false;
    const existingReservedEmployees = await client.query(`
      SELECT id::text
      FROM identity_schema.users
      WHERE id = ANY($1::uuid[])
      ORDER BY id
    `, [Array.from({ length: 12 }, (_, i) => employeeId(i + 1))]);
    if (existingReservedEmployees.rows.length && !priorRichMarker) {
      throw new Error(`${SOURCE} employee reservation is preclaimed without a durable source marker.`);
    }

    if (RESET) {
      await client.query(resetSql.events);
      await client.query(resetSql.appointments);
      await client.query(resetSql.holds);
      await client.query(resetSql.slots, [SOURCE]);
    }

    await upsert('clinic_schema', 'clinics', {
      id: ids.clinic, legal_name: 'VetHelp Demo Center LLC', public_name: 'VetHelp Demo Center',
      status: 'ACTIVE', timezone: 'Europe/Moscow', mis_type: 'VET_MANAGER_API', updated_at: now,
    });
    await upsert('clinic_schema', 'clinics', {
      id: ids.foreignClinic, legal_name: 'VetHelp External Clinic LLC', public_name: 'VetHelp External Clinic',
      status: 'ACTIVE', timezone: 'Europe/Moscow', mis_type: null, updated_at: now,
    });

    for (const location of [
      { id: ids.main, clinic_id: ids.clinic, address: 'Москва, ул. Большая Полянка, 18', latitude: 55.7369, longitude: 37.6186, phone: '+7 495 700-10-01', status: 'ACTIVE' },
      { id: ids.branch, clinic_id: ids.clinic, address: 'Москва, Ленинградский проспект, 35', latitude: 55.7887, longitude: 37.5595, phone: '+7 495 700-10-02', status: 'ACTIVE' },
      { id: ids.foreign, clinic_id: ids.foreignClinic, address: 'Москва, ул. Академика Королёва, 9', latitude: 55.8214, longitude: 37.6228, phone: '+7 495 700-20-01', status: 'ACTIVE' },
    ]) await upsert('clinic_schema', 'clinic_locations', { ...location, updated_at: now });

    const servicePlan = [
      ['GENERAL_VISIT', 'Первичный приём', 30, '1500.00'],
      ['REPEAT_VISIT', 'Повторный приём', 20, '1000.00'],
      ['VACCINATION', 'Вакцинация', 20, '1800.00'],
      ['DERMATOLOGY', 'Приём дерматолога', 40, '2600.00'],
      ['CARDIOLOGY', 'Приём кардиолога', 45, '3200.00'],
      ['SURGERY', 'Консультация хирурга', 45, '3000.00'],
      ['DIAGNOSTICS', 'Комплексная диагностика', 60, '4500.00'],
      ['EMERGENCY', 'Неотложный приём', 30, '5500.00'],
      ['ULTRASOUND', 'УЗИ', 40, '2800.00'],
      ['DENTISTRY', 'Стоматологический осмотр', 30, '2400.00'],
    ];
    const services = [];
    for (const [i, item] of servicePlan.entries()) {
      const locationId = i < 6 ? ids.main : ids.branch;
      const [code, display_name, duration_minutes, price_amount] = item;
      const service = { id: serviceId(i + 1), clinic_location_id: locationId, code, display_name, duration_minutes, active: true, price_amount, currency: 'RUB' };
      await upsert('clinic_schema', 'clinic_services', service);
      services.push({ ...service, locationId });
    }

    const specialtyIds = new Map();
    const specialtyPlan = [['THERAPIST','Терапевт'],['SURGEON','Хирург'],['DERMATOLOGIST','Дерматолог'],['CARDIOLOGIST','Кардиолог'],['GASTROENTEROLOGIST','Гастроэнтеролог']];
    if (await exists('catalog_schema', 'specialties')) {
      for (const [code, name] of specialtyPlan) {
        const result = await client.query(
          'INSERT INTO catalog_schema.specialties(name,code) VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name RETURNING id',
          [name, code],
        );
        specialtyIds.set(code, result.rows[0].id);
      }
    }

    const doctorPlan = [
      ['Анна Воронцова','THERAPIST',ids.main],['Илья Соколов','SURGEON',ids.main],
      ['Мария Лебедева','DERMATOLOGIST',ids.main],['Олег Крылов','CARDIOLOGIST',ids.main],
      ['Софья Белова','GASTROENTEROLOGIST',ids.branch],['Дмитрий Орлов','THERAPIST',ids.branch],
      ['Елена Морозова','SURGEON',ids.branch],['Павел Зайцев','DERMATOLOGIST',ids.branch],
    ];
    const doctors = [];
    if (await exists('catalog_schema', 'doctors')) {
      for (const [i, [full_name, specialtyCode, locationId]] of doctorPlan.entries()) {
        const doctor = { id: doctorId(i + 1), clinic_location_id: locationId, full_name, specialty_id: specialtyIds.get(specialtyCode) };
        await upsert('catalog_schema', 'doctors', doctor);
        doctors.push({ id: doctor.id, fullName: full_name, specialtyCode, locationId });
      }
    }

    const employees = [
      ['reception-main','Регистратор · основная клиника',1,[['CLINIC_RECEPTIONIST',ids.main,true]],['CLINIC_RECEPTIONIST'],[ids.clinic],[ids.main],'Полный административный доступ основной локации'],
      ['reception-branch','Регистратор · филиал',2,[['CLINIC_RECEPTIONIST',ids.branch,true]],['CLINIC_RECEPTIONIST'],[ids.clinic],[ids.branch],'Полный административный доступ филиала'],
      ['admin-main','Администратор · основная клиника',3,[['CLINIC_ADMIN',ids.main,true]],['CLINIC_ADMIN'],[ids.clinic],[ids.main],'Административный доступ основной локации'],
      ['admin-branch','Администратор · филиал',4,[['CLINIC_ADMIN',ids.branch,true]],['CLINIC_ADMIN'],[ids.clinic],[ids.branch],'Административный доступ филиала'],
      ['vet-therapist','Врач-терапевт',5,[['CLINIC_VETERINARIAN',ids.main,true]],['CLINIC_VETERINARIAN'],[ids.clinic],[ids.main],'Врачебный доступ основной локации'],
      ['vet-surgeon','Врач-хирург',6,[['CLINIC_VETERINARIAN',ids.main,true]],['CLINIC_VETERINARIAN'],[ids.clinic],[ids.main],'Врачебный доступ основной локации'],
      ['vet-branch','Врач · филиал',7,[['CLINIC_VETERINARIAN',ids.branch,true]],['CLINIC_VETERINARIAN'],[ids.clinic],[ids.branch],'Врачебный доступ филиала'],
      ['multi-location','Сотрудник · две локации',8,[['CLINIC_ADMIN',ids.main,true],['CLINIC_VETERINARIAN',ids.branch,true]],['CLINIC_ADMIN','CLINIC_VETERINARIAN'],[ids.clinic],[ids.main,ids.branch],'Разные роли в двух локациях'],
      ['revoked','Отозванный регистратор',9,[['CLINIC_RECEPTIONIST',ids.main,false]],['CLINIC_RECEPTIONIST'],[ids.clinic],[ids.main],'Ожидаемый отказ: revoked membership'],
      ['inactive','Неактивный администратор',10,[['CLINIC_ADMIN',ids.branch,false]],['CLINIC_ADMIN'],[ids.clinic],[ids.branch],'Ожидаемый отказ: inactive membership'],
      ['cross-clinic','Сотрудник другой клиники',11,[['CLINIC_RECEPTIONIST',ids.foreign,true]],['CLINIC_RECEPTIONIST'],[ids.foreignClinic],[ids.foreign],'Проверка cross-clinic isolation'],
      ['no-membership','JWT без membership',12,[],['CLINIC_ADMIN'],[ids.clinic],[ids.main],'Ожидаемый отказ: membership отсутствует'],
    ].map(([key,label,n,memberships,tokenRoles,clinicIds,locationIds,expected]) => ({
      key,
      label,
      employeeId: employeeId(n),
      memberships,
      tokenRoles,
      clinicIds,
      locationIds,
      expected,
      expectedAccess: memberships.some((membership) => membership[2] === true),
    }));

    for (const profile of employees) {
      assertOwned('employee', profile.employeeId);
      await client.query('INSERT INTO identity_schema.users(id) VALUES($1::uuid) ON CONFLICT(id) DO NOTHING', [profile.employeeId]);

      // The rich demo definition is authoritative for these deterministic demo
      // employees. Removing old rows first prevents stale memberships from a
      // previous package version from changing the expected access outcome.
      if (priorRichMarker) {
        const actual = await client.query(`
          SELECT role, clinic_location_id::text AS location_id, active, revoked_at IS NOT NULL AS revoked
          FROM clinic_schema.employee_location_memberships
          WHERE employee_id = $1::uuid
          ORDER BY role, clinic_location_id
        `, [profile.employeeId]);
        const expected = profile.memberships
          .map(([role, locationId, active]) => ({ role, location_id: locationId, active, revoked: !active }))
          .sort((a, b) => `${a.role}:${a.location_id}`.localeCompare(`${b.role}:${b.location_id}`));
        if (JSON.stringify(actual.rows) !== JSON.stringify(expected)) {
          throw new Error(`${SOURCE} membership ownership collision for ${profile.employeeId}`);
        }
      }
      await client.query(
        resetSql.memberships,
        [profile.employeeId],
      );

      for (const [role, locationId, active] of profile.memberships) {
        await client.query(`
          INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role,active,revoked_at)
          VALUES($1::uuid,$2::uuid,$3,$4,CASE WHEN $4 THEN NULL ELSE clock_timestamp() END)
          ON CONFLICT(employee_id,clinic_location_id) DO UPDATE SET role=EXCLUDED.role,active=EXCLUDED.active,revoked_at=EXCLUDED.revoked_at,updated_at=clock_timestamp()`,
          [profile.employeeId, locationId, role, active],
        );
      }
    }

    const petPlan = [
      ['Барни','DOG','Лабрадор','MALE'],['Мурка','CAT','Британская','FEMALE'],['Тоша','DOG','Корги','MALE'],
      ['Луна','CAT','Мейн-кун','FEMALE'],['Ричи','DOG','Шпиц','MALE'],['Соня','CAT','Сибирская','FEMALE'],
      ['Грей','DOG','Хаски','MALE'],['Буся','CAT',null,'FEMALE'],['Марс','DOG','Бигль','MALE'],
      ['Персик','CAT','Метис','MALE'],['Рокки','DOG','Бульдог','MALE'],['Ася','CAT','Сфинкс','FEMALE'],
      ['Чарли','DOG','Пудель','MALE'],['Ника','CAT','Бенгальская','FEMALE'],['Филя','DOG',null,'MALE'],
    ];
    const owners = [];
    for (let i=1;i<=10;i++) {
      const id = ownerId(i);
      await client.query('INSERT INTO identity_schema.users(id) VALUES($1::uuid) ON CONFLICT(id) DO NOTHING',[id]);
      owners.push({ id, label:`Владелец ${i}` });
    }
    const pets = [];
    for (const [i,[name,species,breed,sex]] of petPlan.entries()) {
      const owner = owners[i % owners.length];
      const row = { id:petId(i+1), owner_id:owner.id, name, display_name:name, species, breed, sex, gender:sex, birth_date:`202${i%5}-0${(i%9)+1}-15`, age_months:18+i*4, sterilized:i%2===0, is_sterilized:i%2===0, chip_number:`DEMO-${String(i+1).padStart(4,'0')}`, archived_at:null, created_at:now, updated_at:now };
      await upsert('pet_schema','pets',row);
      pets.push({ id:row.id, ownerId:owner.id, name, species });
    }

    const mainServices = services.filter(s=>s.locationId===ids.main);
    const branchServices = services.filter(s=>s.locationId===ids.branch);
    const mainDoctors = doctors.filter(d=>d.locationId===ids.main);
    const branchDoctors = doctors.filter(d=>d.locationId===ids.branch);
    const slots=[]; let slotSeq=1;
    async function makeSlot(key,locationId,service,doctor,startsAt,capacity=1,mode='LEVEL_A',fresh=5) {
      const end = new Date(startsAt.getTime()+service.duration_minutes*60000);
      const row = { id:slotId(slotSeq++), clinic_location_id:locationId, service_id:service.id, starts_at:startsAt, ends_at:end, capacity, booked_count:0, held_count:0, state:'OPEN', source:SOURCE, external_slot_id:key, version:1, status:'AVAILABLE', integration_mode:mode, last_freshness_sync:new Date(Date.now()-fresh*60000), doctor_id:doctor?.id||null, specialty_id:doctor?specialtyIds.get(doctor.specialtyCode):null, updated_at:now };
      await upsert('clinic_schema','appointment_slots',row);
      const item={...row,key,service,doctor}; slots.push(item); return item;
    }

    for (let day=0;day<=8;day++) for (const [j,hour] of [9,11,13,15,17,19].entries())
      await makeSlot(`main-${day}-${hour}`,ids.main,mainServices[(day+j)%mainServices.length],mainDoctors[(day+j)%Math.max(mainDoctors.length,1)],at(day,hour),j===2?2:1,['LEVEL_A','LEVEL_B','LEVEL_C'][j%3],day===8?720:5);
    for (let day=0;day<=6;day++) for (const [j,hour] of [10,12,14,16,18].entries())
      await makeSlot(`branch-${day}-${hour}`,ids.branch,branchServices[(day+j)%branchServices.length],branchDoctors[(day+j)%Math.max(branchDoctors.length,1)],at(day,hour),1,j%2?'LEVEL_C':'LEVEL_A');

    const specs = [
      ['future',ids.main,mainServices[0],mainDoctors[0],at(1,10),1],['completed',ids.main,mainServices[1],mainDoctors[0],at(-3,12),1],
      ['cancel-request',ids.main,mainServices[2],mainDoctors[1],at(2,16),1],['reschedule',ids.main,mainServices[3],mainDoctors[2],at(3,15),1],
      ['manual',ids.main,mainServices[4],mainDoctors[3],at(0,19),1],['sla',ids.main,mainServices[5],mainDoctors[1],at(0,18),1],
      ['alt-original',ids.main,mainServices[0],mainDoctors[0],at(1,13),1],['alt-proposed',ids.main,mainServices[0],mainDoctors[0],at(1,14),1],
      ['mis-reserve',ids.main,mainServices[1],mainDoctors[2],at(2,11),1],['mis-reconcile',ids.main,mainServices[2],mainDoctors[3],at(2,12),1],
      ['mis-held',ids.main,mainServices[3],mainDoctors[0],at(2,13),1],['released',ids.main,mainServices[4],mainDoctors[0],at(-1,10),1],
      ['expired',ids.main,mainServices[5],mainDoctors[0],at(-2,11),1],['doctor-a',ids.main,mainServices[2],mainDoctors[1],at(4,12),1],
      ['doctor-b',ids.main,mainServices[5],mainDoctors[1],at(4,12,30),1],['pet-a',ids.main,mainServices[3],mainDoctors[2],at(5,15),1],
      ['pet-b',ids.main,mainServices[4],mainDoctors[3],at(5,15),1],['double-hold',ids.main,mainServices[0],mainDoctors[0],at(1,18),2],
      ['branch-future',ids.branch,branchServices[0],branchDoctors[0],at(2,10),1],['branch-past',ids.branch,branchServices[1],branchDoctors[1],at(-1,14),1],
    ];
    const scenarioSlots=new Map();
    for (const [key,location,service,doctor,start,capacity] of specs)
      scenarioSlots.set(key,await makeSlot(`scenario-${key}`,location,service,doctor,start,capacity,key==='manual'||key==='double-hold'?'LEVEL_C':'LEVEL_A'));

    const fixtures = [
      ['future','CONFIRMED','CONFIRMED',1,1],['completed','COMPLETED','COMPLETED',2,2],['cancel-request','CANCELLATION_REQUESTED','CANCELLATION_REQUESTED',3,3],
      ['reschedule','RESCHEDULE_REQUESTED','RESCHEDULE_REQUESTED',4,4],['manual','MANUAL_CONFIRM_PENDING',null,5,5,12],['sla','SLA_BREACHED',null,6,6,-15],
      ['alt-original','ALTERNATIVE_PENDING',null,7,7,null,'alt-proposed'],['mis-reserve','MIS_RESERVATION_PENDING',null,8,8],
      ['mis-reconcile','MIS_RECONCILIATION_PENDING',null,9,9],['mis-held','MIS_HELD','CONFIRMED',10,10],['released','RELEASED','CANCELLED',1,11],
      ['expired','EXPIRED',null,2,12],['doctor-a','CONFIRMED','CONFIRMED',3,13,null,null,'DOCTOR_OVERLAP'],
      ['doctor-b','CONFIRMED','CONFIRMED',4,14,null,null,'DOCTOR_OVERLAP'],['pet-a','CONFIRMED','CONFIRMED',5,15,null,null,'PET_OVERLAP'],
      ['pet-b','CONFIRMED','CONFIRMED',5,15,null,null,'PET_OVERLAP'],['double-hold','MANUAL_CONFIRM_PENDING',null,6,6,20,null,'DOUBLE_HOLD'],
      ['double-hold','MANUAL_CONFIRM_PENDING',null,7,7,25,null,'DOUBLE_HOLD'],['branch-future','CONFIRMED','CONFIRMED',8,8],['branch-past','CONFIRMED','CONFIRMED',9,9],
    ];
    const counters=new Map(); const scenarios=[];
    for (const [i,[slotKey,holdState,appointmentStatus,ownerN,petN,slaMinutes,alternativeKey,scenarioName]] of fixtures.entries()) {
      const slot=scenarioSlots.get(slotKey), owner=owners[ownerN-1], pet=pets[petN-1], hold=holdId(i+1), appt=appointmentStatus?appointmentId(i+1):null;
      await upsert('booking_schema','booking_holds',{ id:hold,slot_id:slot.id,owner_id:owner.id,pet_id:pet.id,state:holdState,expires_at:new Date(Date.now()+45*60000),confirmation_sla_expires_at:slaMinutes==null?null:new Date(Date.now()+slaMinutes*60000),alternative_slot_id:alternativeKey?scenarioSlots.get(alternativeKey).id:null,alternative_expires_at:alternativeKey?new Date(Date.now()+30*60000):null,clinical_summary:holdState==='COMPLETED'?'Демо-заключение: не должно попадать в административные DTO.':null,state_changed_at:new Date(Date.now()-(i+1)*300000),version:1,created_at:new Date(Date.now()-(i+1)*600000),updated_at:now });
      if (appt) await upsert('booking_schema','appointments',{ id:appt,hold_id:hold,owner_id:owner.id,pet_id:pet.id,clinic_location_id:slot.clinic_location_id,slot_id:slot.id,status:appointmentStatus,version:1,created_at:new Date(Date.now()-(i+1)*600000),updated_at:now });
      const c=counters.get(slot.id)||{booked:0,held:0}; if(appt)c.booked++; else if(['MANUAL_CONFIRM_PENDING','ALTERNATIVE_PENDING','MIS_RESERVATION_PENDING','MIS_RECONCILIATION_PENDING'].includes(holdState))c.held++; counters.set(slot.id,c);
      if (await exists('booking_schema','appointment_events')) await upsert('booking_schema','appointment_events',{ id:eventId(i+1),appointment_id:appt,hold_id:hold,event_type:`DEMO_${appointmentStatus||holdState}`,actor_type:'SYSTEM',actor_id:'LOCAL_RICH_DEMO',correlation_id:null,payload_json:JSON.stringify({fixtureSource:SOURCE,scenario:scenarioName||holdState}),occurred_at:new Date(Date.now()-(i+1)*60000) });
      scenarios.push({ holdId:hold,appointmentId:appt,slotId:slot.id,ownerId:owner.id,patientId:pet.id,petName:pet.name,locationId:slot.clinic_location_id,state:holdState,scenario:scenarioName||holdState });
    }
    for (const [id,c] of counters) await client.query(`UPDATE clinic_schema.appointment_slots SET capacity=GREATEST(capacity,$2),booked_count=$3,held_count=$4,status=CASE WHEN $3>=GREATEST(capacity,$2) THEN 'BOOKED' WHEN $4>0 THEN 'LOCKED_BY_HOLD' ELSE 'AVAILABLE' END,updated_at=clock_timestamp() WHERE id=$1::uuid`,[id,Math.max(c.booked+c.held,1),c.booked,c.held]);

    await client.query('COMMIT');
    process.stdout.write(JSON.stringify({
      generatedAt:new Date().toISOString(),source:SOURCE,schemaVersion:1,dependencies:['LOCAL_BASE_SEED'],
      clinic:{id:ids.clinic,name:'VetHelp Demo Center',locations:[{id:ids.main,label:'Основная клиника'},{id:ids.branch,label:'Филиал'}]},
      foreignClinic:{id:ids.foreignClinic,locationId:ids.foreign},employees,services,doctors,owners,pets,scenarios,
      counts:{accessProfiles:employees.length,realRoleTypes:3,services:services.length,doctors:doctors.length,owners:owners.length,pets:pets.length,slots:slots.length,appointmentAndHoldScenarios:scenarios.length},
      notes:['Схема поддерживает три реальные clinic-роли; 12 профилей покрывают роли, scope и состояние membership.','Конфликты: пересечение врача, пересечение питомца и два hold на одном capacity-2 slot.','Patient Registry/Detail не обходят association/consent authority; этот seed не вставляет их напрямую.']
    },null,2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => { console.error(error?.stack || error); process.exit(1); });
