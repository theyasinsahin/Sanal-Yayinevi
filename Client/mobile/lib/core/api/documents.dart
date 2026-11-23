/// Shared GraphQL fragments, mirroring the selections of the web client
/// (`Client/src/graphql`). Feature files append their own operations.
library;

const userFields = 'id username fullName profilePicture';

const classificationFields = '''
format { id slug name isActive }
genres { id slug name group hexColor isActive }
classificationTags { id slug name isActive }
narrativeFeatures { id slug name isActive }
targetAudience { id slug name isActive }
contentWarnings { id slug name isActive }
classificationStatus''';

const fundingSummaryFields =
    'fundingSummary { id state environment targetMinor acceptedMinor remainingMinor progressPercent isOpen goalReached endsAt }';

const bookCardFields =
    '''
id publicPath title description imageUrl pageCount publishDate status digitalStatus writingStatus
kind printedAuthor publisher publicationYear isbn
author { $userFields }
$classificationFields
stats { views likes }
commentCount
$fundingSummaryFields''';

/// Book fields of `getRecommendations`. The resolver loads a reduced
/// projection of the book (no `pageCount`), so asking for the non-null
/// `pageCount` fails the whole query; the website's
/// `RecommendationFields` fragment does not ask for it either.
const recommendationBookFields =
    '''
id publicPath title description imageUrl publishDate status
author { $userFields }
$classificationFields
stats { views likes }
$fundingSummaryFields''';

const printedBookFields = '''
publicationStatus purchaseUrl publicationEvidenceUrl reviewNote canEditContent
submittedBy { id }
myClaim { id status reviewNote }''';

const quoteFields =
    '''
id text note visibility chapterTitle chapterIndex pageNumber likedBy isRepost repostComment repostedBy createdAt isSpoiler
user { $userFields }
book { publicPath id title imageUrl }
originalQuote {
  id text note visibility chapterTitle pageNumber
  user { $userFields }
  book { publicPath id title imageUrl }
}
commentCount''';

const sessionFields = '''
publicPath id title description coverImageUrl type isActive tags participantCount createdAt updatedAt
createdBy { $userFields }''';

const entryFields = 'id sessionId content likedBy likeCount createdAt user { $userFields }';

const messageFields =
    '''
id conversationId content type createdAt
sender { $userFields }
attachedQuote { id text chapterTitle book { publicPath id title imageUrl } user { id username fullName } }
attachedBook { publicPath id title imageUrl author { id username fullName } }''';

const conversationFields =
    '''
id isGroup unreadCount updatedAt
participants { $userFields }
lastMessage { id content type createdAt sender { id username } }''';

const classificationOptionsQuery = '''
query GetClassificationOptions {
  getClassificationOptions {
    formats { id slug name isActive }
    genres { id slug name group hexColor isActive }
    narrativeFeatures { id slug name isActive }
    targetAudiences { id slug name isActive }
    contentWarnings { id slug name isActive }
  }
}''';
