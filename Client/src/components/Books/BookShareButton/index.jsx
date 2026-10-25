import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import SocialShareButton from '../../Sharing/SocialShareButton';
import ShareModal from '../../Messaging/ShareModal';

export default function BookShareButton({ book, variant = 'outline' }) {
  const { user } = useAuth();
  const [messageOpen, setMessageOpen] = useState(false);
  return <>
    <SocialShareButton type="BOOK" id={book.id} label="Kitabı paylaş" variant={variant} onSendInBetik={user ? () => setMessageOpen(true) : undefined} />
    {messageOpen && user && <ShareModal isOpen onClose={() => setMessageOpen(false)} type="BOOK" attachedBookId={book.id} attachedBook={book} currentUserId={user.id} />}
  </>;
}
