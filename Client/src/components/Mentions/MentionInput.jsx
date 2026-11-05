import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { useQuery } from '@apollo/client';
import { SEARCH_MENTION_USERS } from '../../graphql/queries/mention';
import './Mentions.css';

export function activeMention(value, caret) {
  const match = value.slice(0, caret).match(/(^|[^\p{L}\p{N}_@./-])@([\p{L}\p{N}_.-]{0,50})$/u);
  if (!match) return null;
  return { start: caret - match[2].length - 1, end: caret, query: match[2] };
}

const MentionInput = forwardRef(function MentionInput({ as: Field = 'textarea', value = '', onChange, onKeyDown, onSelect, onBlur, disabled, ...props }, forwardedRef) {
  const root = useRef(null);
  const dismissed = useRef(false);
  const [token, setToken] = useState(null);
  const [search, setSearch] = useState(null);
  const [selected, setSelected] = useState(0);
  const listId = useId();
  const field = () => root.current?.querySelector('textarea, input');
  useImperativeHandle(forwardedRef, field);

  const currentToken = token && !disabled && value.slice(token.start, token.end) === `@${token.query}` ? token : null;
  const query = currentToken?.query;
  useEffect(() => {
    setSearch(null);
    setSelected(0);
    if (query === undefined) return undefined;
    const timer = setTimeout(() => setSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  const { data, loading, error } = useQuery(SEARCH_MENTION_USERS, {
    variables: { query: search ?? '' }, skip: search === null || !currentToken, fetchPolicy: 'network-only',
  });
  const users = currentToken && search === query ? data?.searchMentionUsers || [] : [];
  const open = Boolean(currentToken);
  const updateToken = event => {
    if (!dismissed.current) setToken(activeMention(event.target.value, event.target.selectionStart ?? event.target.value.length));
  };
  const choose = user => {
    const element = field();
    if (!element || !currentToken) return;
    const suffix = value.slice(currentToken.end);
    const insertion = `@${user.username}${/^[\s.,!?;:)\]}]/.test(suffix) ? '' : ' '}`;
    const next = value.slice(0, currentToken.start) + insertion + suffix;
    const caret = currentToken.start + insertion.length;
    element.value = next;
    onChange({ target: element, currentTarget: element });
    dismissed.current = true;
    setToken(null);
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(caret, caret); });
  };

  return <div ref={root} className="mention-input">
    <Field {...props} value={value} disabled={disabled}
      aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-describedby={[props['aria-describedby'], `${listId}-hint`].filter(Boolean).join(' ')}
      aria-activedescendant={open && users[selected] ? `${listId}-${selected}` : undefined}
      onChange={event => { dismissed.current = false; onChange(event); updateToken(event); }}
      onSelect={event => { updateToken(event); onSelect?.(event); }}
      onBlur={event => { setToken(null); onBlur?.(event); }}
      onKeyDown={event => {
        if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissed.current = true; setToken(null); return; }
        if (open && !event.nativeEvent?.isComposing && users.length && !event.ctrlKey && !event.metaKey) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setSelected(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + users.length) % users.length); return;
          }
          if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); choose(users[selected] || users[0]); return; }
        }
        onKeyDown?.(event);
      }} />
    <small className="mention-hint" id={`${listId}-hint`}>Birini etiketlemek için @ yaz.</small>
    {open && <div className="mention-options" id={listId} role="listbox" aria-label="Etiketlenecek kullanıcı">
      <small>Herkese açık hesaplar ve takipçilerin</small>
      {users.map((user, index) => <button key={user.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={index === selected}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(user)}>
        {user.profilePicture && <img src={user.profilePicture} alt="" />}
        <span><strong>@{user.username}</strong><span>{user.fullName}</span></span>
      </button>)}
      {!users.length && <p role="status">{error ? 'Kullanıcılar yüklenemedi. Tekrar @ yazarak deneyin.' : loading || search !== query ? 'Kullanıcılar aranıyor…' : 'Etiketleyebileceğin bir kullanıcı bulunamadı.'}</p>}
    </div>}
  </div>;
});

export default MentionInput;
