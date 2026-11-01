import express from 'express';
import User from '../models/user.js';
import { authenticateUser } from '../utils/auth.js';
import { uploadAsset, downloadAsset } from '../services/print/assetService.js';
import { receiveWebhook, reconcilePayment } from '../services/print/paymentService.js';
import IyzicoCheckout from '../models/iyzicoCheckout.js';
import { actor, id, fail } from '../services/print/common.js';

const router = express.Router();
router.post('/iyzico/callback/:reference', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const reference = id(req.params.reference);
    if (typeof req.body.token !== 'string' || req.body.token.length > 512) throw fail('Ödeme dönüşü geçersiz.', 'FORBIDDEN');
    const checkout = await IyzicoCheckout.findOne({ merchantReference: reference, token: req.body.token }).select('_id').lean();
    if (!checkout) throw fail('Ödeme dönüşü doğrulanamadı.', 'FORBIDDEN');
    await reconcilePayment(reference, { checkoutCompleted: true });
    res.redirect(303, new URL('/funding-history', process.env.CLIENT_URL || 'http://localhost:3000').href);
  } catch (error) { errorResponse(error, res); }
});
const errorResponse = (error, res) => {
  const code = error.extensions?.code;
  res.status(code === 'UNAUTHENTICATED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'PAYMENTS_DISABLED' ? 503 : code === 'BAD_USER_INPUT' ? 400 : 500).json({ error: code || 'PRINT_SERVICE_UNAVAILABLE', message: code ? error.message : 'Basım servisi işlemi tamamlayamadı.' });
};
router.post('/webhooks/sandbox', express.raw({ type: 'application/json', limit: '32kb' }), async (req, res) => {
  try { await receiveWebhook(req.body, req.headers); res.status(200).json({ received: true }); } catch (error) { errorResponse(error, res); }
});
router.post('/assets', async (req, res, next) => {
  try { req.printUser = await authenticateUser(req, User); await actor({ user: req.printUser }); next(); } catch (error) { errorResponse(error, res); }
}, express.raw({ type: 'application/pdf', limit: '10mb' }), async (req, res) => {
  try { res.status(201).json(await uploadAsset({ user: req.printUser }, req.body, req.headers['x-filename'])); } catch (error) { errorResponse(error, res); }
});
router.get('/assets/:id', async (req, res) => {
  try {
    const user = await authenticateUser(req, User), asset = await downloadAsset({ user }, req.params.id);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="print-document.pdf"', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-store', ETag: `"${asset.sha256}"` }); res.send(asset.data);
  } catch (error) { errorResponse(error, res); }
});
export default router;
