import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { assertDockerDevelopment } from './dockerDevelopment.js';

export const usesDevelopmentMail = env => env.BETIK_DOCKER_DEV === 'true' && env.DEV_EXTERNAL_INTEGRATIONS !== 'true';

// Private bind-mounted files only: never expose message bodies through HTTP or logs.
export function createDevelopmentMailTransport(env) {
  assertDockerDevelopment(env);
  const directory = env.DEV_MAIL_DIRECTORY;
  if (!directory || !isAbsolute(directory)) throw new Error('DEV_MAIL_DIRECTORY must be an absolute local archive directory.');
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows', disableFileAccess: true, disableUrlAccess: true });
  const prepare = async () => {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await access(directory, constants.W_OK);
  };
  return {
    async verify() { await prepare(); return true; },
    async sendMail(message) {
      const from = (message.from?.address || typeof message.from === 'string') ? message.from : { name: 'Betik Development', address: 'no-reply@betik-dev.invalid' };
      const result = await transport.sendMail({ ...message, from });
      if (!result.envelope.to.length) throw Object.assign(new Error('No archive recipient'), { code: 'EENVELOPE' });
      await prepare();
      await writeFile(join(directory, `${Date.now()}-${randomUUID()}.eml`), result.message, { flag: 'wx', mode: 0o600 });
      return { messageId: result.messageId, accepted: result.envelope.to, rejected: [] };
    },
    close() { transport.close(); },
  };
}
