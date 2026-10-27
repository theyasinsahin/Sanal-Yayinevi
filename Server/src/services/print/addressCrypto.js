import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { fail } from './common.js';

function key() {
  const value = process.env.PRINT_ADDRESS_ENCRYPTION_KEY;
  if (!/^[a-fA-F0-9]{64}$/.test(value || '')) throw fail('Teslimat şifreleme anahtarı yapılandırılmamış.', 'ADDRESS_KEY_MISSING');
  return Buffer.from(value, 'hex');
}
export function encryptAddress(address, paymentId) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(`print-order:${paymentId}:v1`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(address), 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') };
}
export function decryptAddress(envelope, paymentId) {
  if (envelope?.version !== 1) throw fail('Teslimat verisi şifreleme sürümü bilinmiyor.', 'ADDRESS_INTEGRITY');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from(`print-order:${paymentId}:v1`)); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
  } catch (error) { if (error.extensions?.code === 'ADDRESS_KEY_MISSING') throw error; throw fail('Teslimat verisi bütünlük kontrolü başarısız.', 'ADDRESS_INTEGRITY'); }
}
