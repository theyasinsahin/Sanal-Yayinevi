import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { consumeRegistrationIntent, requestRegistration } from '../utils/registrationIntent';

export function useRegistration() {
  const location = useLocation();
  return useCallback(intent => requestRegistration({ returnTo: `${location.pathname}${location.search}${location.hash}`, ...intent }), [location]);
}

export function useRestoredRegistration(action, identity = {}) {
  const { user } = useAuth() || {};
  const [restored, setRestored] = useState(null);
  const handled = useRef(null);
  const identityKey = JSON.stringify(identity);
  useEffect(() => {
    if (!user?.id || handled.current === `${user.id}:${identityKey}`) return;
    handled.current = `${user.id}:${identityKey}`;
    const expected = JSON.parse(identityKey);
    const intent = consumeRegistrationIntent(action, item => Object.entries(expected).every(([key, value]) => String(item[key]) === String(value)), user.id);
    setRestored(intent);
  }, [action, identityKey, user?.id]);
  return restored?.ownerId === user?.id ? restored : null;
}
