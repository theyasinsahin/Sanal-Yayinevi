// Email clients need inline styles, presentation tables and system font fallbacks.
// Dynamic content is escaped here; templates never accept caller-provided HTML.
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const lines = value => escapeHtml(value).replace(/\r?\n/g, '<br>');
function safeUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Geçersiz e-posta bağlantısı.');
  return url.href;
}
const paragraph = value => `<p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#4a4a4a;">${lines(value)}</p>`;
const note = value => `<p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#6b6b6b;">${lines(value)}</p>`;
const button = (label, url) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;"><tr><td bgcolor="#1a1a1a" style="border-radius:5px;text-align:center;mso-padding-alt:16px 26px;"><a href="${escapeHtml(safeUrl(url))}" style="display:inline-block;padding:16px 26px;border:1px solid #1a1a1a;border-radius:5px;color:#fafaf8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:1.4;">${escapeHtml(label)}</a></td></tr></table>`;
const fallback = url => `<p style="font:12px/1.8 Arial,Helvetica,sans-serif;color:#6b6b6b;overflow-wrap:anywhere;word-break:break-word;">Bağlantıyı açamıyorsan bu adresi tarayıcına kopyalayabilirsin:<br><a href="${escapeHtml(safeUrl(url))}" style="color:#4a4a4a;text-decoration:underline;">${escapeHtml(safeUrl(url))}</a></p>`;

function layout({ subject, preview, category, title, body, text, baseUrl = process.env.CLIENT_URL }) {
  let home = '';
  try { home = safeUrl(baseUrl); } catch { /* No fabricated brand URL. */ }
  const brand = '<span style="font:700 34px/1.2 Georgia,Times,serif;letter-spacing:-1px;color:#1a1a1a;">Betik<span style="color:#a89f8f;">.</span></span>';
  return {
    subject,
    text: `BETİK\n${title}\n\n${text}\n\nBetik · Her hikâye bir okurla büyür.`,
    html: `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f5f4f0;color:#1a1a1a;font-family:Georgia,Times,serif;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f5f4f0"><tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td style="padding:12px 20px 28px;">${home ? `<a href="${escapeHtml(home)}" style="text-decoration:none;">${brand}</a>` : brand}<div style="margin-top:8px;font:11px/1.6 Arial,Helvetica,sans-serif;letter-spacing:2px;color:#6b6b6b;">YAZ · PAYLAŞ · KEŞFET</div></td></tr>
<tr><td bgcolor="#fafaf8" style="border:1px solid #dcd7c8;border-top:4px solid #1a1a1a;border-radius:4px;padding:32px 24px;">
<p style="margin:0 0 16px;font:11px/1.6 Arial,Helvetica,sans-serif;letter-spacing:2px;color:#6b6b6b;">${escapeHtml(category)}</p>
<h1 style="margin:0 0 24px;font:700 29px/1.35 Georgia,Times,serif;color:#1a1a1a;">${escapeHtml(title)}</h1>
${body}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:32px;border-top:1px solid #e8e4d8;"><tr><td style="padding-top:20px;font:italic 15px/1.7 Georgia,Times,serif;color:#6b6b6b;">Her hikâye bir okurla büyür.</td></tr></table>
</td></tr><tr><td align="center" style="padding:24px 16px;font:12px/1.8 Arial,Helvetica,sans-serif;color:#6b6b6b;">Betik · Yazarların ve okurların buluşma yeri.<br>Bu e-posta Betik üzerindeki bir işlem için gönderildi.</td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}

export function registrationEmail({ code, username, baseUrl }) {
  const intro = `${username ? `Merhaba ${username},` : 'Merhaba,'} Betik’e hoş geldin. Hikâyeni paylaşmaya veya yeni bir hikâye keşfetmeye başlamadan önce e-posta adresini doğrulayalım.`;
  return layout({ subject: 'Betik · E-posta doğrulama kodun', preview: 'Betik hesabını oluşturmak için doğrulama kodunu kullan.', category: 'HİKÂYEN BURADA BAŞLIYOR', title: 'İlk adım, sana ait bir hesap.', baseUrl,
    body: paragraph(intro) + `<div style="background:#ebe8e0;border:1px solid #dcd7c8;border-radius:4px;padding:24px 12px;text-align:center;"><div style="font:11px/1.6 Arial,Helvetica,sans-serif;letter-spacing:2px;color:#6b6b6b;margin-bottom:12px;">DOĞRULAMA KODUN</div><div style="font:bold 34px/1.3 'Courier New',monospace;letter-spacing:7px;color:#1a1a1a;">${escapeHtml(code)}</div></div>` + note('Kayıt ekranına dönerek bu kodu 10 dakika içinde kullan. Kodunu kimseyle paylaşma.\nBu kaydı sen başlatmadıysan bu e-postayı dikkate almayabilirsin.'),
    text: `${intro}\n\nDoğrulama kodun: ${code}\nKayıt ekranında 10 dakika içinde kullan. Kodunu kimseyle paylaşma.\nBu kaydı sen başlatmadıysan bu e-postayı dikkate almayabilirsin.`,
  });
}

export function passwordResetEmail({ resetUrl, baseUrl }) {
  const url = safeUrl(resetUrl);
  return layout({ subject: 'Betik · Şifreni yenile', preview: 'Hesabına güvenle dönmek için şifreni yenileyebilirsin.', category: 'HESAP GÜVENLİĞİ', title: 'Hikâyene kaldığın yerden dön.', baseUrl,
    body: paragraph('Betik hesabın için bir şifre yenileme isteği aldık. Aşağıdaki düğmeden yeni şifreni belirleyebilirsin.') + button('Şifremi yenile', url) + paragraph('Bu bağlantı 1 saat geçerlidir. Güvenliğin için bağlantıyı başka biriyle paylaşma.') + fallback(url) + note('Bu isteği sen göndermediysen herhangi bir işlem yapmana gerek yok. Şifren bu bağlantıyı kullanmadan değişmez.'),
    text: `Betik hesabın için şifre yenileme isteği aldık.\nŞifreni yenile (1 saat geçerli):\n${url}\n\nBu isteği sen göndermediysen işlem yapmana gerek yok. Bağlantıyı kimseyle paylaşma.`,
  });
}

export function emailChangedEmail({ baseUrl } = {}) {
  return layout({ subject: 'Betik · E-posta adresin güncellendi', preview: 'Hesabının e-posta adresi başarıyla değiştirildi.', category: 'HESAP BİLDİRİMİ', title: 'Yeni adresinle yolculuğa devam.', baseUrl,
    body: paragraph('Betik hesabının e-posta adresi başarıyla güncellendi. Hesabınla ilgili e-postalar artık bu adrese gönderilecek.') + paragraph('Bu değişikliği sen yaptıysan başka bir işlem yapmana gerek yok.') + note('Değişikliği sen yapmadıysan hesabının güvenliğini kontrol et ve Betik’in iletişim sayfasından bize ulaş.'),
    text: 'Betik hesabının e-posta adresi başarıyla güncellendi. Hesabınla ilgili e-postalar artık bu adrese gönderilecek.\n\nBu değişikliği sen yapmadıysan hesabının güvenliğini kontrol et ve iletişim sayfasından bize ulaş.',
  });
}

export function contactMessageEmail({ name, email, subject, message, baseUrl }) {
  return layout({ subject: 'Betik · Yeni iletişim mesajı', preview: 'İletişim formundan yeni bir mesaj var.', category: 'TOPLULUKTAN BİR SES', title: 'Okunmayı bekleyen bir mesaj.', baseUrl,
    body: paragraph('Betik iletişim sayfası üzerinden yeni bir mesaj iletildi. Bu e-postayı yanıtladığında yanıtın mesajı gönderen kişinin adresine gider.') + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ebe8e0;border:1px solid #dcd7c8;border-radius:4px;"><tr><td style="padding:20px;font:14px/1.9 Arial,Helvetica,sans-serif;color:#4a4a4a;overflow-wrap:anywhere;word-break:break-word;"><strong>Gönderen:</strong> ${escapeHtml(name)}<br><strong>E-posta:</strong> ${escapeHtml(email)}<br><strong>Konu:</strong> ${escapeHtml(subject)}</td></tr></table>` + `<div style="margin-top:24px;font:16px/1.9 Georgia,Times,serif;color:#4a4a4a;overflow-wrap:anywhere;word-break:break-word;">${lines(message)}</div>` + note('Gönderenin paylaştığı bilgiler ve bağlantılar kullanıcı içeriğidir. Mesajı yanıtlarken yalnızca gerekli bilgileri paylaş.'),
    text: `İletişim formundan yeni mesaj.\nGönderen: ${name}\nE-posta: ${email}\nKonu: ${subject}\n\n${message}\n\nBu e-postayı yanıtlayarak gönderene ulaşabilirsin.`,
  });
}

