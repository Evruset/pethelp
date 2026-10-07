const assert = require('node:assert/strict');
const test = require('node:test');
const { parseClinicAppointmentDetail, ClinicAppointmentsResponseError } = require(process.env.APPOINTMENT_DETAIL_PARSER_MODULE);
const clinicId='81111111-1111-4111-8111-111111111111',locationId='82222222-2222-4222-8222-222222222222',appointmentId='83333333-3333-4333-8333-333333333333';
const expected={clinicId,locationId,appointmentId};
function payload(){return {clinicId,locationId,serverNow:'2026-10-07T09:00:00Z',appointment:{appointmentId,aggregateVersion:1,statusCode:'SCHEDULED',createdAt:'2026-10-06T09:00:00Z'},schedule:{startsAt:'2026-10-08T09:00:00Z',endsAt:'2026-10-08T09:30:00Z',timezone:'Europe/Moscow',sourceLabel:'Вручную'},owner:{displayName:null,phone:'+15551234567'},pet:{id:appointmentId,displayName:'Барни',speciesLabel:'Собака',breed:'Бигль'},service:null,veterinarian:null,resource:null,availableActions:[]};}
test('BP-11 retains authoritative contact/breed and does not fabricate owner name',()=>{
  const parsed=parseClinicAppointmentDetail(payload(),expected);
  assert.deepEqual(parsed.owner,{displayName:null,phone:'+15551234567'});assert.equal(parsed.pet.breed,'Бигль');
});
test('BP-11 null contact/breed and legacy projection remain readable',()=>{
  const p=payload();p.owner=null;delete p.pet.breed;
  const parsed=parseClinicAppointmentDetail(p,expected);assert.equal(parsed.owner,null);assert.equal(parsed.pet.breed,null);
  p.owner={displayName:null,phone:null};assert.deepEqual(parseClinicAppointmentDetail(p,expected).owner,p.owner);
});
test('BP-11 malformed phone, owner name and breed fail closed',()=>{
  for(const value of [123,'unknown','+7-private']){const p=payload();p.owner.phone=value;assert.throws(()=>parseClinicAppointmentDetail(p,expected),ClinicAppointmentsResponseError);}
  const p=payload();p.owner.displayName=123;assert.throws(()=>parseClinicAppointmentDetail(p,expected),ClinicAppointmentsResponseError);
  const breed=payload();breed.pet.breed={medical:'secret'};assert.throws(()=>parseClinicAppointmentDetail(breed,expected),ClinicAppointmentsResponseError);
});
test('BP-11 parser never forwards unknown medical/storage fields',()=>{
  const p=payload();p.clinicalSummary='private';p.owner.storageUrl='private';p.pet.medicalHistory='private';
  assert.doesNotMatch(JSON.stringify(parseClinicAppointmentDetail(p,expected)),/private|clinicalSummary|storageUrl|medicalHistory/);
});
