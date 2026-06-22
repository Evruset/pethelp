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
  required(createHold.responses?.['403'], 'Create hold must document 403');
  required(createHold.responses?.['409'], 'Create hold must document 409');

  const confirmHold = document.paths?.['/v1/clinic/booking-holds/{holdId}/confirm']?.post;
  required(confirmHold, 'POST /v1/clinic/booking-holds/{holdId}/confirm is missing');
  required(confirmHold.security?.some((item) => item.bearerAuth), 'Confirm hold must require bearerAuth');
  required(confirmHold.responses?.['200'], 'Confirm hold must document 200');
  required(confirmHold.responses?.['403'], 'Confirm hold must document 403');

  required(document.components?.securitySchemes?.bearerAuth, 'Bearer security scheme is missing');
  console.log('OpenAPI contract assertion passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
