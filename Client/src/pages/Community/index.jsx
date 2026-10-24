import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Person from '@mui/icons-material/Person';
import MenuBook from '@mui/icons-material/MenuBook';
import AutoStories from '@mui/icons-material/AutoStories';
import EditNote from '@mui/icons-material/EditNote';
import Forum from '@mui/icons-material/Forum';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Button } from '../../components/UI/Button';
import { useQuery, useMutation } from '@apollo/client';
import { GET_AUTHORS, GET_COMMUNITY_CONFIG } from '../../graphql/queries/community';
import { SEND_CONTACT_MESSAGE, MANAGE_NEWSLETTER } from '../../graphql/mutations/community';
import { legalDocuments } from './legalDocuments';
import './Community.css';

export function Page({ title, description, children, document = false }) {
  useEffect(() => {
    const previousTitle = window.document.title;
    let meta = window.document.querySelector('meta[name="description"]');
    const created = !meta;
    if (!meta) { meta = window.document.createElement('meta'); meta.name = 'description'; window.document.head.appendChild(meta); }
    const previousDescription = meta.content;
    window.document.title = `${title} | Betik`; meta.content = description;
    return () => { window.document.title = previousTitle; if (created) meta.remove(); else meta.content = previousDescription; };
  }, [title, description]);
  return <MainLayout><div className={`community-page ${document ? 'community-document' : ''}`}><header><span className="community-eyebrow">Betik / Topluluk</span><h1>{title}</h1><p>{description}</p></header>{children}</div></MainLayout>;
}
function Discover() { return <div className="community-cta"><Link to="/feed">Kitapları keşfet</Link><Link to="/create-book">Hikâyeni yaz</Link></div>; }

