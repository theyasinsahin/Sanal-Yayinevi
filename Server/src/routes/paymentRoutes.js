import express from 'express';

const router = express.Router();
// Historical records remain read-only until a separately approved reconciliation.
router.post('/callback', (_, res) => res.status(410).json({ error: 'LEGACY_PAYMENT_DISABLED', message: 'Eski ödeme dönüşü kapalı. Geçmiş işlemler manuel sağlayıcı uzlaştırması gerektirir.' }));
export default router;