export function safeImageSource(value) {
  if (typeof value !== 'string') return false;
  if (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value)) return true;
  const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+={0,2})$/i.exec(value);
  if (!match || match[2].length > 450000) return false;
  const bytes = Buffer.from(match[2], 'base64');
  return match[1].toLowerCase() === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
    match[1].toLowerCase() === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
}
