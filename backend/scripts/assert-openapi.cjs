const { readFile } = require('node:fs/promises');

const required = (value, message) => {
  if (!value) throw new Error(message);
};

async function main() {
  const path = process.argv[2] ?? 'artifacts/openapi/swagger.json';
  const document = JSON.parse(await readFile(path, 'utf8'));

  const createHold = document.paths?.['/v1/booking-holds']?.post;
  required(createHold, 'POST /v1/booking-holds is missing');
  required(createHold.security?.some((item) => item.bearerAuth), 'Create hold must require bearerAuth');
  required(createHold.responses?.['201'], 'Create hold must document 201');
  required(createHold.responses?.['422'], 'Create hold must document 422');
  required(createHold.responses?.['409'], 'Create hold must document 409');

  const confirmHold = document.paths?.['/v1/clinic/booking-holds/{holdId}/confirm']?.post;
  required(confirmHold, 'POST /v1/clinic/booking-holds/{holdId}/confirm is missing');
  required(confirmHold.security?.some((item) => item.bearerAuth), 'Confirm hold must require bearerAuth');
  required(confirmHold.responses?.['200'], 'Confirm hold must document 200');
  required(confirmHold.responses?.['403'], 'Confirm hold must document 403');

  const manualQueue = document.paths?.['/v1/clinic/{clinicId}/locations/{locationId}/booking-queue']?.get;
  required(manualQueue, 'GET Level-C manual confirmation queue is missing');
  required(manualQueue.security?.some((item) => item.bearerAuth), 'Manual queue must require bearerAuth');
  required(manualQueue.responses?.['200'], 'Manual queue must document 200');
  required(manualQueue.responses?.['403'], 'Manual queue must document 403');

  const completeVisit = document.paths?.['/v1/clinic/booking-holds/{holdId}/complete']?.post;
  required(completeVisit, 'POST /v1/clinic/booking-holds/{holdId}/complete is missing');
  required(completeVisit.security?.some((item) => item.bearerAuth), 'Complete visit must require bearerAuth');
  required(completeVisit.responses?.['403'], 'Complete visit must document 403');
  required(
    completeVisit['x-required-capabilities']?.length === 1
      && completeVisit['x-required-capabilities'][0] === 'clinical.visit.complete',
    'Complete visit must require only clinical.visit.complete',
  );

  const alternativeSnapshot = document.paths?.['/v1/booking-holds/{holdId}/alternative']?.get;
  required(alternativeSnapshot, 'GET owner alternative slot snapshot is missing');
  required(alternativeSnapshot.security?.some((item) => item.bearerAuth), 'Alternative snapshot must require bearerAuth');
  required(alternativeSnapshot.responses?.['200'], 'Alternative snapshot must document 200');
  required(alternativeSnapshot.responses?.['404'], 'Alternative snapshot must document 404');

  const telemedWaiting = document.paths?.['/v1/telemed/sessions/{sessionId}']?.get;
  required(telemedWaiting, 'GET owner telemed waiting snapshot is missing');
  required(telemedWaiting.security?.some((item) => item.bearerAuth), 'Telemed waiting snapshot must require bearerAuth');
  required(telemedWaiting.responses?.['200'], 'Telemed waiting snapshot must document 200');
  required(telemedWaiting.responses?.['404'], 'Telemed waiting snapshot must document 404');

  const workspaceHome = document.paths?.['/v1/clinic/{clinicId}/locations/{locationId}/workspace-home']?.get;
  required(workspaceHome, 'GET Clinic Workspace Home is missing');
  required(workspaceHome.security?.some((item) => item.bearerAuth), 'Workspace Home must require bearerAuth');
  required(['clinicId', 'locationId'].every((name) => workspaceHome.parameters?.some((parameter) => parameter.in === 'path' && parameter.name === name && parameter.required)), 'Workspace Home must require both path parameters');
  required(['200', '400', '401', '403', '500'].every((status) => workspaceHome.responses?.[status]), 'Workspace Home response matrix is incomplete');
  required(/private, no-store/i.test(workspaceHome.description ?? '') && /No ETag/i.test(workspaceHome.description ?? ''), 'Workspace Home cache policy is not documented');
  const schemas = document.components?.schemas ?? {};
  const home = schemas.ClinicWorkspaceHomeDto;
  required(home?.properties?.sections?.minItems === 5 && home.properties.sections.maxItems === 5, 'Workspace Home must expose a fixed five-section tuple');
  required(home.properties.sections.description === 'Canonical order: QUEUE, SCHEDULE, APPOINTMENTS, VETERINARIAN, QUALITY.', 'Workspace Home canonical tuple order is missing');
  required(schemas.WorkspaceFreshnessDto?.properties?.state?.enum?.join() === 'FRESH', 'Workspace Home freshness enum must be closed to FRESH');
  required(schemas.QueueAvailableSectionDto?.properties?.kind?.enum?.join() === 'QUEUE', 'Only Queue may use the Queue available schema');
  required(schemas.AppointmentsAvailableSectionDto?.properties?.kind?.enum?.join() === 'APPOINTMENTS', 'Only Appointments may use the Appointments available schema');
  for (const [name, kind] of [['ScheduleUnavailableSectionDto', 'SCHEDULE'], ['VeterinarianUnavailableSectionDto', 'VETERINARIAN'], ['QualityUnavailableSectionDto', 'QUALITY']]) {
    const schema = schemas[name];
    required(schema?.properties?.kind?.enum?.join() === kind, `${kind} unavailable schema is missing`);
    required(schema.properties.availability.enum.every((value) => ['NOT_AUTHORIZED', 'NOT_CONFIGURED'].includes(value)), `${kind} must be unavailable-only`);
    required(!schema.properties.facts && !schema.properties.action && schema.additionalProperties !== true, `${kind} must not expose facts or action`);
  }
  const serializedHomeSchemas = JSON.stringify(Object.fromEntries(Object.entries(schemas).filter(([name]) => /Workspace|QueueAvailable|AppointmentsAvailable/.test(name))));
  required(!/(ownerId|patientId|petId|holdId|appointmentId|doctorId|employeeId|actorId|documentId|audit|payment|clinical|https?:\\\/\\\/)/i.test(serializedHomeSchemas), 'Workspace Home schema leaks identifiers or arbitrary URLs');

  required(document.components?.securitySchemes?.bearerAuth, 'Bearer security scheme is missing');
  console.log('OpenAPI contract assertion passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
