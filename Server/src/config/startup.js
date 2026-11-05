import { allowedOrigins } from '../security/httpSecurity.js';

export function validateServerEnvironment(env = process.env) {
  const problems = [];
  if (!env.MONGO_URI?.trim()) problems.push('MONGO_URI eksik. Server/.env içinde MongoDB bağlantısını tanımlayın.');
  else if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGO_URI)) problems.push('MONGO_URI mongodb:// veya mongodb+srv:// ile başlamalı.');
  if (!env.JWT_SECRET || Buffer.byteLength(env.JWT_SECRET) < 32) problems.push('JWT_SECRET en az 32 bayt olmalı. Rastgele bir oturum anahtarı oluşturun.');
  if (env.NODE_ENV === 'production' && !env.CLIENT_URL) problems.push('Üretimde CLIENT_URL gerekli. HTTPS istemci origin adresini tanımlayın.');
  try { allowedOrigins(env); } catch { problems.push('CLIENT_URL / CORS_ALLOWED_ORIGINS geçersiz. Yol içermeyen origin kullanın; üretimde HTTPS gerekli.'); }
  const port = env.PORT || '5000';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) problems.push('PORT 1–65535 arasında bir sayı olmalı.');
  if (problems.length) {
    const error = new Error(problems.join('\n'));
    error.code = 'STARTUP_CONFIG_INVALID';
    error.problems = problems;
    throw error;
  }
  return { port: Number(port) };
}

// Never print raw driver errors: they can contain credentials, hostnames or URIs.
export function startupFailure(error) {
  if (error?.code === 'STARTUP_CONFIG_INVALID') return { code: error.code, message: error.problems.join('\n') };
  const errors = [];
  const visit = value => {
    if (!value || errors.includes(value) || errors.length >= 20) return;
    errors.push(value);
    visit(value.cause);
    for (const server of value.reason?.servers?.values?.() || []) visit(server.error);
  };
  visit(error);
  const has = (...codes) => errors.some(value => codes.includes(value.code) || codes.includes(value.name) || codes.includes(value.extensions?.code));
  // Atlas also reports authentication failures with the general AtlasError
  // code 8000. Classify only known auth messages; never echo their contents.
  const atlasAuthFailed = errors.some(value => value.code === 8000 && /bad auth|authentication failed|auth(?:entication)? failure|unable to authenticate/i.test(value.message || ''));
  if (has('EADDRINUSE')) return { code: 'PORT_IN_USE', message: 'PORT başka bir süreç tarafından kullanılıyor. İlgili süreci durdurun veya Server/.env içindeki PORT değerini değiştirin.' };
  if (has('EACCES', 'EPERM')) return { code: 'ACCESS_DENIED', message: 'Port veya dosya erişimi engellendi. İzinleri ve PORT ayarını kontrol edin.' };
  if (atlasAuthFailed || has(18, 13, 'AuthenticationFailed', 'Unauthorized')) return { code: 'MONGO_AUTH_FAILED', message: 'MongoDB kullanıcı/parola veya veritabanı yetkisi geçersiz. URI içindeki özel karakterleri URL kodlayın ve authSource ayarını kontrol edin.' };
  if (has('MongoParseError', 'MongoInvalidArgumentError')) return { code: 'MONGO_URI_INVALID', message: 'MONGO_URI biçimi veya bağlantı seçenekleri geçersiz. MongoDB bağlantı adresini kontrol edin.' };
  if (has('CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY')) return { code: 'MONGO_TLS_FAILED', message: 'MongoDB TLS sertifikası doğrulanamadı. Sistem saatini ve güvenilen sertifika zincirini kontrol edin.' };
  if (has('ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ECONNREFUSED', 'ETIMEOUT', 'ETIMEDOUT', 'MongooseServerSelectionError', 'MongoServerSelectionError')) return { code: 'MONGO_UNREACHABLE', message: 'MongoDB erişilemiyor. Servis/port, DNS, güvenlik duvarı ve Atlas IP erişim listesini kontrol edin. Replica set adresleri bu makineden erişilebilir olmalı.' };
  if (has('PRINT_STORAGE_UNAVAILABLE', 20)) return { code: 'MONGO_REPLICA_SET_REQUIRED', message: 'Basım işlemleri için MongoDB replica set veya mongos gerekli. Replica set kurun; basım kullanılmayacaksa PRINT_SYSTEM_ENABLED=false ve PRINT_PAYMENTS_MODE=DISABLED ayarlayın.' };
  if (has(11000, 85, 86)) return { code: 'MONGO_INDEX_CONFLICT', message: 'MongoDB indeksleri veya mevcut kayıtlar çakışıyor. Veriyi/indeksleri silmeden çakışmayı inceleyin.' };
  return { code: 'STARTUP_FAILED', message: 'Sunucu başlatılamadı. Server klasöründe npm.cmd run doctor ile yapılandırma ve servis erişimini kontrol edin.' };
}
