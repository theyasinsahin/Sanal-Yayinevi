import React, { useEffect } from 'react';
import { gql, useQuery } from '@apollo/client';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import NotFoundPage from '../../pages/NotFoundPage';

export const RESOLVE_PUBLIC_ROUTE = gql`
  query ResolvePublicRoute($type: PublicRouteType!, $reference: String!, $legacy: Boolean, $chapter: String) {
    resolvePublicRoute(type: $type, reference: $reference, legacy: $legacy, chapter: $chapter) { id path chapterId }
  }
`;

export default function PublicContentRoute({ type, legacy = false, reader = false, children }) {
  const params = useParams();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reference = params.username || params.slug || params.userId || params.id || params.bookId || params.sessionId;
  const chapter = params.chapterSlug || (reader && legacy ? query.get('chapter') : null);
  const { data, loading, error, refetch } = useQuery(RESOLVE_PUBLIC_ROUTE, {
    variables: { type, reference, legacy, chapter: chapter || null },
    fetchPolicy: 'network-only',
  });
  const route = data?.resolvePublicRoute;
  const path = route && (reader && !route.chapterId ? `${route.path}/oku` : route.path);
  useEffect(() => {
    if (!path) return undefined;
    const existing = document.querySelector('link[rel="canonical"]');
    const link = existing || document.createElement('link');
    const previous = link.href;
    link.rel = 'canonical';
    link.href = `${window.location.origin}${path}`;
    if (!existing) document.head.appendChild(link);
    return () => { if (existing) link.href = previous; else link.remove(); };
  }, [path]);
  if (loading) return <div className="ui-notice" role="status">Sayfa yükleniyor…</div>;
  if (error) return <div className="ui-notice" role="alert">Sayfa yüklenemedi. <button className="ui-text-link" onClick={() => refetch()}>Tekrar dene</button></div>;
  if (!route) return <NotFoundPage />;
  if (legacy && reader) query.delete('chapter');
  const search = query.toString();
  if (location.pathname !== path) return <Navigate replace to={`${path}${search ? `?${search}` : ''}${location.hash}`} />;
  return React.cloneElement(children, { resolvedId: route.id, resolvedChapterId: route.chapterId, key: route.id });
}
