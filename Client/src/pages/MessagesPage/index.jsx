import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';

import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import ConversationList from '../../components/Messaging/ConversationList';
import ChatWindow from '../../components/Messaging/ChatWindow';

import { GET_OR_CREATE_CONVERSATION } from '../../graphql/queries/message';

import './MessagesPage.css';

const MessagesPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  // conversationId URL'de varsa chat view'a geç (mobil)
  useEffect(() => {
    if (conversationId) setMobileView('chat');
    else setMobileView('list');
  }, [conversationId]);

  const handleSelectConversation = (id) => {
    navigate(`/messages/${id}`);
  };

  const handleBack = () => {
    navigate('/messages');
  };

  return (
    <MainLayout>
      <div className="messages-page-wrapper">
        <Container maxWidth="6xl">
          <div className="messages-layout">

            {/* SOL — Konuşma listesi */}
            <aside className={`messages-sidebar${mobileView === 'chat' ? ' messages-sidebar--hidden' : ''}`}>
              <ConversationList
                activeConversationId={conversationId}
                onSelect={handleSelectConversation}
              />
            </aside>

            {/* SAĞ — Chat penceresi */}
            <main className={`messages-main${mobileView === 'list' && !conversationId ? ' messages-main--empty' : ''}`}>
              {conversationId ? (
                <ChatWindow
                  conversationId={conversationId}
                  onBack={handleBack}
                />
              ) : (
                <div className="messages-empty-state">
                  <div className="messages-empty-icon">💬</div>
                  <Typography variant="h5" weight="bold">
                    Mesajların
                  </Typography>
                  <Typography variant="body" color="muted">
                    Bir konuşma seç veya yeni bir tane başlat.
                  </Typography>
                </div>
              )}
            </main>

          </div>
        </Container>
      </div>
    </MainLayout>
  );
};

export default MessagesPage;