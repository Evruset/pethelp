const assert=require('node:assert/strict');
const document=require('../artifacts/openapi/swagger.json');
const path='/v1/clinic/appointments/{appointmentId}/medical-shares';
const list=document.paths[path].get,read=document.paths[`${path}/resources/{resourceType}/{resourceId}`].get;
const schema=operation=>operation.responses['200'].content['application/json'].schema;
function closed(value,fields){assert.equal(value.additionalProperties,false);assert.deepEqual(Object.keys(value.properties).sort(),fields.slice().sort());assert.deepEqual(value.required.slice().sort(),fields.slice().sort());}
for(const operation of [list,read]){
  assert.ok(operation.security.some(value=>'bearerAuth' in value));
  for(const status of ['400','401','403','404','500'])assert.equal(operation.responses[status].content['application/json'].schema.$ref,'#/components/schemas/ApiErrorDto');
  assert.ok(operation.parameters.some(value=>value.name==='appointmentId'&&value.in==='path'&&value.required));
}
closed(schema(list),['appointmentId','status','resources']);closed(schema(list).properties.resources.items,['type','id']);
assert.deepEqual(schema(list).properties.status.enum,['SHARED','NOT_SHARED']);
for(const [type,fields] of [['RESULT',['type','id','content','publishedAt']],['AMENDMENT',['type','id','content','publishedAt','version']],['DOCUMENT',['type','id','fileName','mimeType','createdAt']]])closed(schema(read).oneOf.find(value=>value.properties.type.enum.includes(type)),fields);
const detail=document.paths['/v1/clinic/{clinicId}/locations/{locationId}/vet/visits/{holdId}'].get;
closed(schema(detail),['holdId','clinicId','locationId','scheduledStart','scheduledEnd','status','petDisplayName','species','visitId','appointmentId']);
assert.equal(schema(detail).properties.appointmentId.format,'uuid');
console.log('Clinic shared read model closed OpenAPI contract PASS (Document metadata only)');
