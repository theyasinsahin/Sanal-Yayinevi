import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { assertIsolatedPrintSandbox } from '../utils/isolatedPrintSandbox.js';

// Deployment variables take precedence; production never loads development secrets.
if (process.env.BETIK_ISOLATED_PRINT_SANDBOX === 'true') {
  assertIsolatedPrintSandbox(process.env);
} else dotenv.config({
  path: fileURLToPath(new URL(process.env.NODE_ENV === 'production' ? '../../.env.prod' : '../../.env', import.meta.url)),
});
