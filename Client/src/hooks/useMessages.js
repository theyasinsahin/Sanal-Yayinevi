import { useQuery, useMutation, useSubscription, useLazyQuery } from '@apollo/client';
import {
  GET_CONVERSATIONS,
  GET_MESSAGES,
  GET_OR_CREATE_CONVERSATION,
  GET_UNREAD_MESSAGE_COUNT,
  SEND_MESSAGE,
  MARK_MESSAGES_AS_READ,
  DELETE_MESSAGE,
  EDIT_MESSAGE,
  ON_NEW_MESSAGE,
} from '../graphql/queries/message';

const MESSAGES_PER_PAGE = 20;

// --- Konuşma listesi ---
export const useGetConversations = () => {
  const { data, loading, error } = useQuery(GET_CONVERSATIONS, {
    fetchPolicy: 'cache-and-network',
  });

  return {
    conversations: data?.getConversations ?? [],
    loading,
    error,
  };
};

// --- Mesaj listesi + sayfalama ---
export const useGetMessages = (conversationId) => {
  const { data, loading, error, fetchMore } = useQuery(GET_MESSAGES, {
    variables: { conversationId, limit: MESSAGES_PER_PAGE, offset: 0 },
    skip: !conversationId,
    fetchPolicy: 'cache-and-network',
  });

  const loadOlderMessages = () => {
    const currentCount = data?.getMessages?.length ?? 0;
    fetchMore({
      variables: {
        conversationId,
        limit: MESSAGES_PER_PAGE,
        offset: currentCount,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.getMessages?.length) return prev;
        return {
          getMessages: [
            ...prev.getMessages,
            ...fetchMoreResult.getMessages,
          ],
        };
      },
    });
  };

  // Backend'den yeniden eskiye sıralı geliyor, frontend'de ters çeviriyoruz
  const messages = [...(data?.getMessages ?? [])].reverse();

  return {
    messages,
    loading,
    error,
    loadOlderMessages,
    hasMore: (data?.getMessages?.length ?? 0) % MESSAGES_PER_PAGE === 0
      && (data?.getMessages?.length ?? 0) > 0,  };
};

// --- Gerçek zamanlı mesaj dinleme ---
export const useNewMessageSubscription = (conversationId) => {
  useSubscription(ON_NEW_MESSAGE, {
    variables: { conversationId },
    skip: !conversationId,
    onData: ({ client, data }) => {
      const newMessage = data?.data?.onNewMessage;
      if (!newMessage) return;

      // Apollo cache'e yeni mesajı ekle
      client.cache.updateQuery(
        {
          query: GET_MESSAGES,
          variables: {
            conversationId,
            limit: MESSAGES_PER_PAGE,
            offset: 0,
          },
        },
        (existing) => {
          if (!existing?.getMessages) return existing;
          // Aynı mesaj zaten cache'de varsa ekleme (mutation zaten ekliyor olabilir)
          const alreadyExists = existing.getMessages.some(
            (m) => m.id === newMessage.id
          );
          if (alreadyExists) return existing;
          return {
            getMessages: [newMessage, ...existing.getMessages],
          };
        }
      );

      // Konuşma listesindeki lastMessage'ı güncelle
      client.cache.updateQuery(
        { query: GET_CONVERSATIONS },
        (existing) => {
          if (!existing?.getConversations) return existing;
          return {
            getConversations: existing.getConversations.map((conv) => {
              if (conv.id !== conversationId) return conv;
              return { ...conv, lastMessage: newMessage };
            }),
          };
        }
      );
    },
  });
};

// --- Mesaj gönderme ---
export const useSendMessage = () => {
  const [sendMessageMutation, { loading }] = useMutation(SEND_MESSAGE, {
    onError: (err) => console.error('Mesaj gönderilemedi:', err),
  });

  const sendMessage = async ({ conversationId, content, type = 'TEXT', attachedQuoteId, attachedBookId }) => {
    const { data } = await sendMessageMutation({
      variables: {
        input: { conversationId, content, type, attachedQuoteId, attachedBookId },
      },
      // Optimistic UI — mesajı anında göster, server'dan doğrulama bekle
      optimisticResponse: {
        sendMessage: {
          __typename: 'Message',
          id: `temp-${Date.now()}`,
          conversationId,
          content: content ?? '',
          type,
          createdAt: new Date().toISOString(),
          sender: null, // optimistic'te sender bilgisi yokken null bırak
          attachedQuote: null,
          attachedBook: null,
        },
      },
      update: (cache, { data: mutationData }) => {
        const newMessage = mutationData?.sendMessage;
        if (!newMessage) return;

        cache.updateQuery(
          {
            query: GET_MESSAGES,
            variables: { conversationId, limit: MESSAGES_PER_PAGE, offset: 0 },
          },
          (existing) => {
            if (!existing?.getMessages) return existing;
            const alreadyExists = existing.getMessages.some(
              (m) => m.id === newMessage.id
            );
            if (alreadyExists) return existing;
            return { getMessages: [newMessage, ...existing.getMessages] };
          }
        );
      },
    });

    return data?.sendMessage;
  };

  return { sendMessage, sending: loading };
};

// --- Okundu işaretleme ---
export const useMarkAsRead = () => {
  const [markAsReadMutation] = useMutation(MARK_MESSAGES_AS_READ, {
    refetchQueries: [
      { query: GET_UNREAD_MESSAGE_COUNT },
      { query: GET_CONVERSATIONS },
    ],
  });

  return (conversationId) =>
    markAsReadMutation({ variables: { conversationId } });
};

// --- Mesaj silme ---
export const useDeleteMessage = (conversationId) => {
  const [deleteMessageMutation, { loading }] = useMutation(DELETE_MESSAGE, {
    update: (cache, _, { variables }) => {
      cache.updateQuery(
        {
          query: GET_MESSAGES,
          variables: { conversationId, limit: MESSAGES_PER_PAGE, offset: 0 },
        },
        (existing) => {
          if (!existing?.getMessages) return existing;
          return {
            getMessages: existing.getMessages.filter(
              (m) => m.id !== variables.messageId
            ),
          };
        }
      );
    },
  });

  return {
    deleteMessage: (messageId) =>
      deleteMessageMutation({ variables: { messageId } }),
    deleting: loading,
  };
};

// --- Okunmamış mesaj sayısı (navbar badge için) ---
export const useUnreadMessageCount = () => {
  const { data } = useQuery(GET_UNREAD_MESSAGE_COUNT, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 30000, // subscription dışında da 30sn'de bir yenile
  });

  return data?.getUnreadMessageCount ?? 0;
};

// --- Konuşma bul veya oluştur (profil sayfası / share modal için) ---
export const useGetOrCreateConversation = () => {
  const [getOrCreate, { loading }] = useLazyQuery(GET_OR_CREATE_CONVERSATION, {
    fetchPolicy: 'network-only',
  });

  const getOrCreateConversation = async (recipientId) => {
    const { data } = await getOrCreate({ variables: { recipientId } });
    return data?.getOrCreateConversation ?? null;
  };

  return { getOrCreateConversation, loading };
};