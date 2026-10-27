import express from 'express';
import User from '../models/user.js';
import { authenticateUser } from '../utils/auth.js';
import { uploadAsset, downloadAsset } from '../services/print/assetService.js';
import { receiveWebhook } from '../services/print/paymentService.js';
import { actor } from '../services/print/common.js';

const router = express.Router();
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
