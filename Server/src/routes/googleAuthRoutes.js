// src/routes/googleAuthRoutes.js
//
// Google Identity Services'ın ux_mode="redirect" modunda kullandığı
// callback endpoint'i. Popup + postMessage akışının aksine, Google
// burada tarayıcıyı GERÇEK bir form-POST ile bu URL'e yönlendirir
// (window.postMessage kullanılmaz), bu yüzden Cross-Origin-Opener-Policy
// bu akışı hiçbir şekilde etkilemez.
//
// Google Cloud Console'da bu domain'in (örn. http://localhost:5000)
// OAuth Client ID'nin "Authorized JavaScript origins" listesinde
// olması gerekir.
import express from 'express';
import * as UserService from '../services/userService.js';

const router = express.Router();

router.post('/callback', async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  try {
    const credential = req.body?.credential;

    if (!credential) {
      return res.redirect(`${clientUrl}/login?error=google_no_credential`);
    }

    const { token, user } = await UserService.authenticateWithGoogleCredential(credential);

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
    return res.redirect(`${clientUrl}/auth/callback?token=${token}&user=${encodedUser}`);
  } catch (err) {
    console.error('Google callback hatası:', err.message);
    return res.redirect(`${clientUrl}/login?error=google_auth_failed`);
  }
});

export default router;