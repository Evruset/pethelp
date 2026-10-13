// Public local-only demo values. Never load production credentials here.
export const demoEnv = {
  NODE_ENV: 'development', DATABASE_URL: 'postgres://product_demo:isolated-demo-only@127.0.0.1:55484/product_batch01', PORT: '3308',
  JWT_SECRET: 'product-batch01-demo-jwt-secret-at-least-32', JWT_ISSUER: 'vethelp-product-demo', JWT_AUDIENCE: 'vethelp-api',
  AUTH_OTP_PEPPER: 'product-batch01-demo-otp-pepper-at-least-32',
  AUTH_OTP_ANTI_FRAUD_PEPPER: 'product-batch01-demo-antifraud-pepper-at-least-32',
  OWNER_PET_IDEMPOTENCY_HMAC_KEY: 'product-batch01-demo-pet-hmac-key-at-least-32',
  WORKER_SERVICE_TOKEN: 'product-batch01-demo-worker-token-at-least-32',
  AUTH_DEV_OTP_CODE: '123456', WORKERS_ENABLED: 'false', OCR_VERIFIED_BYTES_ENABLED: 'false',
  // Existing registry-test policy; DEMO fixture only, not a production retention decision.
  VETHELP_CLINIC_PATIENTS_REGISTRY:'true', VETHELP_CLINIC_APPOINTMENTS_REGISTRY:'true',
  VETHELP_CLINIC_PATIENT_VISIBILITY_POLICY_VERSION:'registry-test-v1', VETHELP_CLINIC_PATIENT_VISIBILITY_DAYS:'365',
  VETHELP_CLINIC_PATIENTS_SEARCH_RATE_LIMIT:'30', VETHELP_CLINIC_PATIENTS_SEARCH_WINDOW_SECONDS:'60',
  MVP_SCOPE_PROFILE: 'PILOT_V1', CORS_ALLOWED_ORIGINS: 'http://localhost:8088,http://127.0.0.1:8088',
};
