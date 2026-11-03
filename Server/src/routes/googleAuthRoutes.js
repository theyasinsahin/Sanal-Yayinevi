// src/routes/googleAuthRoutes.js
//
// Google Identity Services'ın ux_mode="redirect" modunda kullandığı
// callback endpoint'i. Popup + postMessage akışının aksine, Google
// burada tarayıcıyı GERÇEK bir form-POST ile bu URL'e yönlendirir
// (window.postMessage kullanılmaz), bu yüzden Cross-Origin-Opener-Policy
// bu akışı hiçbir şekilde etkilemez.
//
// Google Cloud Console'da frontend origin'i ve login_uri'nin tam adresi
// ayrı ayrı kaydedilir. Frontend/API farklı sitelerdeyse login_uri aynı
// frontend origin'indeki reverse proxy olmalı; POST gövdesi ve Cookie
// header'ı bu endpoint'e korunarak iletilmelidir.
import express from 'express';
import * as UserService from '../services/userService.js';
import { timingSafeEqual } from 'node:crypto';
import { consumeRate } from '../security/rateLimit.js';

const router = express.Router();

router.post('/callback', async (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  try {
    const credential = req.body?.credential;

    if (!credential) {
      return res.redirect(`${clientUrl}/login?error=google_no_credential`);
    }

    const cookies = String(req.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith('g_csrf_token=')).map(value => value.slice('g_csrf_token='.length));
    const csrf = req.body?.g_csrf_token;
    if (cookies.length !== 1 || typeof csrf !== 'string' || csrf.length < 16 || csrf.length > 512 || Buffer.byteLength(cookies[0]) !== Buffer.byteLength(csrf) || !timingSafeEqual(Buffer.from(cookies[0]), Buffer.from(csrf))) return res.status(403).json({ error: 'GOOGLE_CSRF_FAILED' });
    if (typeof credential !== 'string' || credential.length > 8192) return res.status(400).json({ error: 'BAD_REQUEST' });
    await consumeRate('google-callback', req.ip || req.socket.remoteAddress, 20, 15 * 60000);
    const { token, user, loginNonce } = await UserService.authenticateWithGoogleCredential(credential, { requireNonce: true });

    // Frontend'e göndereceğimiz kullanıcı verisini daralt (parola vb. hassas alanlar hariç)
    const userPayload = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isPremium: user.isPremium,
      profilePicture: user.profilePicture,
    };

    const encodedUser = encodeURIComponent(JSON.stringify(userPayload));

    // Frontend'deki /auth/callback route'una yönlendir; o sayfa
    // token'ı okuyup AuthContext.login() ile localStorage'a yazacak.
    return res.redirect(`${clientUrl}/auth/callback#token=${encodeURIComponent(token)}&user=${encodedUser}&nonce=${encodeURIComponent(loginNonce)}`);
  } catch (err) {
    console.error('GOOGLE_CALLBACK_FAILED');
    return res.redirect(`${clientUrl}/login?error=google_auth_failed`);
  }
});

export default router;
