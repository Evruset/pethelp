import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_BEARER_AUTH = 'bearerAuth';

const DUPLICATED_METHOD_KEYS = new Set([
  'cancel',
  'create',
  'detail',
  'list',
  'listClinicLocations',
  'listSlots',
  'paymentAuthorized',
  'read',
  'update',
]);

export function createOpenApiDocument(app: INestApplication) {
  const documentConfig = new DocumentBuilder()
    .setTitle('VetHelp Booking Core API')
    .setDescription('Контракт локального удержания слотов, подтверждения записи клиникой и освобождения hold.')
    .setVersion(process.env.npm_package_version ?? '1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'opaque Owner session or legacy staff JWT',
        description: 'Opaque vh_ Owner session or compatibility JWT for staff/system roles. Authorization and expiry are evaluated server-side for Owner sessions.',
      },
      SWAGGER_BEARER_AUTH,
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey) =>
      DUPLICATED_METHOD_KEYS.has(methodKey)
        ? `${controllerKey.replace(/Controller$/, '')}_${methodKey}`
        : methodKey,
  });

  for (const pathItem of Object.values(document.paths)) {
    for (const operation of [pathItem.get, pathItem.post, pathItem.put, pathItem.patch, pathItem.delete]) {
      if (!operation?.parameters) continue;
      const seen = new Set<string>();
      operation.parameters = [...operation.parameters].reverse().filter((parameter) => {
        if ('$ref' in parameter) return true;
        const key = `${parameter.in}:${parameter.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).reverse();
    }
  }

  for (const name of ['OwnerClinicCatalogDto', 'OwnerClinicCatalogItemDto', 'OwnerClinicServiceCatalogDto', 'OwnerClinicServiceDto', 'OwnerClinicServicePriceDto', 'OwnerAvailabilityDto', 'OwnerAvailabilitySlotDto', ...(process.env.MVP_SCOPE_PROFILE === 'PILOT_V1' ? ['HoldDto'] : [])]) {
    const schema = document.components?.schemas?.[name];
    if (schema && typeof schema === 'object' && !('$ref' in schema)) schema.additionalProperties = false;
  }
  if (process.env.MVP_SCOPE_PROFILE === 'PILOT_V1') {
    const hold = document.components?.schemas?.HoldDto;
    if (hold && typeof hold === 'object' && !('$ref' in hold) && hold.properties?.status && !('$ref' in hold.properties.status)) {
      hold.properties.status = { type: 'string', enum: ['PENDING_CONFIRMATION'] };
    }
  }

  return document;
}
