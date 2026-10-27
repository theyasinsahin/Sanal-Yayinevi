import { PrintAsset, PrintApplication } from '../../models/printFunding.js';
import { actor, id, fail, hash, text, assertPrintSystem } from './common.js';

export async function uploadAsset(context, bytes, filename) {
  assertPrintSystem();
  const user = await actor(context);
  if (!Buffer.isBuffer(bytes) || bytes.length < 10 || bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-' || !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))) throw fail('Geçerli, en fazla 10 MB PDF dosyası gerekli.');
  const sha256 = hash(bytes), safeName = text(filename || 'baski.pdf', 'Dosya adı', 1, 120).replace(/[^\p{L}\p{N}._ -]/gu, '_');
  let asset = await PrintAsset.findOne({ ownerId: user._id, sha256 }).exec();
  if (!asset) { try { asset = await PrintAsset.create({ ownerId: user._id, sha256, bytes: bytes.length, filename: safeName, mime: 'application/pdf', data: bytes }); } catch (error) { if (error.code !== 11000) throw error; asset = await PrintAsset.findOne({ ownerId: user._id, sha256 }).exec(); } }
  return { id: asset.id, sha256: asset.sha256, bytes: asset.bytes, filename: asset.filename };
}
export async function downloadAsset(context, assetId) {
  const user = await actor(context), asset = await PrintAsset.findById(id(assetId)).select('+data').exec();
  if (!asset) throw fail('Dosya bulunamadı.');
  if (user.role !== 'ADMIN' && String(asset.ownerId) !== user.id) {
    const allowed = await PrintApplication.exists({ authorId: user._id, $or: [{ 'verifiedQuote.layoutAssetId': asset.id }, { 'verifiedQuote.quoteAssetId': asset.id }] });
    // Authors retain access to referenced technical documents, never to unrelated uploads.
    if (!allowed) throw fail('Bu dosyaya erişim yetkiniz yok.', 'FORBIDDEN');
  }
  if (hash(asset.data) !== asset.sha256) throw fail('Dosya bütünlük kontrolü başarısız.', 'ASSET_INTEGRITY');
  return asset;
}
