import React, { useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { Button } from '../UI/Button';
import { REMOVE_FOLLOWER } from '../../graphql/followRequests';

export default function RemoveFollowerButton({ followerId, username, onUpdate, showToast }) {
  const [removeFollower] = useMutation(REMOVE_FOLLOWER);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  const remove = async event => {
    event.stopPropagation();
    if (busy.current) return;
    busy.current = true; setLoading(true);
    try {
      const { data } = await removeFollower({ variables: { followerId } });
      await onUpdate();
      showToast(data.removeFollower.message, 'success');
    } catch (error) { showToast(error.message || 'Takipçi çıkarılamadı.', 'error'); }
    finally { busy.current = false; setLoading(false); }
  };

  // Disabled buttons may still bubble clicks to a clickable row in some browsers.
  return <span className="remove-follower-action" onClick={event => event.stopPropagation()}>
    <Button className="remove-follower-button" size="small" variant="outline" isLoading={loading}
      onClick={remove} aria-label={`${username} takipçisini çıkar`}>Takipçiyi Çıkar</Button>
  </span>;
}
