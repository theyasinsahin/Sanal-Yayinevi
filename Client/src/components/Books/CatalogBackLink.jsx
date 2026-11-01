import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function CatalogBackLink({ to, children, ...props }) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const origin = state?.catalogReturn;
  const canReturn = typeof origin === 'string' && ['/feed', '/printed-books'].includes(origin.split('?')[0]);
  return <Link {...props} to={canReturn ? origin : to} onClick={event => {
    if (canReturn && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      navigate(-1);
    }
  }}>{children}</Link>;
}
