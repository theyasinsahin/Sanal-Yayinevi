import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Deployment variables take precedence; production never loads development secrets.
dotenv.config({
  path: fileURLToPath(new URL(process.env.NODE_ENV === 'production' ? '../../.env.prod' : '../../.env', import.meta.url)),
});
