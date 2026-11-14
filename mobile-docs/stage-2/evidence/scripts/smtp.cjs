// Local mail sink: accepts any login, stores every message on disk, relays nothing.
const fs = require('fs'), path = require('path');
const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const SB = path.resolve(__dirname, '..');
const dir = path.join(SB, 'data/mail'); fs.mkdirSync(dir, { recursive: true });
const key = fs.readFileSync(path.join(SB, 'data/tls/key.pem')), cert = fs.readFileSync(path.join(SB, 'data/tls/cert.pem'));
let n = fs.readdirSync(dir).length;
new SMTPServer({
  key, cert, authOptional: true, disabledCommands: [],
  onAuth: (auth, s, cb) => cb(null, { user: auth.username }),
  onData: (stream, session, cb) => {
    simpleParser(stream).then(m => {
      const rec = { at: new Date().toISOString(), from: m.from?.text, to: m.to?.text, subject: m.subject, text: m.text, html: m.html };
      fs.writeFileSync(path.join(dir, String(++n).padStart(4, '0') + '.json'), JSON.stringify(rec, null, 1));
      console.log('MAIL', n, rec.to, '|', rec.subject); cb();
    }).catch(cb);
  },
}).listen(2555, '127.0.0.1', () => console.log('SMTP_READY 127.0.0.1:2555'));
