import React from 'react';
import { Link } from 'react-router-dom';
import { bookPath } from '../../../utils/publicPaths';
import QuoteCard from '../QuoteCard';
import './ProfileQuoteGroups.css';

export default function ProfileQuoteGroups({ quotes }) {
  const groups = new Map();
  for (const quote of quotes) {
    const book = (quote.isRepost ? quote.originalQuote?.book : quote.book) || quote.book;
    const key = book?.id || 'unknown';
    if (!groups.has(key)) groups.set(key, { book, quotes: [] });
    groups.get(key).quotes.push(quote);
  }
  return <div className="profile-quote-groups">{Array.from(groups, ([key, group]) =>
    <section key={key} className="profile-quote-group" aria-label={group.book?.title || 'Kitabı bulunamayan alıntılar'}>
      <header className="profile-quote-group-heading">
        {group.book?.imageUrl && <img src={group.book.imageUrl} alt="" />}
        <h3>{group.book ? <Link to={bookPath(group.book)}>{group.book.title}</Link> : 'Kitabı bulunamayan alıntılar'}</h3>
        <span>{group.quotes.length} alıntı</span>
      </header>
      <div className="quotes-tab-grid">{group.quotes.map(quote => <QuoteCard key={quote.id} quote={quote} showBookSource={false} />)}</div>
    </section>
  )}</div>;
}
