import React from 'react';
import { Link } from 'react-router-dom';
import { profilePath } from '../../utils/publicPaths';
import './Mentions.css';

export default function MentionText({ children = '' }) {
  const text = String(children || '');
  const parts = [];
  let offset = 0;
  for (const match of text.matchAll(/(^|[^\p{L}\p{N}_@./-])@([\p{L}\p{N}_][\p{L}\p{N}_.-]*)/gu)) {
    const username = match[2].replace(/[.-]+$/, '');
    if (username.length > 50) continue;
    const start = match.index + match[1].length;
    parts.push(text.slice(offset, start));
    parts.push(<Link key={start} className="mention-link" to={profilePath({ username })}>@{username}</Link>);
    offset = start + username.length + 1;
  }
  parts.push(text.slice(offset));
  return <>{parts}</>;
}
