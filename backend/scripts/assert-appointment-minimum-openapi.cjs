const assert = require('node:assert/strict');
const document = require('../artifacts/openapi/swagger.json');
const schemas = document.components.schemas;
for (const name of ['ClinicAppointmentDetailDto','ClinicAppointmentDetailAppointmentDto','ClinicAppointmentDetailScheduleDto','ClinicAppointmentDetailOwnerDto','ClinicAppointmentDetailPetDto','ClinicAppointmentDetailDisplayNameDto']) {
  assert.equal(schemas[name].additionalProperties, false, `${name} must be closed`);
}
assert.deepEqual(Object.keys(schemas.ClinicAppointmentDetailOwnerDto.properties).sort(), ['displayName','phone']);
assert.equal(schemas.ClinicAppointmentDetailOwnerDto.properties.displayName.nullable, true);
assert.equal(schemas.ClinicAppointmentDetailOwnerDto.properties.phone.nullable, true);
assert.equal(schemas.ClinicAppointmentDetailPetDto.properties.breed.nullable, true);
assert.deepEqual(Object.keys(schemas.ClinicAppointmentDetailDto.properties).sort(), ['clinicId','locationId','serverNow','appointment','schedule','owner','pet','service','veterinarian','resource','availableActions'].sort());
const operation = document.paths['/v1/clinic/{clinicId}/locations/{locationId}/appointments/{appointmentId}'].get;
assert.ok(operation.security.some(value => 'bearerAuth' in value));
console.log('BP-11 closed minimum OpenAPI contract PASS');
