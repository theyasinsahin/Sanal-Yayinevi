// src/hooks/useRecommendations.js
import { useQuery, useMutation, gql } from '@apollo/client';
import { useAuth } from '../context/AuthContext';

const RECOMMENDATION_FIELDS = gql`
  fragment RecommendationFields on RecommendationResult {
    score
    reason
    book {
      id
      title
      description
      imageUrl
      status
      publishDate
      stats { likes views }
      genre { id name hexColor }
      author { id username fullName profilePicture }
    }
  }
`;

export const GET_RECOMMENDATIONS = gql`
  ${RECOMMENDATION_FIELDS}
  query GetRecommendations($limit: Int, $offset: Int) {
    getRecommendations(limit: $limit, offset: $offset) {
      ...RecommendationFields
    }
  }
`;

export const GET_USER_PREFERENCE = gql`
  query GetUserPreference {
    getUserPreference {
      id
      onboardingCompleted
      preferredGenres { id name hexColor }
    }
  }
`;

export const SAVE_USER_PREFERENCE = gql`
  mutation SaveUserPreference($genreIds: [ID!]!) {
    saveUserPreference(genreIds: $genreIds) {
      id
      onboardingCompleted
      preferredGenres { id name }
    }
  }
`;

export const MARK_CHAPTER_AS_READ = gql`
  mutation MarkChapterAsRead($bookId: ID!, $chapterId: ID!) {
    markChapterAsRead(bookId: $bookId, chapterId: $chapterId) {
      id
      completedChapters
      isCompleted
      lastReadAt
    }
  }
`;

// --- HOOKS ---

// NOT: getRecommendations backend'de giriş zorunlu bir sorgu olduğu için
// kullanıcı giriş yapmamışsa bu sorguyu hiç göndermiyoruz (skip: !user).
// Aksi halde "Giriş yapmalısınız." hatası dönüyor ve bu hata formatError.js
// üzerinden UNAUTHENTICATED koduna çevrilip App.js'teki errorLink'i
// tetikleyerek "Oturum süresi doldu" davranışını yanlışlıkla başlatıyordu.
export const useRecommendations = (limit = 10, offset = 0) => {
  const { user } = useAuth();

  const { data, loading, error, fetchMore } = useQuery(GET_RECOMMENDATIONS, {
    variables: { limit, offset },
    fetchPolicy: 'cache-and-network',
    skip: !user,
  });

  const loadMore = () => {
    if (!user) return;
    fetchMore({
      variables: { offset: data?.getRecommendations?.length ?? 0 },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          getRecommendations: [
            ...prev.getRecommendations,
            ...fetchMoreResult.getRecommendations,
          ],
        };
      },
    });
  };

  return {
    recommendations: data?.getRecommendations ?? [],
    loading,
    error,
    loadMore,
  };
};

// NOT: getUserPreference ve saveUserPreference da backend'de giriş zorunlu.
// Giriş yapmamış kullanıcı için sorguyu skip ediyoruz; savePreference'ı da
// zaten sadece giriş yapmış kullanıcı senaryosunda çağıracağız (bkz. FeedPage).
export const useUserPreference = () => {
  const { user } = useAuth();

  const { data, loading } = useQuery(GET_USER_PREFERENCE, { skip: !user });

  const [savePreference, { loading: saving }] = useMutation(SAVE_USER_PREFERENCE, {
    refetchQueries: [
        { query: GET_RECOMMENDATIONS, variables: { limit: 10, offset: 0 } },
        { query: GET_USER_PREFERENCE },
    ],
    awaitRefetchQueries: true,
  });

  return {
    preference:           data?.getUserPreference ?? null,
    onboardingCompleted:  data?.getUserPreference?.onboardingCompleted ?? false,
    preferenceLoading:    loading,
    saving,
    savePreference: (genreIds) => {
      if (!user) {
        return Promise.reject(new Error('Giriş yapmadan tercih kaydedilemez.'));
      }
      return savePreference({ variables: { genreIds } });
    },
  };
};

export const useMarkChapterAsRead = () => {
  const [markAsRead, { loading }] = useMutation(MARK_CHAPTER_AS_READ);
  return {
    markAsRead: (bookId, chapterId) =>
      markAsRead({ variables: { bookId, chapterId } }),
    loading,
  };
};