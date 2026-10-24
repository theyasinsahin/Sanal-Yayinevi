import mailer, { contactRecipient } from '../config/smtp.js';

// No server/database imports and no message is sent.
const deadline = setTimeout(() => {
  console.error('SMTP kontrolü zaman aşımına uğradı (ETIMEDOUT). Ağ erişimi ve SMTP izinlerini kontrol edin.');
  process.exit(1);
}, 45000);
try {
  contactRecipient();
  console.log('SMTP bağlantısı kontrol ediliyor; e-posta gönderilmeyecek.');
  await mailer.verify();
  console.log('SMTP bağlantısı ve kimlik doğrulaması başarılı. E-posta gönderilmedi.');
} catch (error) {
  const codes = ['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'];
  console.error(`SMTP doğrulaması başarısız (${codes.includes(error.code) ? error.code : 'CONFIG_OR_SMTP_ERROR'}). Gizli ayarlar ve sağlayıcı erişimini kontrol edin.`);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
}
