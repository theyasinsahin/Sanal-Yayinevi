import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as templates from '../emails/templates.js';

// Fully synthetic fixtures: never read .env, connect to SMTP or access a database.
const baseUrl = 'https://example.test';
const samples = {
  registration: templates.registrationEmail({ code: '123456', username: 'Deniz', baseUrl }),
  'password-reset': templates.passwordResetEmail({ resetUrl: `${baseUrl}/reset-password/example-preview-token`, baseUrl }),
  'email-changed': templates.emailChangedEmail({ baseUrl }),
  contact: templates.contactMessageEmail({ name: 'Deniz Yılmaz', email: 'deniz@example.test', subject: 'Hikâyemi paylaşmak istiyorum', message: 'Merhaba Betik ekibi,\n\nYazmaya başladığım hikâyemi okurlarla buluşturmak istiyorum. Önerilerinizi paylaşabilir misiniz?\n\nTeşekkürler.', baseUrl }),
  newsletter: templates.newsletterConfirmationEmail({ confirmUrl: `${baseUrl}/newsletter?token=example-preview-token&action=confirm`, unsubscribeUrl: `${baseUrl}/newsletter?token=example-preview-token&action=unsubscribe`, baseUrl }),
};
const directory = new URL('../../../email-previews/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, message] of Object.entries(samples)) {
  await writeFile(new URL(`${name}.html`, directory), message.html);
  await writeFile(new URL(`${name}.txt`, directory), `${message.subject}\n\n${message.text}`);
}
await writeFile(new URL('index.html', directory), `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Betik e-posta taslakları</title><body style="background:#f5f4f0;color:#1a1a1a;font:18px/1.8 Georgia,serif;max-width:760px;margin:48px auto;padding:20px"><h1>Betik · E-posta taslakları</h1><p>Örnek içerikler kullanılır; e-posta gönderilmez. Dar ekranı görmek için tarayıcıyı küçültebilirsin.</p><ul>${Object.keys(samples).map(name => `<li><a href="${name}.html">${samples[name].subject}</a> · <a href="${name}.txt">Düz metin</a></li>`).join('')}</ul></body></html>`);
console.log(`Beş e-posta taslağı hazır: ${fileURLToPath(new URL('index.html', directory))}`);
