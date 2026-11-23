// Test-environment guard: force every listening socket of the API process onto loopback
// without touching the application source.
const net = require('net');
const orig = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (args[0] && typeof args[0] === 'object' && !args[0].path) args[0] = { ...args[0], host: '127.0.0.1' };
  else if (typeof args[0] === 'number') { const cb = args.find(a => typeof a === 'function'); args = [{ port: args[0], host: '127.0.0.1' }, cb].filter(Boolean); }
  return orig.apply(this, args);
};
