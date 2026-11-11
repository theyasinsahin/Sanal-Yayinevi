import React, { lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';

const FoxDecorations = lazy(() => import('./FoxDecorations'));

export default function PersonalFoxes() {
  const { user, loading } = useAuth();
  // This is the signed-in viewer, never the profile or username in the URL.
  // Keep the comparison exact: guests and other accounts load no fox assets.
  if (loading || !user?.id || user.username !== 'kolelkaa') return null;
  return <Suspense fallback={null}><FoxDecorations key={user.id} /></Suspense>;
}
