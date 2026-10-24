import './environment.js';
import nodemailer from 'nodemailer';

export function mailSettings(env = process.env) {
  const user = env.EMAIL_USER?.trim();
  const pass = env.EMAIL_PASS;
  if (!user || !pass) throw new Error('E-posta gönderimi için EMAIL_USER ve EMAIL_PASS gerekli.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) throw new Error('EMAIL_USER geçerli bir e-posta adresi olmalı.');
  return { service: 'gmail', auth: { user, pass }, dnsTimeout: 15000, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 };
}

export function contactRecipient(env = process.env) {
  const address = (env.CONTACT_EMAIL || env.EMAIL_USER || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('İletişim alıcısı için CONTACT_EMAIL veya EMAIL_USER gerekli.');
  return address;
}

// Existing account flows retain sendMail; creation waits until environment is loaded.
let transport;
function getTransport() {
  if (!transport) transport = nodemailer.createTransport(mailSettings());
  return transport;
}
export default {
  sendMail: message => getTransport().sendMail(message),
  verify: () => getTransport().verify(),
};
