// src/hooks/useSessions.js
import { useQuery, useMutation, useSubscription, useLazyQuery } from '@apollo/client';
import {
  GET_SESSIONS,
  GET_SESSION,
  GET_SESSION_ENTRIES,
  CREATE_SESSION,
  ADD_SESSION_ENTRY,
  DELETE_SESSION_ENTRY,
  TOGGLE_SESSION_ENTRY_LIKE,
  CLOSE_SESSION,
  ON_NEW_SESSION_ENTRY,
} from '../graphql/queries/session';

const ENTRIES_PER_PAGE = 30;

// --- Oturum listesi ---
export const useGetSessions = (limit = 20) => {
  const { data, loading, error, fetchMore } = useQuery(GET_SESSIONS, {
    variables: { limit, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

  const loadMore = () => {
    const currentCount = data?.getSessions?.length ?? 0;
    fetchMore({
      variables: { limit, offset: currentCount },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.getSessions?.length) return prev;
        return {
          getSessions: [...prev.getSessions, ...fetchMoreResult.getSessions],
        };
      },
    });
  };

  return {
    sessions: data?.getSessions ?? [],
    loading,
    error,
    loadMore,
    hasMore: (data?.getSessions?.length ?? 0) % limit === 0 &&
             (data?.getSessions?.length ?? 0) > 0,
  };
};

// --- Tek oturum detayı ---
export const useGetSession = (sessionId) => {
  const { data, loading, error } = useQuery(GET_SESSION, {
    variables: { sessionId },
    skip: !sessionId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    session: data?.getSession ?? null,
    loading,
    error,
  };
};

// --- Oturum yazıları ---
export const useGetSessionEntries = (sessionId) => {
  const { data, loading, error, fetchMore } = useQuery(GET_SESSION_ENTRIES, {
    variables: { sessionId, limit: ENTRIES_PER_PAGE, offset: 0 },
    skip: !sessionId,
    fetchPolicy: 'cache-and-network',
  });

  const loadMore = () => {
    const currentCount = data?.getSessionEntries?.length ?? 0;
    fetchMore({
      variables: { sessionId, limit: ENTRIES_PER_PAGE, offset: currentCount },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.getSessionEntries?.length) return prev;
        return {
          getSessionEntries: [
            ...prev.getSessionEntries,
            ...fetchMoreResult.getSessionEntries,
          ],
        };
      },
    });
  };

  return {
    entries: data?.getSessionEntries ?? [],
    loading,
    error,
    loadMore,
    hasMore: (data?.getSessionEntries?.length ?? 0) % ENTRIES_PER_PAGE === 0 &&
             (data?.getSessionEntries?.length ?? 0) > 0,
  };
};

// --- Gerçek zamanlı yeni yazı dinleme ---
export const useNewSessionEntrySubscription = (sessionId) => {
  useSubscription(ON_NEW_SESSION_ENTRY, {
    variables: { sessionId },
    skip: !sessionId,
    onData: ({ client, data }) => {
      const newEntry = data?.data?.onNewSessionEntry;
      if (!newEntry) return;

      // Cache'e yeni yazıyı ekle
      client.cache.updateQuery(
        {
          query: GET_SESSION_ENTRIES,
          variables: { sessionId, limit: ENTRIES_PER_PAGE, offset: 0 },
        },
        (existing) => {
          if (!existing?.getSessionEntries) return existing;
          // Aynı yazı zaten varsa ekleme (mutation optimistic ile çakışmasın)
          const alreadyExists = existing.getSessionEntries.some(
            (e) => e.id === newEntry.id
          );
          if (alreadyExists) return existing;
          return {
            getSessionEntries: [...existing.getSessionEntries, newEntry],
          };
        }
      );

      // Oturum listesindeki participantCount'ı güncelle
      client.cache.updateQuery(
        { query: GET_SESSIONS, variables: { limit: 20, offset: 0 } },
        (existing) => {
          if (!existing?.getSessions) return existing;
          return {
            getSessions: existing.getSessions.map((s) =>
              s.id === sessionId
                ? { ...s, participantCount: s.participantCount }
                : s
            ),
          };
        }
      );
    },
  });
};

