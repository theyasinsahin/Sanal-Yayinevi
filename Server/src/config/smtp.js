import './environment.js';
import nodemailer from 'nodemailer';
import { Socket } from 'node:net';
import { GraphQLError } from 'graphql';
import { createDevelopmentMailTransport, usesDevelopmentMail } from './dockerDevelopmentMail.js';

const deliveryMessage = 'E-posta şu anda gönderilemiyor. Lütfen biraz sonra tekrar deneyin.';
const safeCodes = new Set(['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ETLS', 'EENVELOPE', 'EMESSAGE']);

export function mailSettings(env = process.env) {
  const user = env.EMAIL_USER?.trim();
  const pass = env.EMAIL_PASS;
  if (!user || !pass) throw new Error('E-posta gönderimi için EMAIL_USER ve EMAIL_PASS gerekli.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) throw new Error('EMAIL_USER geçerli bir e-posta adresi olmalı.');
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT || 587);
  if (host && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('SMTP_PORT geçersiz.');
  if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) throw new Error('SMTP_SECURE true veya false olmalı.');
  return {
    ...(host ? { host, port, secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465, requireTLS: true } : { service: 'gmail' }),
    auth: { user, pass }, dnsTimeout: 5000, connectionTimeout: 6000, greetingTimeout: 5000, socketTimeout: 8000,
  };
}

export function contactRecipient(env = process.env) {
  if (usesDevelopmentMail(env)) {
    const transport = createDevelopmentMailTransport(env);
    transport.close();
    return 'contact@betik-dev.invalid';
  }
  const address = (env.CONTACT_EMAIL || env.EMAIL_USER || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('İletişim alıcısı için CONTACT_EMAIL veya EMAIL_USER gerekli.');
  return address;
}

// One cancellable socket per operation: a deadline must not leave mail sending in
// the background, or close another request's SMTP connection. No automatic retry:
// a lost acknowledgement can mean that the provider already accepted the message.
export function createMailer({ env = process.env, createTransport = nodemailer.createTransport, createSocket = () => new Socket() } = {}) {
  const run = async (operation, message) => {
    const started = Date.now();
    let transport, socket, timer;
    try {
      if (usesDevelopmentMail(env)) {
        transport = createDevelopmentMailTransport(env);
        return await transport[operation](message);
      }
      const settings = mailSettings(env);
      socket = createSocket();
      socket.on('error', () => {});
      transport = createTransport({ ...settings, socket });
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = Object.assign(new Error('SMTP deadline exceeded'), { code: 'ETIMEDOUT' });
          socket.destroy(error);
          reject(error);
        }, 12000);
      });
      const result = await Promise.race([Promise.resolve().then(() => transport[operation](message)), deadline]);
      if (operation === 'sendMail' && !result?.accepted?.length) throw Object.assign(new Error('No accepted recipient'), { code: 'EENVELOPE' });
      return result;
    } catch (error) {
      const code = safeCodes.has(error.code) ? error.code : 'CONFIG_OR_SMTP_ERROR';
      console.error('MAIL_DELIVERY_FAILED', { operation, code, durationMs: Date.now() - started });
      const failure = new GraphQLError(deliveryMessage, { extensions: { code: 'EMAIL_DELIVERY_FAILED' } });
      failure.code = code;
      throw failure;
    } finally {
      clearTimeout(timer);
      socket?.destroy();
      transport?.close();
    }
  };
  return { sendMail: message => run('sendMail', message), verify: () => run('verify') };
}
export default createMailer();
