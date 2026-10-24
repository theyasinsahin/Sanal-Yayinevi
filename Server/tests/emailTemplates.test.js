import { registrationEmail, passwordResetEmail, emailChangedEmail, contactMessageEmail, newsletterConfirmationEmail } from '../src/emails/templates.js';

const confirmUrl = 'https://example.test/newsletter?token=secret&action=confirm';
const unsubscribeUrl = 'https://example.test/newsletter?token=secret&action=unsubscribe';
const resetUrl = 'https://example.test/reset-password/secret';
const samples = [
  registrationEmail({ code: '123456', username: 'Deniz' }),
  passwordResetEmail({ resetUrl }), emailChangedEmail(),
  contactMessageEmail({ name: 'Deniz', email: 'deniz@example.test', subject: 'Merhaba', message: 'Birinci satır\nİkinci satır' }),
  newsletterConfirmationEmail({ confirmUrl, unsubscribeUrl }),
];
test.each(samples)('$subject has branded HTML and a meaningful text fallback', message => {
  expect(message.subject).toMatch(/^Betik/);
  expect(message.html).toContain('<html lang="tr">');
  expect(message.html).toContain('role="presentation"');
  expect(message.html).toContain('#f5f4f0');
  expect(message.html).toContain('Her hikâye bir okurla büyür.');
  expect(message.html).not.toMatch(/<script|<img|Quill/);
  expect(message.text.length).toBeGreaterThan(100);
});
test('registration code is readable in both versions with the actual ten-minute lifetime', () => {
  expect(samples[0].html).toContain('123456');
  expect(samples[0].text).toContain('123456');
  expect(samples[0].text).toContain('10 dakika');
});
test('user-controlled content is escaped without losing multiline messages', () => {
  const message = contactMessageEmail({ name: '<script>alert(1)</script>', email: 'x@example.test', subject: '<img src=x onerror=alert(1)>', message: 'Merhaba\n<a href="https://evil.test">tıkla</a>' });
  expect(message.html).not.toContain('<script>');
  expect(message.html).not.toContain('<img');
  expect(message.html).toContain('&lt;script&gt;');
  expect(message.html).toContain('Merhaba<br>&lt;a');
  expect(registrationEmail({ code: '123456', username: '<b>Deniz</b>' }).html).toContain('&lt;b&gt;Deniz&lt;/b&gt;');
});
test('confirmation and opt-out links are preserved in both versions', () => {
  const message = samples[4];
  expect(message.text).toContain(confirmUrl);
  expect(message.text).toContain(unsubscribeUrl);
  expect(message.html).toContain(confirmUrl.replace('&', '&amp;'));
  expect(message.html).toContain(unsubscribeUrl.replace('&', '&amp;'));
  expect(message.html).toContain('24 saat');
  expect(samples[1].text).toContain(resetUrl);
  expect(samples[1].html).toContain('1 saat');
});
test.each(['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.test'])('rejects unsafe action URL %s', resetUrl => {
  expect(() => passwordResetEmail({ resetUrl })).toThrow();
});
