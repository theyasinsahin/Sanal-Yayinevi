// Only the local sandbox launcher sets this marker. Never accept a deployment DB.
export function assertIsolatedPrintSandbox(env) {
  let uri;
  try { uri = new URL(env.MONGO_URI); } catch { throw new Error('Sandbox veritabanı adresi geçersiz.'); }
  if (env.NODE_ENV !== 'development' || uri.protocol !== 'mongodb:' || uri.hostname !== '127.0.0.1' || uri.username || uri.password || !/^\/betik_print_sandbox_[a-f0-9]{24}$/.test(uri.pathname)) {
    throw new Error('İzole basım sandbox yalnızca kendine ait yerel geçici veritabanıyla çalışabilir.');
  }
}