export function newsletterConfirmationEmail({ confirmUrl, unsubscribeUrl, baseUrl }) {
  const confirm = safeUrl(confirmUrl); const unsubscribe = safeUrl(unsubscribeUrl);
  return layout({ subject: 'Betik · Bülten aboneliğini doğrula', preview: 'Betik’ten haber almak için son bir adım kaldı.', category: 'BETİK’TEN HABER VAR', title: 'Yeni hikâyelerden haberdar ol.', baseUrl,
    body: paragraph('Betik’teki gelişmelerden e-postayla haberdar olmak istedin. Aboneliğini başlatmak için e-posta adresini doğrulaman yeterli.') + button('Aboneliğimi doğrula', confirm) + paragraph('Doğrulama bağlantısı 24 saat geçerlidir. Onay verene kadar bülten aboneliğin aktif olmaz.') + fallback(confirm) + `<div style="margin-top:28px;padding:20px;background:#ebe8e0;border-radius:4px;font:14px/1.8 Arial,Helvetica,sans-serif;color:#4a4a4a;"><strong>Tercih her zaman senin.</strong><br>Bu e-postayı saklayarak daha sonra da <a href="${escapeHtml(unsubscribe)}" style="color:#1a1a1a;text-decoration:underline;">abonelikten çıkabilirsin</a>.</div>` + fallback(unsubscribe) + note('Bu isteği sen göndermediysen doğrulama düğmesini kullanma. Bağlantılarını başka biriyle paylaşma.'),
    text: `Betik’ten haber almak için aboneliğini doğrula (24 saat geçerli):\n${confirm}\n\nOnay vermeden aboneliğin aktif olmaz.\nAbonelikten çıkmak için bu bağlantıyı sakla:\n${unsubscribe}\n\nBu isteği sen göndermediysen doğrulama bağlantısını kullanma. Bağlantılarını kimseyle paylaşma.`,
  });
}
