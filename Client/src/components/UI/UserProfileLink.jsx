import React from 'react';
import { Link } from 'react-router-dom';
import { profilePath } from '../../utils/publicPaths';
import './UserProfileLink.css';

export default function UserProfileLink({ user, children, className = '', onClick, ...props }) {
  const classes = `user-profile-link ${className}`.trim();
  if (!user?.publicPath && !user?.username && !user?.id) return <span className={classes} {...props}>{children}</span>;
  return <Link to={profilePath(user)} className={classes} {...props} onClick={event => { event.stopPropagation(); onClick?.(event); }}>{children}</Link>;
}