// --- Oturum oluşturma ---
export const useCreateSession = () => {
  const [createSessionMutation, { loading }] = useMutation(CREATE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS, variables: { limit: 20, offset: 0 } }],
    onError: (err) => console.error('Oturum oluşturulamadı:', err),
  });

  const createSession = async (input) => {
    const { data } = await createSessionMutation({ variables: { input } });
    return data?.createSession ?? null;
  };

  return { createSession, loading };
};

// --- Yazı gönderme ---
export const useAddSessionEntry = (sessionId) => {
  const [addEntryMutation, { loading }] = useMutation(ADD_SESSION_ENTRY, {
    refetchQueries: [
      { query: GET_SESSION, variables: { sessionId } }
    ],
    onError: (err) => console.error('Yazı gönderilemedi:', err),
  });

  const addEntry = async (content, accessCode = null) => {
    const variables = { sessionId, content };
    if (accessCode) variables.accessCode = accessCode;

    const { data } = await addEntryMutation({
      variables,
      // Optimistic UI — yazıyı anında göster
      optimisticResponse: {
        addSessionEntry: {
          __typename: 'SessionEntry',
          id: `temp-${Date.now()}`,
          sessionId,
          content,
          likedBy: [],
          likeCount: 0,
          createdAt: new Date().toISOString(),
          user: null,
        },
      },
      update: (cache, { data: mutationData }) => {
        const newEntry = mutationData?.addSessionEntry;
        if (!newEntry) return;

        cache.updateQuery(
          {
            query: GET_SESSION_ENTRIES,
            variables: { sessionId, limit: ENTRIES_PER_PAGE, offset: 0 },
          },
          (existing) => {
            if (!existing?.getSessionEntries) return existing;
            const alreadyExists = existing.getSessionEntries.some(
              (e) => e.id === newEntry.id
            );
            if (alreadyExists) return existing;
            return {
              getSessionEntries: [...existing.getSessionEntries, newEntry],
            };
          }
        );
      },
    });

    return data?.addSessionEntry ?? null;
  };

  return { addEntry, loading };
};

// --- Yazı silme ---
export const useDeleteSessionEntry = (sessionId) => {
  const [deleteEntryMutation, { loading }] = useMutation(DELETE_SESSION_ENTRY, {
    refetchQueries: [
      { query: GET_SESSION, variables: { sessionId } }, // ✅ ekle
    ],
    update: (cache, _, { variables }) => {
      cache.updateQuery(
        {
          query: GET_SESSION_ENTRIES,
          variables: { sessionId, limit: ENTRIES_PER_PAGE, offset: 0 },
        },
        (existing) => {
          if (!existing?.getSessionEntries) return existing;
          return {
            getSessionEntries: existing.getSessionEntries.filter(
              (e) => e.id !== variables.entryId
            ),
          };
        }
      );
    },
  });

  return {
    deleteEntry: (entryId) => deleteEntryMutation({ variables: { entryId } }),
    loading,
  };
};

// --- Beğeni ---
export const useToggleSessionEntryLike = () => {
  const [toggleLikeMutation, { loading }] = useMutation(TOGGLE_SESSION_ENTRY_LIKE);

  return {
    toggleLike: (entryId) => toggleLikeMutation({ variables: { entryId } }),
    loading,
  };
};

// --- Oturum kapatma ---
export const useCloseSession = () => {
  const [closeSessionMutation, { loading }] = useMutation(CLOSE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS, variables: { limit: 20, offset: 0 } }],
  });

  return {
    closeSession: (sessionId) => closeSessionMutation({ variables: { sessionId } }),
    loading,
  };
};