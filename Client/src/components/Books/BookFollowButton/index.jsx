// src/components/Books/BookFollowButton/index.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { NotificationsOutlined, Notifications } from '@mui/icons-material';
import { IS_FOLLOWING_BOOK } from '../../../graphql/queries/bookFollow';
import { TOGGLE_BOOK_FOLLOW } from '../../../graphql/mutations/bookFollow';
import { useAuth } from '../../../context/AuthContext';
import './BookFollowButton.css';
import { useRegistration, useRestoredRegistration } from '../../../hooks/useRegistration';

const BookFollowButton = ({ bookId }) => {
  const { user } = useAuth();
  const requestRegistration = useRegistration();
  const restored = useRestoredRegistration('follow', { bookId });
  const buttonRef = useRef(null);
  useEffect(() => { if (restored) buttonRef.current?.focus(); }, [restored]);

  const { data } = useQuery(IS_FOLLOWING_BOOK, {
    variables: { bookId },
    skip: !user || !bookId,
  });

  const isFollowingFromServer = data?.isFollowingBook || false;
  const [optimisticFollowing, setOptimisticFollowing] = useState(null);
  const isFollowing = optimisticFollowing !== null ? optimisticFollowing : isFollowingFromServer;

  const [toggleFollow, { loading }] = useMutation(TOGGLE_BOOK_FOLLOW);

  const handleToggle = async () => {
    if (!user) return requestRegistration({ action: 'follow', bookId });
    if (loading) return;
    setOptimisticFollowing(!isFollowing);
    try {
      await toggleFollow({ variables: { bookId } });
    } catch (err) {
      setOptimisticFollowing(isFollowing);
      console.error(err);
    }
  };


  return (
    <button
      ref={buttonRef}
      className={`book-follow-btn ${isFollowing ? 'following' : ''}`}
      onClick={handleToggle}
      disabled={loading}
      title={isFollowing ? 'Kitabı takip etmeyi bırak' : 'Kitabı takip et — yeni bölümlerde bildirim al'}
    >
      {isFollowing 
        ? <Notifications fontSize="small" /> 
        : <NotificationsOutlined fontSize="small" />
      }
      <span>{isFollowing ? 'Kitabı Takip Ediyorsun' : 'Kitabı Takip Et'}</span>
    </button>
  );
};

export default BookFollowButton;