function AuthorCard({ author }) {
  const [broken, setBroken] = useState(false);
  return <Link to={`/user/${author.id}`} className="community-card">
    {author.profilePicture && !broken ? <img loading="lazy" className="community-avatar" src={author.profilePicture} alt="" onError={() => setBroken(true)} /> : <Person className="community-avatar" aria-hidden="true" />}
    <h2>{author.fullName || author.username}</h2><p>@{author.username}</p>{author.bio && <p className="community-bio">{author.bio}</p>}<strong>{author.bookCount} kitap</strong><p>{author.pageCount} sayfa</p>
  </Link>;
}
export function AuthorsPage() {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(requested) && requested > 0 && requested <= 10000 ? requested : 1;
  const { data, loading, error, refetch } = useQuery(GET_AUTHORS, { variables: { page }, notifyOnNetworkStatusChange: true });
  const authors = data?.getAuthors;
  return <Page title={authors ? `Topluluğumuzdaki ${authors.total} Yazar` : 'Yazarlar'} description="Hikâyeleriyle Betik’e hayat veren yazarlarla tanışın. Yazarların herkese açık kitapları bu listede sayılır.">
    {loading && <p role="status">Yazarlar yükleniyor…</p>}
    {error && <div role="alert"><p>{error.message}</p><Button onClick={() => refetch()}>Tekrar dene</Button></div>}
    {authors && <>{authors.authors.length ? <div className="community-grid">{authors.authors.map(author => <AuthorCard key={author.id} author={author} />)}</div> : <div className="community-empty"><EditNote aria-hidden="true" /><h2>Bu sayfada henüz bir yazar yok</h2><p>Herkese açık kitaplarını paylaşan yazarlar burada yer alacak.</p><Discover /></div>}
    <nav className="community-pagination" aria-label="Yazar sayfaları"><Button disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>Önceki</Button><span>Sayfa {page} / {authors.totalPages}</span><Button disabled={page >= authors.totalPages} onClick={() => setParams({ page: String(page + 1) })}>Sonraki</Button></nav></>}
  </Page>;
}
export function PublishedBooksPage() {
  return <Page title="Basılan Eserler" description="Ekranda başlayan hikâyelerin, bir gün kitaplığınızda yer bulmasını istiyoruz."><PrintedBooks books={[]} /></Page>;
}
// Only feed this component records independently verified as physically printed.
export function PrintedBooks({ books }) {
  if (books.length) return <div className="community-grid">{books.map(book => <Link className="community-card" key={book.id} to={`/book-detail/${book.id}`}><h2>{book.title}</h2><p>Fiziksel basımı tamamlandı</p></Link>)}</div>;
  return <div className="community-empty"><MenuBook aria-hidden="true" /><h2>İlk basılı hikâyemize doğru</h2><p>Betik’te henüz fiziksel basımı tamamlanmış bir eser bulunmuyor. Dijital olarak yayımlanan kitaplar bu listeden ayrı tutulur.</p><p>Hedefimiz, yazarların okurlarıyla kurduğu bağı büyütmek ve okur desteğiyle eserlerin basılı kitaba dönüşmesine alan açmak. Siz de bugün bir hikâyeyi keşfederek bu yolculuğa katılabilirsiniz.</p><Discover /></div>;
}
export function AboutPage() {
  return <Page title="Her hikâye bir okurla büyür" description="Betik, yazma cesaretini okuma merakıyla buluşturan sosyal bir yazarlık ve yayıncılık platformudur.">
    <div className="community-grid">{[
      ['Betik nedir?', 'Yazarların kitaplarını bölüm bölüm oluşturabildiği ve dijital olarak paylaşabildiği; okurların yeni eserlerle tanışabildiği bir buluşma alanı.', AutoStories],
      ['Neden Betik?', 'Bir hikâyeyi yazmak kadar onu paylaşmak da emek ister. Yazarların ilk satırdan itibaren okurlarıyla bağ kurabileceği bir alan oluşturmak için yola çıktık.', EditNote],
      ['Misyonumuz', 'Yazmayı ve okumayı ortak bir deneyime dönüştürmek; farklı seslerin görünür olmasına, eserlerin geri bildirimle gelişmesine katkı sağlamak.', Forum],
    ].map(([title, body, Icon]) => <section className="community-card" key={title}><Icon aria-hidden="true" /><h2>{title}</h2><p>{body}</p></section>)}</div>
    <section className="community-empty" style={{ marginTop: '2rem', textAlign: 'left' }}><h2>Nasıl çalışır?</h2><p>1. Yazar bir kitap oluşturur, bölümlerini yazar ve paylaşmaya hazır olduğunda okurlara açar.</p><p>2. Okurlar kitapları keşfeder, okur; yorumlar ve alıntılarla hikâyenin etrafındaki sohbete katılır.</p><p>3. Uzun vadeli hedefimiz, basım maliyetine göre belirlenen destek hedefleriyle fiziksel baskıya giden yolu açmaktır. Destek toplanması tek başına basım garantisi değildir; koşullar eser bazında açıklanmalıdır.</p><h2>Yazarlar ve okurlar için</h2><p>Yazarlar için eserlerini geliştirebilecekleri bir çalışma ve paylaşım alanı; okurlar için yeni hikâyeler, takip edebilecekleri yazarlar ve kitaplar üzerine etkileşim sunuyoruz.</p><h2>Vizyonumuz</h2><p>Bir eserin geleceğinin yalnızca ilk başvuruda değil, onu okuyan insanların kurduğu bağla da şekillenebildiği bir yayıncılık kültürü. Henüz basılı bir eserimiz yok; bu hedefe topluluğumuzla birlikte ilerlemek istiyoruz.</p><Discover /></section>
  </Page>;
}
export function ContactPage() {
  const { data: configData } = useQuery(GET_COMMUNITY_CONFIG);
  const config = configData?.getCommunityConfig;
  const [sendContactMessage] = useMutation(SEND_CONTACT_MESSAGE);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function submit(event) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setResult(null);
    try { const response = await sendContactMessage({ variables: { input: Object.fromEntries(new FormData(form)) } }); setResult({ message: response.data.sendContactMessage.message }); form.reset(); }
    catch (error) { setResult({ error: true, message: error.message }); }
    finally { setBusy(false); }
  }
  return <Page title="İletişim" description="Bir sorunuz, öneriniz veya eserlerle ilgili bir bildiriminiz mi var? Bize yazın."><div className="community-contact"><form className="community-form" onSubmit={submit}>
    <label>Ad Soyad<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
    <label>E-posta Adresi<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label>Konu<input name="subject" required minLength={3} maxLength={150} /></label>
    <label>Mesaj<textarea name="message" required minLength={10} maxLength={5000} /></label>
    <div hidden><label>Web sitesi<input name="website" autoComplete="off" tabIndex={-1} /></label></div>
    <p>Adınız, e-posta adresiniz ve mesajınız talebinizi yanıtlamak için e-posta hizmeti aracılığıyla iletilir. Lütfen mesajınıza hassas kişisel bilgi eklemeyin. <Link to="/privacy">Gizlilik taslağını okuyun.</Link></p>
    <Button type="submit" isLoading={busy}>Mesajı gönder</Button>{result && <p role={result.error ? 'alert' : 'status'}>{result.message}</p>}
  </form><aside><h2>Bize ulaşın</h2>{config?.email ? <p><a href={`mailto:${config.email}`}>{config.email}</a></p> : <p>İletişim e-posta adresi henüz yayımlanmadı.</p>}{config?.phone ? <p><a href={`tel:${config.phone.replace(/[^+\d]/g, '')}`}>{config.phone}</a></p> : <p>Telefon bilgisi henüz yayımlanmadı.</p>}<p>Doğrulanmış sosyal medya hesaplarımıza sayfanın altından ulaşabilirsiniz.</p></aside></div></Page>;
}
export function LegalPage({ kind }) {
  const document = legalDocuments[kind];
  return <Page document title={document.title} description="Hukuki incelemeye sunulacak başlangıç taslağı · 23 Ekim 2026"><p className="community-draft">Bu metin taslaktır. Veri sorumlusu, başvuru kanalları ve işleyişe ilişkin eksik bilgiler tamamlanıp hukuki inceleme yapılmadan nihai politika olarak değerlendirilmemelidir.</p><nav aria-label="İçindekiler">{document.sections.map(([title], index) => <a key={title} href={`#section-${index}`}>{title}</a>)}</nav>{document.sections.map(([title, body], index) => <section id={`section-${index}`} key={title}><h2>{title}</h2><p>{body}</p></section>)}<Link to="/contact">İletişime geçin</Link></Page>;
}
export function NewsletterPage() {
  const [manageNewsletter] = useMutation(MANAGE_NEWSLETTER);
  const [params] = useSearchParams(); const [result, setResult] = useState(''); const [busy, setBusy] = useState(false);
  const action = params.get('action'); const token = params.get('token');
  const valid = ['confirm', 'unsubscribe'].includes(action) && /^[a-f0-9]{64}$/.test(token || '');
  async function manage() { setBusy(true); try { const response = await manageNewsletter({ variables: { token, action } }); setResult(response.data.manageNewsletter.message); } catch (error) { setResult(error.message); } finally { setBusy(false); } }
  return <Page title="Bülten aboneliğiniz" description="Abonelik tercihinizi yönetin."><div className="community-empty">{valid ? <><p>{action === 'confirm' ? 'Betik bültenini almak için e-posta adresinizi doğrulayın.' : 'Betik bülten aboneliğinizi iptal edebilirsiniz.'}</p><Button isLoading={busy} onClick={manage}>{action === 'confirm' ? 'Aboneliğimi doğrula' : 'Abonelikten çık'}</Button></> : <p>Geçersiz bağlantı. Size gönderilen e-postadaki bağlantıyı kullanın.</p>}{result && <p role="status">{result}</p>}</div></Page>;
}
