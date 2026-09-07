const { readFile } = require('node:fs/promises');

const required = (value, message) => {
  if (!value) throw new Error(message);
};

async function main() {
  const path = process.argv[2] ?? 'artifacts/openapi/swagger.json';
  const document = JSON.parse(await readFile(path, 'utf8'));
  const responseSchemaRef = (operation, status) => operation?.responses?.[status]?.content?.['application/json']?.schema?.$ref;
  const requireStatuses = (operation, statuses, label) => {
    required(statuses.every((status) => operation?.responses?.[status]), `${label} response matrix is incomplete`);
  };
  const requireErrorSchemas = (operation, statuses, label) => {
    for (const status of statuses) {
      required(responseSchemaRef(operation, status) === '#/components/schemas/ApiErrorDto', `${label} ${status} must use ApiErrorDto`);
    }
  };
  const requireOptionalCorrelation = (operation, label) => {
    const header = operation?.parameters?.find((parameter) => parameter.in === 'header' && parameter.name.toLowerCase() === 'x-correlation-id');
    required(header && header.required === false, `${label} must accept an optional client correlation header`);
  };
  const requireBearerAuth = (operation, label) => {
    required(document.components?.securitySchemes?.bearerAuth, 'bearerAuth security scheme is missing');
    required(operation?.security?.some((item) => Object.hasOwn(item, 'bearerAuth')), `${label} must reference the defined bearerAuth scheme`);
  };

  const operations = [];
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      required(operation.operationId, `${method.toUpperCase()} ${route} has no operationId`);
      const parameterKeys = (operation.parameters ?? [])
        .filter((parameter) => !parameter.$ref)
        .map((parameter) => `${parameter.in}:${parameter.name.toLowerCase()}`);
      const duplicateParameters = parameterKeys.filter((value, index) => parameterKeys.indexOf(value) !== index);
      required(duplicateParameters.length === 0, `${method.toUpperCase()} ${route} has duplicate parameters: ${duplicateParameters.join(', ')}`);
      operations.push({ operationId: operation.operationId, method, route });
    }
  }
  const operationIds = operations.map(({ operationId }) => operationId);
  const duplicates = [...new Set(operationIds.filter((value, index) => operationIds.indexOf(value) !== index))];
  required(duplicates.length === 0, `Duplicate operationId values: ${duplicates.join(', ')}`);

  const createHold = document.paths?.['/v1/booking-holds']?.post;
  required(createHold, 'POST /v1/booking-holds is missing');
  required(createHold.security?.some((item) => item.bearerAuth), 'Create hold must require bearerAuth');
  required(createHold.responses?.['201'], 'Create hold must document 201');
  required(createHold.responses?.['422'], 'Create hold must document 422');
  required(createHold.responses?.['409'], 'Create hold must document 409');
  requireStatuses(createHold, ['201', '400', '401', '403', '404', '409', '422', '500', '503'], 'Create hold');
  requireErrorSchemas(createHold, ['400', '401', '403', '404', '409', '422', '500', '503'], 'Create hold');
  requireOptionalCorrelation(createHold, 'Create hold');
  required(responseSchemaRef(createHold, '201') === '#/components/schemas/HoldDto', 'Create hold must return HoldDto');
  required(createHold.responses?.['409']?.description?.includes('BOOKING_STATE_CONFLICT') && createHold.responses?.['409']?.description?.includes('IDEMPOTENCY_CONFLICT'), 'Create hold must advertise canonical Pilot conflict codes');
  required(!/IDEMPOTENCY_PAYLOAD_CONFLICT|SLOT_VERSION_STALE/.test(JSON.stringify(createHold)), 'Create hold must not advertise legacy conflict codes');
  const createBodySchema = createHold.requestBody?.content?.['application/json']?.schema?.$ref;
  const createBodyName = createBodySchema?.split('/').pop();
  const createBody = createBodyName
    ? document.components?.schemas?.[createBodyName]
    : createHold.requestBody?.content?.['application/json']?.schema;
  required(createBody?.additionalProperties === false, 'Create hold request must be closed');
  required(['slotId', 'petId', 'clinicId', 'locationId', 'serviceId', 'expectedSlotVersion'].every((field) => createBody?.required?.includes(field)), 'Create hold authority fields are incomplete');
  required(createBody?.properties?.expectedSlotVersion?.type === 'integer' && createBody.properties.expectedSlotVersion.minimum === 1, 'Create hold expectedSlotVersion must be a positive integer');
  required(!createBody?.properties?.doctorId, 'PILOT_V1 create hold must not expose doctorId');

  const getHold = document.paths?.['/v1/booking-holds/{holdId}']?.get;
  required(getHold, 'GET /v1/booking-holds/{holdId} is missing');
  requireStatuses(getHold, ['200', '400', '401', '403', '404', '500'], 'Get hold');
  requireErrorSchemas(getHold, ['400', '401', '403', '404', '500'], 'Get hold');
  required(responseSchemaRef(getHold, '200') === '#/components/schemas/BookingHoldReadDto', 'Get hold must return BookingHoldReadDto');

  const requestOtp = document.paths?.['/v1/auth/otp/request']?.post;
  const resendOtp = document.paths?.['/v1/auth/otp/resend']?.post;
  const verifyOtp = document.paths?.['/v1/auth/otp/verify']?.post;
  const effectiveSession = document.paths?.['/v1/auth/session']?.get;
  const logoutSession = document.paths?.['/v1/auth/logout']?.post;
  required(requestOtp && resendOtp && verifyOtp && effectiveSession && logoutSession, 'Owner OTP/session operation set is incomplete');
  requireStatuses(requestOtp, ['200', '400', '429', '500', '503'], 'Request OTP');
  requireStatuses(resendOtp, ['200', '404', '409', '429', '500', '503'], 'Resend OTP');
  requireStatuses(verifyOtp, ['200', '400', '401', '404', '409', '410', '500'], 'Verify OTP');
  requireStatuses(effectiveSession, ['200', '401', '500'], 'Effective session');
  requireStatuses(logoutSession, ['204'], 'Logout session');
  requireBearerAuth(effectiveSession, 'Effective session');
  requireBearerAuth(logoutSession, 'Logout session');
  for (const [operation, statuses, label] of [
    [requestOtp, ['400', '429', '500', '503'], 'Request OTP'],
    [resendOtp, ['404', '409', '429', '500', '503'], 'Resend OTP'],
    [verifyOtp, ['400', '401', '404', '409', '410', '500'], 'Verify OTP'],
    [effectiveSession, ['401', '500'], 'Effective session'],
  ]) {
    for (const status of statuses) required(responseSchemaRef(operation, status) === '#/components/schemas/AuthErrorDto', `${label} ${status} must use AuthErrorDto`);
  }
  required(responseSchemaRef(requestOtp, '200') === '#/components/schemas/OwnerOtpChallengeDto', 'Request OTP must return authoritative challenge timestamps');
  required(responseSchemaRef(resendOtp, '200') === '#/components/schemas/OwnerOtpChallengeDto', 'Resend OTP must return authoritative challenge timestamps');
  required(responseSchemaRef(verifyOtp, '200') === '#/components/schemas/OwnerSessionDto', 'Verify OTP must return opaque session DTO');
  required(responseSchemaRef(effectiveSession, '200') === '#/components/schemas/EffectiveOwnerSessionDto', 'Effective session must return typed server authority');
  required(!document.paths?.['/v1/auth/refresh'], 'First-MVP public auth contract must not advertise JWT/refresh machinery');

  const confirmHold = document.paths?.['/v1/clinic/booking-holds/{holdId}/confirm']?.post;
  required(confirmHold, 'POST /v1/clinic/booking-holds/{holdId}/confirm is missing');
  required(confirmHold.security?.some((item) => item.bearerAuth), 'Confirm hold must require bearerAuth');
  required(confirmHold.responses?.['200'], 'Confirm hold must document 200');
  required(confirmHold.responses?.['403'], 'Confirm hold must document 403');
  requireStatuses(confirmHold, ['200', '400', '401', '403', '404', '409', '422', '500'], 'Confirm hold');
  requireErrorSchemas(confirmHold, ['400', '401', '403', '404', '409', '422', '500'], 'Confirm hold');
  requireOptionalCorrelation(confirmHold, 'Confirm hold');
  required(responseSchemaRef(confirmHold, '200') === '#/components/schemas/BookingCommandStatusDto', 'Confirm hold must return BookingCommandStatusDto');

  const declineHold = document.paths?.['/v1/clinic/booking-holds/{holdId}/decline']?.post;
  required(declineHold, 'POST /v1/clinic/booking-holds/{holdId}/decline is missing');
  requireStatuses(declineHold, ['200', '400', '401', '403', '404', '409', '422', '500'], 'Decline hold');
  requireErrorSchemas(declineHold, ['400', '401', '403', '404', '409', '422', '500'], 'Decline hold');
  requireOptionalCorrelation(declineHold, 'Decline hold');
  required(responseSchemaRef(declineHold, '200') === '#/components/schemas/BookingCommandStatusDto', 'Decline hold must return BookingCommandStatusDto');

  const cancelHold = document.paths?.['/v1/owner/bookings/{holdId}/cancel']?.post;
  required(cancelHold, 'POST /v1/owner/bookings/{holdId}/cancel is missing');
  requireStatuses(cancelHold, ['200', '400', '401', '404', '409', '422', '500'], 'Cancel hold');
  requireErrorSchemas(cancelHold, ['400', '401', '404', '409', '422', '500'], 'Cancel hold');
  requireOptionalCorrelation(cancelHold, 'Cancel hold');
  required(responseSchemaRef(cancelHold, '200') === '#/components/schemas/BookingCommandStatusDto', 'Cancel hold must return BookingCommandStatusDto');

  const bookingHistory = document.paths?.['/v1/booking-holds/{holdId}/history']?.get;
  required(bookingHistory, 'GET /v1/booking-holds/{holdId}/history is missing');
  requireStatuses(bookingHistory, ['200', '400', '401', '404'], 'Booking history');
  requireErrorSchemas(bookingHistory, ['400', '401', '404'], 'Booking history');
  required(responseSchemaRef(bookingHistory, '200') === '#/components/schemas/BookingHistoryDto', 'Booking history must return BookingHistoryDto');

  const ownerNotifications = document.paths?.['/v1/owner/notifications']?.get;
  const markNotificationRead = document.paths?.['/v1/owner/notifications/{notificationId}/read']?.patch;
  required(ownerNotifications && markNotificationRead, 'Owner notification routes are missing');
  requireStatuses(ownerNotifications, ['200', '400', '401'], 'Owner notification list');
  requireStatuses(markNotificationRead, ['200', '400', '401', '404'], 'Owner notification read');
  requireErrorSchemas(ownerNotifications, ['400', '401'], 'Owner notification list');
  requireErrorSchemas(markNotificationRead, ['400', '401', '404'], 'Owner notification read');

  const ownerPetList = document.paths?.['/v1/owner/pets']?.get;
  const ownerPetCreate = document.paths?.['/v1/owner/pets']?.post;
  const ownerPetRead = document.paths?.['/v1/owner/pets/{petId}']?.get;
  required(ownerPetList && ownerPetCreate && ownerPetRead, 'Owner Pet MVP routes are incomplete');
  for (const [path, method] of [
    ['/v1/owner/pets/{petId}', 'patch'], ['/v1/owner/pets/{petId}/archive', 'post'], ['/v1/owner/pets/{petId}/restore', 'post'],
    ['/v1/owner/pets/{petId}/diary', 'get'], ['/v1/owner/pets/{petId}/care-summary', 'get'], ['/v1/owner/pets/{petId}/documents', 'post'],
    ['/v1/owner/pets/{petId}/photo', 'post'], ['/v1/owner/pets/{petId}/photo', 'delete'],
  ]) required(!document.paths?.[path]?.[method], `PILOT_V1 must not advertise ${method.toUpperCase()} ${path}`);
  for (const [operation, label] of [[ownerPetList, 'Owner pet list'], [ownerPetCreate, 'Owner pet create'], [ownerPetRead, 'Owner pet read']]) requireBearerAuth(operation, label);
  requireStatuses(ownerPetList, ['200', '401', '500'], 'Owner pet list');
  requireStatuses(ownerPetCreate, ['201', '400', '401', '409', '500'], 'Owner pet create');
  requireStatuses(ownerPetRead, ['200', '400', '401', '404', '500'], 'Owner pet read');
  requireErrorSchemas(ownerPetList, ['401', '500'], 'Owner pet list');
  requireErrorSchemas(ownerPetCreate, ['400', '401', '409', '500'], 'Owner pet create');
  requireErrorSchemas(ownerPetRead, ['400', '401', '404', '500'], 'Owner pet read');
  const petCreateHeader = ownerPetCreate.parameters?.find((parameter) => parameter.in === 'header' && parameter.name.toLowerCase() === 'idempotency-key');
  required(petCreateHeader?.required === true && petCreateHeader.schema?.format === 'uuid', 'Owner pet create must require UUID Idempotency-Key');
  const petCreateSchema = ownerPetCreate.requestBody?.content?.['application/json']?.schema;
  required(petCreateSchema?.additionalProperties === false, 'Owner pet create must reject additional properties');
  required(Object.keys(petCreateSchema?.properties ?? {}).sort().join() === 'name,species' && petCreateSchema?.required?.sort().join() === 'name,species', 'Owner pet create body must be exactly name and species');
  required(responseSchemaRef(ownerPetCreate, '201') === '#/components/schemas/OwnerPetMvpDto', 'Owner pet create must return OwnerPetMvpDto');
  required(responseSchemaRef(ownerPetRead, '200') === '#/components/schemas/OwnerPetMvpDto', 'Owner pet read must return OwnerPetMvpDto');
  required(ownerPetList.responses?.['200']?.content?.['application/json']?.schema?.items?.$ref === '#/components/schemas/OwnerPetMvpDto', 'Owner pet list must return OwnerPetMvpDto[]');

  const ownerClinicCatalog = document.paths?.['/v1/owner/clinic-catalog']?.get;
  required(ownerClinicCatalog, 'Owner clinic catalog route is missing');
  requireBearerAuth(ownerClinicCatalog, 'Owner clinic catalog');
  requireStatuses(ownerClinicCatalog, ['200', '401', '403', '500'], 'Owner clinic catalog');
  requireErrorSchemas(ownerClinicCatalog, ['401', '403', '500'], 'Owner clinic catalog');
  required(responseSchemaRef(ownerClinicCatalog, '200') === '#/components/schemas/OwnerClinicCatalogDto', 'Owner clinic catalog response is not typed');
  const ownerClinicServices = document.paths?.['/v1/owner/clinic-catalog/{clinicId}/locations/{locationId}']?.get;
  required(ownerClinicServices, 'Owner clinic service route is missing');
  requireBearerAuth(ownerClinicServices, 'Owner clinic service catalog');
  requireStatuses(ownerClinicServices, ['200', '400', '401', '403', '404', '500'], 'Owner clinic service catalog');
  requireErrorSchemas(ownerClinicServices, ['400', '401', '403', '404', '500'], 'Owner clinic service catalog');
  required(responseSchemaRef(ownerClinicServices, '200') === '#/components/schemas/OwnerClinicServiceCatalogDto', 'Owner clinic service response is not typed');
  required(['clinicId','locationId'].every((name)=>ownerClinicServices.parameters?.some((parameter)=>parameter.in==='path'&&parameter.name===name&&parameter.required===true&&parameter.schema?.format==='uuid')), 'Owner clinic service path identifiers must be required UUIDs');
  const ownerAvailability = document.paths?.['/v1/owner/clinic-catalog/{clinicId}/locations/{locationId}/services/{serviceId}/availability']?.get;
  required(ownerAvailability, 'Owner availability route is missing');
  requireBearerAuth(ownerAvailability, 'Owner availability');
  requireStatuses(ownerAvailability, ['200','400','401','403','404','500'], 'Owner availability');
  requireErrorSchemas(ownerAvailability, ['400','401','403','404','500'], 'Owner availability');
  required(['clinicId','locationId','serviceId'].every((name)=>ownerAvailability.parameters?.some((parameter)=>parameter.in==='path'&&parameter.name===name&&parameter.required===true&&parameter.schema?.format==='uuid')), 'Owner availability identifiers must be required UUIDs');
  required(ownerAvailability.parameters?.some((parameter)=>parameter.in==='query'&&parameter.name==='doctorId'&&parameter.required===false&&parameter.schema?.format==='uuid'), 'Owner availability doctorId must be an optional UUID query filter');
  required(responseSchemaRef(ownerAvailability,'200')==='#/components/schemas/OwnerAvailabilityDto','Owner availability response is not typed');

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
  required(!telemedWaiting, 'PILOT_V1 OpenAPI must not advertise the excluded telemed route');

  const workspaceHome = document.paths?.['/v1/clinic/{clinicId}/locations/{locationId}/workspace-home']?.get;
  required(workspaceHome, 'GET Clinic Workspace Home is missing');
  required(workspaceHome.security?.some((item) => item.bearerAuth), 'Workspace Home must require bearerAuth');
  required(['clinicId', 'locationId'].every((name) => workspaceHome.parameters?.some((parameter) => parameter.in === 'path' && parameter.name === name && parameter.required)), 'Workspace Home must require both path parameters');
  required(['200', '400', '401', '403', '500'].every((status) => workspaceHome.responses?.[status]), 'Workspace Home response matrix is incomplete');
  required(/private, no-store/i.test(workspaceHome.description ?? '') && /No ETag/i.test(workspaceHome.description ?? ''), 'Workspace Home cache policy is not documented');
  const schemas = document.components?.schemas ?? {};
  const petProjection = schemas.OwnerPetMvpDto;
  const catalogItem = schemas.OwnerClinicCatalogItemDto;
  const catalogResponse = schemas.OwnerClinicCatalogDto;
  required(catalogResponse?.additionalProperties === false && catalogResponse.required?.sort().join() === 'clinics,observedAt' && Object.keys(catalogResponse.properties ?? {}).sort().join() === 'clinics,observedAt', 'Owner clinic catalog response schema must be closed');
  required(catalogResponse.properties.clinics?.items?.$ref === '#/components/schemas/OwnerClinicCatalogItemDto', 'Owner clinic catalog items must use the bounded DTO');
  required(catalogItem?.additionalProperties === false, 'Owner clinic catalog item schema must be closed');
  required(catalogItem?.required?.sort().join() === 'address,clinicId,decisionSummary,locationId,name,phone', 'Owner clinic catalog projection required fields are incomplete');
  required(Object.keys(catalogItem?.properties ?? {}).sort().join() === 'address,clinicId,decisionSummary,locationId,name,phone', 'Owner clinic catalog exposes non-MVP fields');
  required(catalogItem.properties.clinicId?.format === 'uuid' && catalogItem.properties.locationId?.format === 'uuid', 'Owner clinic catalog identifiers must be UUIDs');
  required(catalogItem.properties.phone?.nullable === true, 'Owner clinic catalog phone must be nullable');
  const decision=schemas.OwnerClinicDecisionSummaryDto,nextAvailability=schemas.OwnerClinicNextAvailabilityDto,catalogPrice=schemas.OwnerClinicInformationalPriceDto,confirmation=schemas.OwnerClinicConfirmationDto;
  required(catalogItem.properties.decisionSummary?.$ref==='#/components/schemas/OwnerClinicDecisionSummaryDto','Owner clinic decision summary must be typed');
  required(decision?.additionalProperties===false&&decision.required?.sort().join()==='confirmation,informationalPrice,nextAvailability'&&Object.keys(decision.properties??{}).sort().join()==='confirmation,informationalPrice,nextAvailability','Owner clinic decision summary must be exact and closed');
  required(decision.properties.nextAvailability?.nullable===true&&decision.properties.nextAvailability?.allOf?.[0]?.$ref==='#/components/schemas/OwnerClinicNextAvailabilityDto','Owner next availability must be typed and nullable');
  required(decision.properties.informationalPrice?.nullable===true&&decision.properties.informationalPrice?.allOf?.[0]?.$ref==='#/components/schemas/OwnerClinicInformationalPriceDto','Owner catalog price must be typed and nullable');
  required(nextAvailability?.additionalProperties===false&&nextAvailability.required?.sort().join()==='localDate,localTime,startsAt,timezone'&&nextAvailability.properties.startsAt?.format==='date-time'&&nextAvailability.properties.localDate?.format==='date','Owner next availability must be exact and typed');
  required(catalogPrice?.additionalProperties===false&&catalogPrice.required?.sort().join()==='amount,currency,kind'&&catalogPrice.properties.kind?.enum?.join()==='FROM'&&catalogPrice.properties.currency?.pattern==='^[A-Z]{3}$','Owner catalog price must be informational FROM only');
  required(confirmation?.additionalProperties===false&&confirmation.required?.join()==='mode'&&confirmation.properties.mode?.enum?.join()==='MANUAL','Owner confirmation projection must expose Pilot manual truth');
  const serviceCatalog = schemas.OwnerClinicServiceCatalogDto;
  const serviceItem = schemas.OwnerClinicServiceDto;
  const servicePrice = schemas.OwnerClinicServicePriceDto;
  const serviceSpecialty = schemas.OwnerClinicServiceSpecialtyDto;
  const serviceSpecialist = schemas.OwnerClinicServiceSpecialistDto;
  required(serviceCatalog?.additionalProperties === false && serviceCatalog.required?.sort().join() === 'address,clinicId,locationId,name,observedAt,phone,services', 'Owner clinic service projection must be closed and complete');
  required(Object.keys(serviceCatalog?.properties ?? {}).sort().join() === 'address,clinicId,locationId,name,observedAt,phone,services', 'Owner clinic service projection exposes extra fields');
  required(serviceCatalog.properties.services?.maxItems === 50, 'Owner clinic service list must be bounded to 50');
  required(serviceItem?.additionalProperties === false && serviceItem.required?.sort().join() === 'name,price,serviceId,specialists,specialty', 'Owner clinic service item must be closed');
  required(Object.keys(serviceItem?.properties ?? {}).sort().join() === 'name,price,serviceId,specialists,specialty' && serviceItem.properties.serviceId?.format === 'uuid' && serviceItem.properties.price?.$ref === '#/components/schemas/OwnerClinicServicePriceDto', 'Owner clinic service fields must be exact and typed');
  required(serviceItem.properties.specialty?.nullable === true && serviceItem.properties.specialty?.allOf?.[0]?.$ref === '#/components/schemas/OwnerClinicServiceSpecialtyDto', 'Owner service specialty must be typed and nullable');
  required(serviceItem.properties.specialists?.maxItems === 10 && serviceItem.properties.specialists?.items?.$ref === '#/components/schemas/OwnerClinicServiceSpecialistDto', 'Owner service specialists must be typed and bounded to 10');
  required(serviceSpecialty?.additionalProperties === false && serviceSpecialty.required?.sort().join() === 'id,name' && Object.keys(serviceSpecialty.properties ?? {}).sort().join() === 'id,name' && serviceSpecialty.properties.id?.format === 'uuid', 'Owner service specialty must be exact and closed');
  required(serviceSpecialist?.additionalProperties === false && serviceSpecialist.required?.sort().join() === 'displayName,doctorId,nextAvailability,specialtyName' && Object.keys(serviceSpecialist.properties ?? {}).sort().join() === 'displayName,doctorId,nextAvailability,specialtyName' && serviceSpecialist.properties.doctorId?.format === 'uuid' && serviceSpecialist.properties.nextAvailability?.$ref === '#/components/schemas/OwnerClinicNextAvailabilityDto', 'Owner service specialist must expose only safe typed identity and availability');
  required(servicePrice?.additionalProperties === false && servicePrice.required?.sort().join() === 'amount,currency,kind' && servicePrice.properties.kind?.enum?.join() === 'INFORMATIONAL' && servicePrice.properties.amount?.pattern === '^\\d{1,10}\\.\\d{2}$' && servicePrice.properties.currency?.pattern === '^[A-Z]{3}$', 'Owner clinic service price must be informational-only and strictly typed');
  required(Object.keys(servicePrice?.properties ?? {}).sort().join() === 'amount,currency,kind', 'Owner clinic service price fields must be exact');
  const availability=schemas.OwnerAvailabilityDto,availabilitySlot=schemas.OwnerAvailabilitySlotDto;
  required(availability?.additionalProperties===false&&availability.required?.sort().join()==='clinicName,horizonEndsAt,informationalPrice,observedAt,serviceName,slots,timezone'&&Object.keys(availability.properties??{}).sort().join()==='clinicName,horizonEndsAt,informationalPrice,observedAt,serviceName,slots,timezone','Owner availability envelope must be exact and closed');
  required(availability.properties.observedAt?.format==='date-time'&&availability.properties.horizonEndsAt?.format==='date-time'&&availability.properties.slots?.items?.$ref==='#/components/schemas/OwnerAvailabilitySlotDto','Owner availability envelope must be typed');
  required(availability.properties.informationalPrice?.$ref==='#/components/schemas/OwnerClinicServicePriceDto','Owner availability price must reuse the selected service price authority');
  required(availabilitySlot?.additionalProperties===false&&availabilitySlot.required?.sort().join()==='endsAt,expectedVersion,localDate,localTime,slotId,startsAt'&&Object.keys(availabilitySlot.properties??{}).sort().join()==='endsAt,expectedVersion,localDate,localTime,slotId,startsAt','Owner availability slot must be exact and closed');
  required(availabilitySlot.properties.slotId?.format==='uuid'&&availabilitySlot.properties.startsAt?.format==='date-time'&&availabilitySlot.properties.endsAt?.format==='date-time'&&availabilitySlot.properties.localDate?.format==='date'&&availabilitySlot.properties.localDate?.pattern==='^\\d{4}-\\d{2}-\\d{2}$'&&availabilitySlot.properties.localTime?.pattern==='^(?:[01]\\d|2[0-3]):[0-5]\\d$'&&availabilitySlot.properties.expectedVersion?.type==='integer'&&availabilitySlot.properties.expectedVersion?.minimum===1,'Owner availability slot identity/time/version must be typed');
  required(!Object.keys(document.paths ?? {}).some((path) => /(^|\/)(payments?|payment-intents?)(\/|$)/.test(path)), 'PILOT_V1 must advertise no payment routes');
  required(petProjection?.required?.sort().join() === 'createdAt,name,petId,species,updatedAt', 'Owner Pet MVP projection required fields are not exact');
  required(Object.keys(petProjection.properties ?? {}).sort().join() === 'createdAt,name,petId,species,updatedAt', 'Owner Pet MVP projection exposes legacy or authority fields');
  required(petProjection.properties.petId?.format === 'uuid' && petProjection.properties.createdAt?.format === 'date-time' && petProjection.properties.updatedAt?.format === 'date-time', 'Owner Pet MVP identifiers/timestamps are not typed');
  required(petProjection.properties.species?.enum?.join() === 'DOG,CAT,OTHER', 'Owner Pet MVP species is not closed');
  required(
    schemas.BookingStatus?.enum?.join() === 'PENDING_CONFIRMATION,CONFIRMED,REJECTED,CANCELLED,EXPIRED',
    'Canonical BookingStatus enum is missing or not closed to the five first-MVP values',
  );
  for (const [name, requiredFields] of [
    ['HoldDto', ['holdId', 'status', 'aggregateVersion', 'lastUpdatedAt', 'serverNow']],
    ['BookingHoldReadDto', ['holdId', 'status', 'aggregateVersion', 'lastUpdatedAt', 'serverNow']],
    ['BookingCommandStatusDto', ['holdId', 'status', 'slotId', 'correlationId']],
  ]) {
    const schema = schemas[name];
    required(schema && !schema.properties?.state && !schema.properties?.displayStatus, `${name} must not expose raw booking state`);
    required(requiredFields.every((field) => schema.required?.includes(field)), `${name} required fields are incomplete`);
    if (name !== 'HoldDto') {
      required(schema.properties.status?.allOf?.[0]?.$ref === '#/components/schemas/BookingStatus', `${name}.status must use BookingStatus`);
    }
  }
  required(schemas.BookingHoldReadDto.properties.lastUpdatedAt?.format === 'date-time', 'BookingHoldReadDto.lastUpdatedAt must be date-time');
  required(schemas.HoldDto.properties.lastUpdatedAt?.format === 'date-time', 'HoldDto.lastUpdatedAt must be date-time');
  required(!schemas.HoldDto.properties.appointmentId, 'PILOT_V1 create hold must not imply an appointment');
  required(schemas.HoldDto.properties.confirmationMode?.enum?.join() === 'MANUAL', 'PILOT_V1 create hold must be manual confirmation only');
  required(schemas.HoldDto.additionalProperties === false, 'PILOT_V1 create response must be closed');
  required(Object.keys(schemas.HoldDto.properties).sort().join() === ['aggregateVersion','confirmationMode','correlationId','expiresAt','holdId','lastUpdatedAt','nextAction','serverNow','slotId','status'].sort().join(), 'PILOT_V1 create response keys must be exact');
  required(schemas.HoldDto.properties.status?.enum?.join() === 'PENDING_CONFIRMATION', 'PILOT_V1 create response status must be pending confirmation');
  required(schemas.HoldDto.properties.aggregateVersion?.type === 'integer' && schemas.HoldDto.properties.aggregateVersion.minimum === 1, 'HoldDto aggregateVersion must be a positive integer');
  required(schemas.BookingHistoryCursorDto?.properties?.occurredAt?.format === 'date-time', 'Booking history cursor occurredAt must be date-time');
  required(schemas.BookingHistoryCursorDto?.properties?.eventId?.format === 'uuid', 'Booking history cursor eventId must be UUID');
  required(schemas.OwnerNotificationDto?.properties?.appointmentId?.type === 'string', 'Owner notification appointmentId must be a nullable UUID string');
  required(schemas.OwnerNotificationDto?.properties?.readAt?.type === 'string', 'Owner notification readAt must be a nullable date-time string');
  required(['challengeId', 'expiresAt', 'resendAvailableAt'].every((field) => schemas.OwnerOtpChallengeDto?.required?.includes(field)), 'Owner OTP challenge timestamps are incomplete');
  required(schemas.OwnerOtpChallengeDto.properties.expiresAt?.format === 'date-time' && schemas.OwnerOtpChallengeDto.properties.resendAvailableAt?.format === 'date-time', 'OTP timestamps must be authoritative date-time values');
  required(schemas.OwnerSessionDto?.required?.includes('sessionToken') && schemas.OwnerSessionDto.properties.sessionToken?.pattern === '^vh_[A-Za-z0-9_-]{64}$', 'Owner session token must be required opaque material');
  required(!schemas.OwnerSessionDto.properties.accessToken && !schemas.OwnerSessionDto.properties.refreshToken, 'Owner session schema must not expose JWT/refresh assumptions');
  required(schemas.VerifyOwnerOtpDto?.properties?.code?.writeOnly === true, 'OTP input must be write-only');
  const authCodes = schemas.AuthErrorDto?.properties?.code?.enum ?? [];
  for (const code of ['OTP_INVALID','OTP_EXPIRED','OTP_RESEND_COOLDOWN','OTP_RATE_LIMITED','OTP_TEMPORARILY_BLOCKED','OTP_CHALLENGE_NOT_FOUND','OTP_ALREADY_USED','OTP_PROVIDER_UNAVAILABLE','OTP_PROVIDER_TIMEOUT','OTP_PROVIDER_OUTCOME_UNKNOWN','INVALID_SESSION']) {
    required(authCodes.includes(code), `AuthErrorDto is missing ${code}`);
  }
  required(schemas.ApiErrorDto?.properties?.code?.type === 'string', 'ApiErrorDto.code is missing');
  required(schemas.ApiErrorDto?.properties?.message?.type === 'string', 'ApiErrorDto.message is missing');
  required(schemas.ApiErrorDto?.properties?.correlationId?.format === 'uuid', 'ApiErrorDto.correlationId is missing');
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
