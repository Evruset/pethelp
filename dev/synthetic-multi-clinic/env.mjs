import {createRequire} from 'node:module';
const {selectedDatabase}=createRequire(import.meta.url)('../../backend/scripts/synthetic/fixture-database.cjs');
const database=selectedDatabase(process.env.SYNTHETIC_DATABASE_NAME);
import {demoEnv} from '../product-batch01/demo-env.mjs';
// Explicit public local test configuration; no production credentials.
export const syntheticEnv={...demoEnv,DATABASE_URL:`postgres://product_demo:isolated-demo-only@127.0.0.1:55484/${database}`,PORT:'3310',SYNTHETIC_FIXTURE_ACK:'VETHELP_SYNTHETIC_25_V1',CORS_ALLOWED_ORIGINS:'http://localhost:8090,http://127.0.0.1:8090'};
