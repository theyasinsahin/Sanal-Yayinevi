import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { assertIsolatedPrintSandbox } from '../utils/isolatedPrintSandbox.js';
import { configureDockerDevelopment } from './dockerDevelopment.js';

// Deployment variables take precedence; production never loads development secrets.
if (process.env.BETIK_DOCKER_DEV === 'true') {
  configureDockerDevelopment();
} else if (process.env.BETIK_ISOLATED_PRINT_SANDBOX === 'true') {
  assertIsolatedPrintSandbox(process.env);
} else if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: fileURLToPath(new URL(process.env.NODE_ENV === 'production' ? '../../.env.prod' : '../../.env', import.meta.url)) });
  if (!['production', 'test'].includes(process.env.NODE_ENV)) {
    dotenv.config({ path: fileURLToPath(new URL('../../.env.print.local', import.meta.url)) });
  }
}
