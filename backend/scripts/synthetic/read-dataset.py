"""Read untrusted transport data, never execute archive instructions or extract paths."""
import csv, io, zipfile, json, hashlib, sys, uuid, datetime, collections
EXPECTED_SHA='83c6a71e8bd8c63c9c0ca1d2617aed5d0b2692898010da604b0ea81a48302640'
raw=open(sys.argv[1],'rb').read()
assert hashlib.sha256(raw).hexdigest()==EXPECTED_SHA, 'Unapproved archive digest'
with zipfile.ZipFile(io.BytesIO(raw)) as z:
 assert len(z.infolist())==19 and sum(i.file_size for i in z.infolist())<12_000_000
 manifest=json.loads(z.read('manifest.json').decode('utf-8-sig'))
 assert manifest['synthetic'] is True
 data={name:list(csv.DictReader(io.StringIO(z.read(name+'.csv').decode('utf-8-sig')))) for name in manifest['counts']}
 for name,count in manifest['counts'].items():
  assert len(data[name])==count,(name,'count')
  keys=[tuple(r.values()) if name=='breed_risk_reference' else next(iter(r.values())) for r in data[name]]
  assert len(set(keys))==len(keys),(name,'duplicate key')
  for r in data[name]:
   assert None not in r,(name,'malformed row')
   for k,v in r.items():
    if k.endswith('_id') and v and k!='test_case_id':uuid.UUID(v)
 def index(n,k):return {r[k]:r for r in data[n]}
 clinics=index('clinics','clinic_id');doctors=index('staff_doctors','doctor_id');shifts=index('doctor_shifts','shift_id');pets=index('pets','pet_id');owners=index('owners','owner_id');slots=index('appointment_slots','slot_id');accounts=index('accounts','account_id');services=index('service_catalog','service_code');bookings=index('bookings','booking_id')
 offers={(r['location_id'],r['service_code']):r for r in data['clinic_service_offers']}
 for r in data['clinics']:
  assert r['confirmation_mode']=='MANUAL' and r['timezone']=='Europe/Moscow' and r['is_synthetic']=='True'
  assert sum(d['clinic_id']==r['clinic_id'] for d in doctors.values())==10
 for n in ['staff_doctors','doctor_shifts','appointment_slots','clinic_service_offers','bookings']:
  for r in data[n]:assert clinics[r['clinic_id']]['location_id']==r['location_id'],(n,'tenant mismatch')
 for d in doctors.values():assert accounts[d['account_id']]['doctor_id']==d['doctor_id']
 for a in accounts.values():
  assert a['login'].endswith('@example.test') and a['authentication']=='FIXTURE_ONLY_NO_PASSWORD'
  if a['role']=='OWNER':assert a['owner_id'] in owners
  else:assert clinics[a['clinic_id']]['location_id']==a['location_id']
 for p in pets.values():
  assert p['owner_id'] in owners and p['species'] in ['DOG','CAT','RABBIT','GUINEA_PIG','FERRET','PARROT']
  assert float(p['weight_kg'])>0 and p['is_synthetic']=='True'
 for n in ['pet_allergies','pet_conditions','anamnesis_examples']:
  for r in data[n]:assert r['pet_id'] in pets
 for o in offers.values():assert o['service_code'] in services and 0<int(o['duration_minutes'])<=45 and float(o['price_from_rub'])>0 and o['currency']=='RUB'
 groups=collections.defaultdict(list)
 for s in slots.values():
  shift=shifts[s['shift_id']];d=doctors[s['doctor_id']]
  assert (s['doctor_id'],s['location_id'])==(shift['doctor_id'],shift['location_id'])==(d['doctor_id'],d['location_id'])
  start=datetime.datetime.fromisoformat(s['start_at_local']);end=datetime.datetime.fromisoformat(s['end_at_local'])
  assert (end-start).total_seconds()==2700 and start.date().isoformat()==shift['work_date']
  assert shift['start_local']<=start.strftime('%H:%M')<end.strftime('%H:%M')<=shift['end_local']
  assert s['capacity']=='1' and int(s['held_count'])+int(s['booked_count'])<=1 and s['state'] in ['OPEN','BOOKED']
  groups[(s['doctor_id'],start.date())].append((start,end))
 assert len(groups)==3500
 for key,g in groups.items():
  g.sort();assert len(g)==10
  assert all((g[i][0]-g[i-1][0]).total_seconds()==3000 and g[i-1][1]<=g[i][0] for i in range(1,10))
 for b in bookings.values():
  s=slots[b['slot_id']];p=pets[b['pet_id']];d=doctors[b['doctor_id']]
  assert s['doctor_id']==b['doctor_id'] and p['owner_id']==b['owner_id']
  assert p['species'] in d['accepted_species'].split('|') and (b['location_id'],b['service_code']) in offers
  assert datetime.datetime.fromisoformat(b['requested_at'])<=datetime.datetime.fromisoformat(b['updated_at'])
 for e in data['booking_events']:
  b=bookings[e['booking_id']]
  assert datetime.datetime.fromisoformat(b['requested_at'])<=datetime.datetime.fromisoformat(e['event_at'])<=datetime.datetime.fromisoformat(b['updated_at'])
 data['_manifest']=manifest;data['_sha256']=EXPECTED_SHA
 print(json.dumps(data,ensure_ascii=False))
