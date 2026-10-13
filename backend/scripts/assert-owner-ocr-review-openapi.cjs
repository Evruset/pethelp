const assert=require('node:assert/strict');
const d=require('../artifacts/openapi/swagger.json');
const base='/v1/owner/pets/{petId}/documents/{documentId}/ocr/candidates/{candidateId}/review';
const ops=[d.paths[base].get,...['start','corrections','confirm','reject'].map(x=>d.paths[base+'/'+x].post)];
for(const [i,op] of ops.entries()){
 assert.ok(op.security.some(x=>'bearerAuth'in x));
 for(const status of [400,403,404,409]) assert.ok(op.responses[status]);
 const response=op.responses[200].content['application/json'].schema;
 assert.equal(response.additionalProperties,false);assert.deepEqual(response.properties.authority.enum,['OWNER_DECISION_ONLY']);
 assert.deepEqual(response.properties.sourceByteIntegrity.enum,['DEFERRED_BLOCKING_VALIDATED_IMPORT']);
 assert.deepEqual(response.properties.reviewState.enum,['PENDING_OWNER_REVIEW','IN_REVIEW','CONFIRMED','REJECTED']);
 assert.equal(response.properties.revision.type,'integer');assert.equal(response.properties.text.maxLength,32768);
 assert.ok(!JSON.stringify(response).match(/storage_key|lease_token|claim_token|payload_identity|medicalHistory|diagnosis/));
 if(i){for(const name of ['If-Match','Idempotency-Key']) assert.ok(op.parameters.some(p=>p.name===name&&p.in==='header'&&p.required));const body=op.requestBody.content['application/json'].schema;assert.equal(body.additionalProperties,false);assert.deepEqual(Object.keys(body.properties),i===2?['text']:[]);}
 else assert.equal(response.properties.history.maxItems,20);
}
console.log('Owner OCR review OpenAPI authority/revision/closed-scope PASS (5 operations)');
