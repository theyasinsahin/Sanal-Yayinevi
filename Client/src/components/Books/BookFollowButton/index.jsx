// src/components/Books/BookFollowButton/index.jsx
import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { NotificationsOutlined, Notifications } from '@mui/icons-material';
import { IS_FOLLOWING_BOOK } from '../../../graphql/queries/bookFollow';
import { TOGGLE_BOOK_FOLLOW } from '../../../graphql/mutations/bookFollow';
import { useAuth } from '../../../context/AuthContext';
import './BookFollowButton.css';

const BookFollowButton = ({ bookId }) => {
  const { user } = useAuth();

  const { data } = useQuery(IS_FOLLOWING_BOOK, {
    variables: { bookId },
    skip: !user || !bookId,
  });

  const isFollowingFromServer = data?.isFollowingBook || false;
  const [optimisticFollowing, setOptimisticFollowing] = useState(null);
  const isFollowing = optimisticFollowing !== null ? optimisticFollowing : isFollowingFromServer;

  const [toggleFollow, { loading }] = useMutation(TOGGLE_BOOK_FOLLOW);

  const handleToggle = async () => {
    if (!user || loading) return;
    setOptimisticFollowing(!isFollowing);
    try {
      await toggleFollow({ variables: { bookId } });
    } catch (err) {
      setOptimisticFollowing(isFollowing);
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <button
      className={`book-follow-btn ${isFollowing ? 'following' : ''}`}
      onClick={handleToggle}
      disabled={loading}
      title={isFollowing ? 'Takibi bırak' : 'Takip et — yeni bölümlerde bildirim al'}
    >
      {isFollowing 
        ? <Notifications fontSize="small" /> 
        : <NotificationsOutlined fontSize="small" />
      }
      <span>{isFollowing ? 'Takiptesin' : 'Takip Et'}</span>
    </button>
  );
};

export default BookFollowButton;