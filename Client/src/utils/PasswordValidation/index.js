export const PASSWORD_RULES = [
  { id: 'length',    label: 'En az 8 karakter',  test: (p) => p.length >= 8 },
  { id: 'uppercase', label: 'En az 1 büyük harf', test: (p) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'En az 1 küçük harf', test: (p) => /[a-z]/.test(p) },
  { id: 'number',    label: 'En az 1 rakam',      test: (p) => /[0-9]/.test(p) },
  { id: 'special',   label: 'En az 1 özel karakter (!@#$...)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const validatePassword = (password) => {
  const results = PASSWORD_RULES.map(rule => ({
    ...rule,
    passed: rule.test(password)
  }));
  const isValid = results.every(r => r.passed);
  return { results, isValid };
};