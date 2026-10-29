import { randomBytes } from 'node:crypto';
import { assertIsolatedPrintSandbox } from '../utils/isolatedPrintSandbox.js';

export function sandboxEnvironment(uri, base = process.env) {
  const env = {};
  // OS/runtime settings only: do not inherit deployment DB, mail, payment or tokens.
  for (const [key, value] of Object.entries(base)) {
    if (['path', 'pathext', 'systemroot', 'windir', 'comspec', 'temp', 'tmp', 'userprofile', 'appdata', 'localappdata', 'home', 'lang', 'number_of_processors'].includes(key.toLowerCase())) env[key] = value;
  }
  Object.assign(env, {
    NODE_ENV: 'development', BETIK_ISOLATED_PRINT_SANDBOX: 'true', MONGO_URI: uri,
    PORT: '5125', CLIENT_URL: 'http://127.0.0.1:3125', JWT_SECRET: randomBytes(32).toString('hex'),
    PRINT_SYSTEM_ENABLED: 'true', PRINT_PAYMENTS_MODE: 'SANDBOX',
    PRINT_SANDBOX_WEBHOOK_SECRET: randomBytes(32).toString('hex'), PRINT_ADDRESS_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  });
  assertIsolatedPrintSandbox(env);
  return env;
}

export function samplePdf(title) {
  if (!/^[a-zA-Z0-9 -]+$/.test(title)) throw new Error('Örnek PDF başlığı ASCII olmalı.');
  const stream = `BT /F1 16 Tf 50 780 Td (${title}) Tj 0 -28 Td (SANDBOX ONLY - No production or delivery contract.) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

export async function seedSandbox(uri) {
  assertIsolatedPrintSandbox({ NODE_ENV: 'development', MONGO_URI: uri });
  const { default: mongoose } = await import('mongoose');
  mongoose.set('autoCreate', false); mongoose.set('autoIndex', false);
  const [{ default: bcrypt }, { default: User }, { default: Book }, { default: Chapter }, common, applications] = await Promise.all([
    import('bcryptjs'), import('../models/user.js'), import('../models/book.js'), import('../models/chapter.js'), import('../services/print/common.js'), import('../services/print/applicationService.js'),
  ]);
  await mongoose.connect(uri);
  try {
    // Fresh DB only; never reset, overwrite or seed an existing database.
    if ((await mongoose.connection.db.listCollections().toArray()).length) throw new Error('Sandbox seed yalnızca boş geçici veritabanında çalışır.');
    await common.initializePrintFunding();
    await Promise.all([User.createIndexes(), Book.createIndexes(), Chapter.createIndexes()]);
    const password = `Sandbox-${randomBytes(9).toString('hex')}`, hashed = await bcrypt.hash(password, 10);
    const users = {};
    for (const [name, fullName, role] of [['author', 'Sandbox Yazar', 'USER'], ['admin', 'Sandbox Yönetici', 'ADMIN'], ['reader', 'Sandbox Okuyucu', 'USER']]) {
      users[name] = await User.create({ username: `sandbox_${name}`, fullName, role, email: `${name}@betik-sandbox.invalid`, password: hashed, isVerified: true });
    }
    const books = [];
    for (const [title, status] of [['Sandbox Başarı ve Teslimat', 'COMPLETED'], ['Sandbox İptal ve İade', 'COMPLETED'], ['Sandbox Sıfırdan Yayın ve Başvuru', 'DRAFT']]) {
      const book = await Book.create({ title, authorId: users.author._id, description: 'Yalnızca yerel sandbox testi. Gerçek ödeme ve teslimat yoktur.', status, digitalStatus: status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED', writingStatus: status === 'DRAFT' ? 'WRITING' : 'COMPLETED', pageCount: 1 });
      const chapter = await Chapter.create({ bookId: book._id, authorId: users.author._id, title: 'Örnek Bölüm', pageCount: 1, content: '<p>Bu kitap yerel basım ve destek akışının denenmesi için oluşturulmuş örnek metindir. Gerçek eser, ödeme veya fiziksel teslimat taahhüdü değildir.</p>' });
      book.chapters = [chapter._id]; await book.save(); books.push({ id: book.id, title });
    }
    users.author.usersBooks = books.map(book => book.id); await users.author.save();
    const tariff = await applications.createTariff({ user: users.admin }, {
      version: 'local-sandbox-v1', label: 'ÖRNEK SANDBOX — gerçek matbaa teklifi değildir',
      pageRates: { enzo: 10, ivory: 15, coated: 20 }, coverRates: { paperback: 1000, hardcover: 2000 }, dimensionBps: { '13.5x21': 10000, '16x24': 12000 },
      colorBps: 20000, setupMinor: 10000, packagingPerUnitMinor: 1000, shippingPerUnitMinor: 1000, serviceMinor: 10000, taxBps: 2000, feeBps: 500,
      policy: { donationMinMinor: 5000, donationMaxMinor: 10000000, quickAmountsMinor: [5000, 10000, 25000, 50000], campaignDays: 30, reservationMinutes: 15, maxOrderQuantity: 10 },
    });
    return { password, users: Object.fromEntries(Object.entries(users).map(([name, user]) => [name, { email: user.email, id: user.id }])), books, tariffId: tariff.id };
  } finally { await mongoose.disconnect(); }
}

export function sandboxGuide(data) {
  return `# Betik yerel basım sandbox\n\nAdres: http://127.0.0.1:3125/login\n\nYalnızca bu geçici ortamın test hesapları:\n\n${Object.entries(data.users).map(([name, user]) => `- ${name}: ${user.email}`).join('\n')}\n\nÜç hesap için test şifresi: \`${data.password}\`\n\nİşlemi açık tutun. Ctrl+C ortamı durdurur. Veritabanı geçicidir; kapatılınca test kayıtları kaybolur. Sonraki çalıştırma yeni hesaplar ve şifre oluşturur. Gerçek e-posta, kart veya adres kullanmayın. SMTP ve canlı ödeme anahtarları yüklenmez.\n\n## 1. Yazar\n\nAuthor hesabıyla giriş yapın. [Basım başvurusu](http://127.0.0.1:3125/print/${data.books[0].id}) ekranını açın. Örnek tarife hazırdır. Baskı adedini **10** seçin. Kapak için bu klasördeki cover.pdf dosyasını yükleyin, diğer baskı özelliklerini ve sandbox beyanlarını doldurun. Kaydedin, ardından incelemeye gönderin. Dijital yayınlamayı da denemek için üçüncü kitapta [yazı masası](http://127.0.0.1:3125/dashboard/${data.books[2].id}) ekranını kullanın.\n\n## 2. Yönetici onayı\n\nAyrı tarayıcı profili/gizli pencerede admin hesabıyla [basım yönetimine](http://127.0.0.1:3125/admin/print-funding) girin. Kendi yazar hesabınızla onay vermeyin. Başvuruda Onayla seçin. Gerekçe ve teklif referansına SANDBOX örnek inceleme yazın. Mizanpaj sayfası **1**; layout.pdf ve quote.pdf dosyalarını yükleyin. Bunlar bir sayfalık örnek PDF'lerdir, gerçek matbaa veya teknik preflight belgesi değildir.\n\n| Toplam gider (TL) | Tutar | Birim satış (TL) | Tutar |\n|---|---:|---|---:|\n| Matbaa üretimi | 500 | Birim üretim | 50 |\n| Kargo | 100 | Birim kargo | 10 |\n| Paketleme | 100 | Birim paketleme | 10 |\n| Vergi | 100 | Birim vergi | 10 |\n| Ödeme giderleri | 100 | Birim ödeme gideri | 10 |\n| Yayın hizmetleri | 100 | Birim hizmet | 10 |\n| Diğer | 0 | Satış payı | 100 |\n\nSandbox dosyalarını kontrol ettikten sonra teknik kontrol kutusunu işaretleyip kararı kaydedin. Hedef **1000 TL**, kitap fiyatı **200 TL** olur. Sonra ayrı kampanya açma kutusunu işaretleyin ve kampanyayı açın.\n\n## 3. Okuyucu ve test ödemesi\n\nReader hesabıyla [destek sayfasına](http://127.0.0.1:3125/donate/${data.books[0].id}) girin. **1 kitap + 800 TL karşılıksız destek** seçin. Toplam 1000 TL ile hedef tam karşılanır. Tamamen uydurma teslimat bilgisi kullanın. Koşulları onaylayıp test rezervasyonu oluşturun, ardından **Test ödemesini başarılı sonuçlandır** düğmesine basın. Kart gerekmez. Worker 15 saniye içinde kampanyayı uzlaştırır; yönetici kampanyalar sekmesinden bakım düğmesini de kullanabilir.\n\n## 4. Basım ve teslimat\n\nAdmin hesabında Kampanya ve üretim sekmesinden sırasıyla Matbaa onayı → Üretim başlangıcı → Baskıda → Baskı tamamlandı → Paketleme → Dağıtım adımlarını kaydedin. Her işlem için en az 5 karakter açıklama yazın. Ödeme, iade ve teslimat sekmesinde siparişi Paketleme → Kargoya verildi (Sandbox Kargo / TEST-12345) → Teslim edildi yapın. Ardından kampanyada Teslimatlar tamamlandı → Süreci tamamla adımlarını kaydedin. Reader hesabı [destek geçmişinden](http://127.0.0.1:3125/funding-history) ödeme ve siparişi takip eder.\n\n## 5. İade ve başarısız ödeme\n\nİlk kampanya hedefi tamamlandıktan sonra [ikinci kitapta](http://127.0.0.1:3125/print/${data.books[1].id}) aynı başvuru/onay akışını deneyin. Reader hesabıyla yalnız **50 TL destek** verip test ödemesini başarılı yapın. Admin kampanyayı iptal edip bakımı çalıştırsın: tam iade ve REFUNDED durumu görülmeli. Başka bir ödeme denemesinde **Başarısız ödeme dene** veya **Ödemeyi iptal et** seçeneklerini kullanabilirsiniz.\n\nGerçek matbaa/kargo/banka iletişimi yapılmaz; basım ve teslimat adımları yönetici durum kayıtlarıdır. Bu ortam production sisteminin kopyası değildir ve gerçek banka entegrasyonunu doğrulamaz.\n`;
}
