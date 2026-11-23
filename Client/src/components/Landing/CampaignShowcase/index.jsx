import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { Container } from '../../UI/Container';
import { Book3D } from '../../UI/Book3D';
import BookFundingProgress from '../../Books/BookCard/BookFundingProgress';
import SectionHeading from '../SectionHeading';
import { useBookFeed } from '../../../hooks/useBookFeed';
import { useOptionalFilters } from '../../../context/FiltersContext';
import { bookPath } from '../../../utils/publicPaths';
import { getOptimizedImage } from '../../../utils/ImageUtils';
import './CampaignShowcase.css';

const FILTERS = { sortBy: 'closestToTarget' };
const OPTIONS = { limit: 3 };
const DAY = 86400000;

// BookFundingProgress ile aynı kural: açık ya da hedefi tamamlanmış kampanya
const isShowable = funding => !!funding && funding.targetMinor > 0
  && ((funding.isOpen && new Date(funding.endsAt) > new Date()) || funding.goalReached);

const daysLeft = endsAt => {
  const days = Math.ceil((new Date(endsAt) - Date.now()) / DAY);
  return days > 0 ? `${days} gün kaldı` : null;
};

const authorName = book => book.author?.fullName || book.author?.username || book.printedAuthor || '';

/**
 * Hedefe en yakın basım kampanyaları için bordo vitrin. Sorgu yalnızca
 * bölüme yaklaşıldığında atılır; gösterilecek kampanya yoksa bölüm çizilmez.
 */
const CampaignShowcase = () => {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '400px 0px', fallbackInView: true });
  const { books } = useBookFeed(FILTERS, inView, OPTIONS);
  const campaigns = useMemo(() => books.filter(book => isShowable(book.fundingSummary)), [books]);
  const updateFilters = useOptionalFilters()?.updateFilters;

  if (!campaigns.length) return <div ref={ref} aria-hidden="true" />;

  return (
    <section ref={ref} className="campaign-showcase cinema-band" aria-labelledby="campaign-showcase-title">
      <Container maxWidth="7xl">
        <SectionHeading
          tone="light"
          eyebrow="Basım kampanyaları"
          titleId="campaign-showcase-title"
          title={<>Okurların desteğiyle <em>rafa yürüyen</em> kitaplar</>}
          description="Hedefine en yakın kampanyalar. Bir kitabın basılmasına siz de ortak olun."
          action={<Link to="/feed" className="section-link" onClick={() => updateFilters?.('sortBy', 'closestToTarget')}>Tüm kampanyalar →</Link>}
        />

        <ul className="campaign-list">
          {campaigns.map(book => {
            const remaining = book.fundingSummary.isOpen ? daysLeft(book.fundingSummary.endsAt) : null;
            const author = authorName(book);
            return (
              <li key={book.id} className="campaign-card">
                <Link to={bookPath(book)} className="campaign-cover" tabIndex={-1} aria-hidden="true">
                  <Book3D
                    src={book.imageUrl ? getOptimizedImage(book.imageUrl, 240, 360) : ''}
                    alt=""
                    size="sm"
                    angle={-18}
                  />
                </Link>
                <div className="campaign-body">
                  {remaining && <p className="campaign-deadline">{remaining}</p>}
                  <h3 className="campaign-title"><Link to={bookPath(book)}>{book.title}</Link></h3>
                  {author && <p className="campaign-author">{author}</p>}
                  <BookFundingProgress funding={book.fundingSummary} />
                  {book.backerCount > 0 && <p className="campaign-backers">{book.backerCount} destekçi</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
};

export default CampaignShowcase;
