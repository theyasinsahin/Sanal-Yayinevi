import React, { useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { Button } from '../UI/Button';
import { REQUEST_FOLLOW, CANCEL_FOLLOW_REQUEST, UNFOLLOW_USER } from '../../graphql/followRequests';

export default function UserFollowButton({ targetId, status = 'NOT_FOLLOWING', onUpdate, showToast }) {
  const [request] = useMutation(REQUEST_FOLLOW);
  const [cancel] = useMutation(CANCEL_FOLLOW_REQUEST);
  const [unfollow] = useMutation(UNFOLLOW_USER);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const following = status === 'FOLLOWING';
  const pending = status === 'PENDING';

  const handleClick = async () => {
    if (busy.current) return;
    busy.current = true; setLoading(true);
    try {
      const action = following ? unfollow : pending ? cancel : request;
      const { data } = await action({ variables: { targetId } });
      const result = data.requestFollowUser || data.cancelFollowRequest || data.unfollowUser;
      showToast(result.message, 'success');
      await onUpdate();
    } catch (error) { showToast(error.message || 'Takip işlemi tamamlanamadı.', 'error'); }
    finally { busy.current = false; setLoading(false); }
  };

  return <Button variant={following || pending ? 'outline' : 'primary'} onClick={handleClick} isLoading={loading}
    title={pending ? 'Onay bekleyen takip isteğini geri çek' : undefined}>
    {following ? 'Takibi Bırak' : pending ? 'İsteği Geri Çek' : 'Takip İsteği Gönder'}
  </Button>;
}
