const assert = require('node:assert/strict');
const document = require('../artifacts/openapi/swagger.json');
const path = '/v1/owner/appointments/{appointmentId}/medical-shares';
const context = document.paths[path].get;
const create = document.paths[path].post;
const revoke = document.paths[`${path}/{shareId}/revoke`].post;
const response = (operation, status) => operation.responses[status].content['application/json'].schema;
function closed(schema, fields) {
  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(schema.properties).sort(), [...fields].sort());
  assert.deepEqual([...schema.required].sort(), [...fields].sort());
}
function resource(schema) {
  closed(schema, ['type','id']);
  assert.deepEqual(schema.properties.type.enum, ['RESULT','AMENDMENT','DOCUMENT']);
  assert.equal(schema.properties.id.format, 'uuid');
}
function share(schema) {
  closed(schema, ['id','appointmentId','petId','clinicId','locationId','status','version','createdAt','revokedAt','resources']);
  assert.deepEqual(schema.properties.status.enum, ['ACTIVE','REVOKED']);
  resource(schema.properties.resources.items);
}
for (const operation of [context,create,revoke]) {
  assert.ok(operation.security.some(value => 'bearerAuth' in value));
  for (const code of ['400','401','403','404','409','500']) {
    assert.equal(response(operation, code).$ref, '#/components/schemas/ApiErrorDto');
  }
}
const schema = response(context, '200');
closed(schema, ['appointmentId','petId','clinicId','locationId','eligible','resources','resourcesTruncated','shares','clinic','pet','appointment','resourceDetails']);
closed(schema.properties.clinic, ['displayName','locationAddress']);
closed(schema.properties.pet, ['displayName']);
closed(schema.properties.appointment, ['startsAt','endsAt','timezone']);
closed(schema.properties.resourceDetails.items, ['type','id','label','createdAt']);
resource(schema.properties.resources.items);
share(schema.properties.shares.items);
share(response(create, '201'));
share(response(revoke, '200'));
for (const operation of [create,revoke]) {
  for (const name of ['Idempotency-Key','X-Correlation-ID']) {
    assert.ok(operation.parameters.some(parameter => parameter.in === 'header' && parameter.name === name && parameter.required));
  }
}
assert.ok(revoke.parameters.some(parameter => parameter.name === 'If-Match' && parameter.required));
const selection = create.requestBody.content['application/json'].schema.oneOf.find(value => value.properties.mode.enum.includes('SELECTED'));
closed(selection, ['mode','resources']);
resource(selection.properties.resources.items);
assert.equal(selection.properties.resources.minItems, 1);
assert.equal(selection.properties.resources.maxItems, 200);
const revokeBody = revoke.requestBody.content['application/json'].schema;
assert.equal(revokeBody.additionalProperties, false);
assert.equal(revokeBody.maxProperties, 0);
console.log('Owner medical sharing closed OpenAPI contract PASS');
