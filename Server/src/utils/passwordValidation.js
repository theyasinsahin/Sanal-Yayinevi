export const validatePassword = (password) => {
  if (password.length < 8) return 'Şifre en az 8 karakter olmalıdır.';
  if (!/[A-Z]/.test(password)) return 'Şifre en az 1 büyük harf içermelidir.';
  if (!/[a-z]/.test(password)) return 'Şifre en az 1 küçük harf içermelidir.';
  if (!/[0-9]/.test(password)) return 'Şifre en az 1 rakam içermelidir.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Şifre en az 1 özel karakter içermelidir.';
  return null; // null = geçerli
};