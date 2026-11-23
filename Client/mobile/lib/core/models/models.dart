import '../network/graphql_client.dart';
import '../utils/format.dart';

// Typed views over the GraphQL contract (Server/src/graphql/typedefs).
// Parsing is tolerant: the schema has no versioning (Stage 1 K-11), so a
// missing or null field never throws.

String _s(Object? v, [String fallback = '']) => v is String ? v : (v == null ? fallback : '$v');
int _i(Object? v, [int fallback = 0]) => v is num ? v.toInt() : (v is String ? int.tryParse(v) ?? fallback : fallback);
double _d(Object? v, [double fallback = 0]) => v is num ? v.toDouble() : fallback;
bool _b(Object? v, [bool fallback = false]) => v is bool ? v : fallback;
Json? _m(Object? v) => v is Map ? Map<String, dynamic>.from(v) : null;
List<T> _list<T>(Object? v, T Function(Json json) parse) => v is List
    ? [
        for (final item in v)
          if (item is Map) parse(Map<String, dynamic>.from(item)),
      ]
    : <T>[];
List<String> _ids(Object? v) => v is List
    ? [
        for (final item in v)
          if (item != null) '$item',
      ]
    : <String>[];

class UserSummary {
  const UserSummary({required this.id, required this.username, this.fullName = '', this.profilePicture = '', this.publicPath});
  final String id;
  final String username;
  final String fullName;
  final String profilePicture;
  final String? publicPath;

  String get displayName => fullName.isNotEmpty ? fullName : username;

  factory UserSummary.fromJson(Json json) => UserSummary(
    id: _s(json['id']),
    username: _s(json['username']),
    fullName: _s(json['fullName']),
    profilePicture: _s(json['profilePicture']),
    publicPath: json['publicPath'] as String?,
  );

  static UserSummary? maybe(Object? json) => json is Map ? UserSummary.fromJson(Map<String, dynamic>.from(json)) : null;
}

class Term {
  const Term({required this.id, required this.slug, required this.name, this.isActive = true, this.group, this.hexColor});
  final String id;
  final String slug;
  final String name;
  final bool isActive;

  /// Genres only: `FICTION` or `KNOWLEDGE`.
  final String? group;
  final String? hexColor;

  factory Term.fromJson(Json json) => Term(
    id: _s(json['id']),
    slug: _s(json['slug']),
    name: genreName(_s(json['name'])),
    isActive: json['isActive'] != false,
    group: json['group'] as String?,
    hexColor: json['hexColor'] as String?,
  );
}

class Classification {
  const Classification({
    this.format,
    this.genres = const [],
    this.tags = const [],
    this.features = const [],
    this.audience,
    this.warnings = const [],
    this.status = '',
  });
  final Term? format;
  final List<Term> genres;
  final List<Term> tags;
  final List<Term> features;
  final Term? audience;
  final List<Term> warnings;
  final String status;

  factory Classification.fromBook(Json json) => Classification(
    format: _m(json['format']) == null ? null : Term.fromJson(_m(json['format'])!),
    genres: _list(json['genres'], Term.fromJson),
    tags: _list(json['classificationTags'], Term.fromJson),
    features: _list(json['narrativeFeatures'], Term.fromJson),
    audience: _m(json['targetAudience']) == null ? null : Term.fromJson(_m(json['targetAudience'])!),
    warnings: _list(json['contentWarnings'], Term.fromJson),
    status: _s(json['classificationStatus']),
  );

  /// Format first, then genres — the chips on cards and the detail header.
  List<String> get summary => [if (format != null) format!.name, ...genres.map((g) => g.name)];
}

class ClassificationOptions {
  const ClassificationOptions({
    this.formats = const [],
    this.genres = const [],
    this.features = const [],
    this.audiences = const [],
    this.warnings = const [],
  });
  final List<Term> formats;
  final List<Term> genres;
  final List<Term> features;
  final List<Term> audiences;
  final List<Term> warnings;

  factory ClassificationOptions.fromJson(Json json) => ClassificationOptions(
    formats: _list(json['formats'], Term.fromJson),
    genres: _list(json['genres'], Term.fromJson),
    features: _list(json['narrativeFeatures'], Term.fromJson),
    audiences: _list(json['targetAudiences'], Term.fromJson),
    warnings: _list(json['contentWarnings'], Term.fromJson),
  );
}

class FundingSummary {
  const FundingSummary({
    required this.id,
    required this.state,
    required this.environment,
    required this.targetMinor,
    required this.acceptedMinor,
    required this.remainingMinor,
    required this.progressPercent,
    required this.isOpen,
    required this.goalReached,
    this.endsAt,
  });
  final String id;
  final String state;
  final String environment;
  final int targetMinor;
  final int acceptedMinor;
  final int remainingMinor;
  final double progressPercent;
  final bool isOpen;
  final bool goalReached;
  final DateTime? endsAt;

  factory FundingSummary.fromJson(Json json) => FundingSummary(
    id: _s(json['id']),
    state: _s(json['state']),
    environment: _s(json['environment']),
    targetMinor: _i(json['targetMinor']),
    acceptedMinor: _i(json['acceptedMinor']),
    remainingMinor: _i(json['remainingMinor']),
    progressPercent: _d(json['progressPercent']),
    isOpen: _b(json['isOpen']),
    goalReached: _b(json['goalReached']),
    endsAt: parseApiDate(json['endsAt']),
  );
}

class Chapter {
  const Chapter({
    required this.id,
    required this.title,
    this.content = '',
    this.pageCount = 0,
    this.wordCount,
    this.isHidden = false,
    this.canReadContent = true,
    this.accessStatus = 'READABLE',
    this.publicPath,
    this.createdAt,
  });
  final String id;
  final String title;
  final String content;
  final int pageCount;
  final int? wordCount;
  final bool isHidden;
  final bool canReadContent;

  /// `READABLE`, `REGISTRATION_REQUIRED`, `HIDDEN` or `UNAVAILABLE`.
  final String accessStatus;
  final String? publicPath;
  final DateTime? createdAt;

  bool get registrationRequired => accessStatus == 'REGISTRATION_REQUIRED';

  Chapter copyWith({String? content, bool? isHidden, int? pageCount, int? wordCount, String? title}) => Chapter(
    id: id,
    title: title ?? this.title,
    content: content ?? this.content,
    pageCount: pageCount ?? this.pageCount,
    wordCount: wordCount ?? this.wordCount,
    isHidden: isHidden ?? this.isHidden,
    canReadContent: canReadContent,
    accessStatus: accessStatus,
    publicPath: publicPath,
    createdAt: createdAt,
  );

  factory Chapter.fromJson(Json json) => Chapter(
    id: _s(json['id']),
    title: _s(json['title']),
    content: _s(json['content']),
    pageCount: _i(json['pageCount']),
    wordCount: json['wordCount'] is num ? _i(json['wordCount']) : null,
    isHidden: _b(json['isHidden']),
    canReadContent: json['canReadContent'] != false,
    accessStatus: _s(json['accessStatus'], 'READABLE'),
    publicPath: json['publicPath'] as String?,
    createdAt: parseApiDate(json['createdAt']),
  );
}

class Book {
  const Book({
    required this.id,
    required this.title,
    this.description = '',
    this.imageUrl = '',
    this.pageCount = 0,
    this.publishDate,
    this.status,
    this.digitalStatus,
    this.writingStatus,
    this.kind = 'DIGITAL',
    this.publicPath,
    this.authorId,
    this.author,
    this.classification = const Classification(),
    this.views = 0,
    this.likes = 0,
    this.commentCount = 0,
    this.likedBy = const [],
    this.funding,
    this.chapters = const [],
    this.printedAuthor,
    this.publisher,
    this.publicationYear,
    this.isbn,
    this.publicationStatus,
    this.purchaseUrl,
    this.publicationEvidenceUrl,
    this.reviewNote,
    this.submittedById,
    this.canEditContent = false,
    this.myClaim,
  });

  final String id;
  final String title;
  final String description;
  final String imageUrl;
  final int pageCount;
  final DateTime? publishDate;

  /// Legacy combined status: `DRAFT`, `WRITING`, `COMPLETED` (also `FUNDING`,
  /// `PUBLISHED` on old records).
  final String? status;
  final String? digitalStatus;
  final String? writingStatus;
  final String kind;
  final String? publicPath;
  final String? authorId;
  final UserSummary? author;
  final Classification classification;
  final int views;
  final int likes;
  final int commentCount;
  final List<String> likedBy;
  final FundingSummary? funding;
  final List<Chapter> chapters;

  // Printed-catalogue fields.
  final String? printedAuthor;
  final String? publisher;
  final int? publicationYear;
  final String? isbn;
  final String? publicationStatus;
  final String? purchaseUrl;
  final String? publicationEvidenceUrl;
  final String? reviewNote;
  final String? submittedById;
  final bool canEditContent;
  final Json? myClaim;

  bool get isPrinted => kind == 'PRINTED';

  /// Same derivation as the web detail page and the server's `digitalState`:
  /// the explicit field wins, the legacy `status` is the fallback.
  bool get isDraft => digitalStatus != null && digitalStatus!.isNotEmpty ? digitalStatus == 'DRAFT' : status == 'DRAFT';
  bool get isCompleted => writingStatus != null && writingStatus!.isNotEmpty ? writingStatus == 'COMPLETED' : status == 'COMPLETED';

  String get authorName => isPrinted && (printedAuthor ?? '').isNotEmpty ? printedAuthor! : (author?.displayName ?? '');

  /// Card rule: estimated reading time = ceil(pages / 3) minutes (R-BOOK-11).
  int get readingMinutes => (pageCount / 3).ceil();
  bool get isPopular => views > 1000;

  factory Book.fromJson(Json json) {
    final stats = _m(json['stats']);
    final author = _m(json['author']);
    return Book(
      id: _s(json['id']),
      title: _s(json['title']),
      description: _s(json['description']),
      imageUrl: _s(json['imageUrl']),
      pageCount: _i(json['pageCount']),
      publishDate: parseApiDate(json['publishDate']),
      status: json['status'] as String?,
      digitalStatus: json['digitalStatus'] as String?,
      writingStatus: json['writingStatus'] as String?,
      kind: _s(json['kind'], 'DIGITAL'),
      publicPath: json['publicPath'] as String?,
      authorId: json['authorId'] != null ? _s(json['authorId']) : (author == null ? null : _s(author['id'])),
      author: author == null ? null : UserSummary.fromJson(author),
      classification: Classification.fromBook(json),
      views: _i(stats?['views']),
      likes: _i(stats?['likes']),
      commentCount: _i(json['commentCount']),
      likedBy: _ids(json['likedBy']),
      funding: _m(json['fundingSummary']) == null ? null : FundingSummary.fromJson(_m(json['fundingSummary'])!),
      chapters: _list(json['chapters'], Chapter.fromJson),
      printedAuthor: json['printedAuthor'] as String?,
      publisher: json['publisher'] as String?,
      publicationYear: json['publicationYear'] is num ? _i(json['publicationYear']) : null,
      isbn: json['isbn'] as String?,
      publicationStatus: json['publicationStatus'] as String?,
      purchaseUrl: json['purchaseUrl'] as String?,
      publicationEvidenceUrl: json['publicationEvidenceUrl'] as String?,
      reviewNote: json['reviewNote'] as String?,
      submittedById: _m(json['submittedBy'])?['id'] as String?,
      canEditContent: _b(json['canEditContent']),
      myClaim: _m(json['myClaim']),
    );
  }
}

class BookComment {
  const BookComment({required this.id, required this.content, required this.user, this.date, this.likedBy = const [], this.parentId});
  final String id;
  final String content;

  /// The schema names this field `userId` but it is a `User` object.
  final UserSummary? user;
  final DateTime? date;
  final List<String> likedBy;
  final String? parentId;

  factory BookComment.fromJson(Json json) => BookComment(
    id: _s(json['id']),
    content: _s(json['content']),
    user: UserSummary.maybe(json['userId']),
    date: parseApiDate(json['date']),
    likedBy: _ids(json['likedBy']),
    parentId: json['parentId'] == null ? null : _s(json['parentId']),
  );
}

class SimpleComment {
  const SimpleComment({required this.id, required this.content, this.user, this.createdAt, this.likedBy = const []});
  final String id;
  final String content;
  final UserSummary? user;
  final DateTime? createdAt;
  final List<String> likedBy;

  factory SimpleComment.fromJson(Json json) => SimpleComment(
    id: _s(json['id']),
    content: _s(json['content']),
    user: UserSummary.maybe(json['user']),
    createdAt: parseApiDate(json['createdAt']),
    likedBy: _ids(json['likedBy']),
  );
}

class QuoteBook {
  const QuoteBook({required this.id, required this.title, this.imageUrl = '', this.publicPath});
  final String id;
  final String title;
  final String imageUrl;
  final String? publicPath;

  static QuoteBook? maybe(Object? json) => json is Map
      ? QuoteBook(id: _s(json['id']), title: _s(json['title']), imageUrl: _s(json['imageUrl']), publicPath: json['publicPath'] as String?)
      : null;
}

class Quote {
  const Quote({
    required this.id,
    required this.text,
    this.note,
    this.visibility = 'PUBLIC',
    this.user,
    this.book,
    this.chapterTitle,
    this.chapterIndex,
    this.pageNumber,
    this.likedBy = const [],
    this.repostedBy = const [],
    this.isRepost = false,
    this.originalQuote,
    this.repostComment,
    this.isSpoiler = false,
    this.commentCount = 0,
    this.createdAt,
  });
  final String id;
  final String text;
  final String? note;
  final String visibility;
  final UserSummary? user;
  final QuoteBook? book;
  final String? chapterTitle;
  final int? chapterIndex;
  final int? pageNumber;
  final List<String> likedBy;
  final List<String> repostedBy;
  final bool isRepost;
  final Quote? originalQuote;
  final String? repostComment;
  final bool isSpoiler;
  final int commentCount;
  final DateTime? createdAt;

  bool get isPrivate => visibility == 'PRIVATE';

  /// A repost shows the original's text, book and author.
  Quote get source => isRepost && originalQuote != null ? originalQuote! : this;

  Quote copyWith({List<String>? likedBy, List<String>? repostedBy, int? commentCount}) => Quote(
    id: id,
    text: text,
    note: note,
    visibility: visibility,
    user: user,
    book: book,
    chapterTitle: chapterTitle,
    chapterIndex: chapterIndex,
    pageNumber: pageNumber,
    likedBy: likedBy ?? this.likedBy,
    repostedBy: repostedBy ?? this.repostedBy,
    isRepost: isRepost,
    originalQuote: originalQuote,
    repostComment: repostComment,
    isSpoiler: isSpoiler,
    commentCount: commentCount ?? this.commentCount,
    createdAt: createdAt,
  );

  factory Quote.fromJson(Json json) => Quote(
    id: _s(json['id']),
    text: _s(json['text']),
    note: json['note'] as String?,
    visibility: _s(json['visibility'], 'PUBLIC'),
    user: UserSummary.maybe(json['user']),
    book: QuoteBook.maybe(json['book']),
    chapterTitle: json['chapterTitle'] as String?,
    chapterIndex: json['chapterIndex'] is num ? _i(json['chapterIndex']) : null,
    pageNumber: json['pageNumber'] is num ? _i(json['pageNumber']) : null,
    likedBy: _ids(json['likedBy']),
    repostedBy: _ids(json['repostedBy']),
    isRepost: _b(json['isRepost']),
    originalQuote: _m(json['originalQuote']) == null ? null : Quote.fromJson(_m(json['originalQuote'])!),
    repostComment: json['repostComment'] as String?,
    isSpoiler: _b(json['isSpoiler']),
    commentCount: _i(json['commentCount']),
    createdAt: parseApiDate(json['createdAt']),
  );
}

class WritingSession {
  const WritingSession({
    required this.id,
    required this.title,
    this.description = '',
    this.coverImageUrl = '',
    this.type = 'OPEN',
    this.isActive = true,
    this.tags = const [],
    this.participantCount = 0,
    this.createdAt,
    this.createdBy,
    this.publicPath,
  });
  final String id;
  final String title;
  final String description;
  final String coverImageUrl;

  /// `OPEN`, `FOLLOWERS_ONLY` or `PRIVATE`.
  final String type;
  final bool isActive;
  final List<String> tags;
  final int participantCount;
  final DateTime? createdAt;
  final UserSummary? createdBy;
  final String? publicPath;

  bool get isPrivate => type == 'PRIVATE';
  bool get isShareable => type == 'OPEN' && isActive;

  String get typeLabel => switch (type) {
    'FOLLOWERS_ONLY' => 'Takipçilere Özel',
    'PRIVATE' => 'Özel',
    _ => 'Herkese Açık',
  };

  factory WritingSession.fromJson(Json json) => WritingSession(
    id: _s(json['id']),
    title: _s(json['title']),
    description: _s(json['description']),
    coverImageUrl: _s(json['coverImageUrl']),
    type: _s(json['type'], 'OPEN'),
    isActive: json['isActive'] != false,
    tags: _ids(json['tags']),
    participantCount: _i(json['participantCount']),
    createdAt: parseApiDate(json['createdAt']),
    createdBy: UserSummary.maybe(json['createdBy']),
    publicPath: json['publicPath'] as String?,
  );
}

class SessionEntry {
  const SessionEntry({
    required this.id,
    required this.sessionId,
    required this.content,
    this.user,
    this.likedBy = const [],
    this.likeCount = 0,
    this.createdAt,
  });
  final String id;
  final String sessionId;
  final String content;
  final UserSummary? user;
  final List<String> likedBy;
  final int likeCount;
  final DateTime? createdAt;

  factory SessionEntry.fromJson(Json json) => SessionEntry(
    id: _s(json['id']),
    sessionId: _s(json['sessionId']),
    content: _s(json['content']),
    user: UserSummary.maybe(json['user']),
    likedBy: _ids(json['likedBy']),
    likeCount: _i(json['likeCount']),
    createdAt: parseApiDate(json['createdAt']),
  );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.content,
    this.type = 'TEXT',
    this.sender,
    this.createdAt,
    this.attachedQuote,
    this.attachedBook,
    this.pending = false,
  });
  final String id;
  final String conversationId;
  final String content;

  /// `TEXT`, `QUOTE` or `BOOK`.
  final String type;
  final UserSummary? sender;
  final DateTime? createdAt;
  final Json? attachedQuote;
  final Json? attachedBook;

  /// Optimistic bubble not yet confirmed by the server.
  final bool pending;

  factory ChatMessage.fromJson(Json json) => ChatMessage(
    id: _s(json['id']),
    conversationId: _s(json['conversationId']),
    content: _s(json['content']),
    type: _s(json['type'], 'TEXT'),
    sender: UserSummary.maybe(json['sender']),
    createdAt: parseApiDate(json['createdAt']),
    attachedQuote: _m(json['attachedQuote']),
    attachedBook: _m(json['attachedBook']),
  );
}

class Conversation {
  const Conversation({required this.id, this.participants = const [], this.lastMessage, this.unreadCount = 0, this.updatedAt});
  final String id;
  final List<UserSummary> participants;
  final ChatMessage? lastMessage;
  final int unreadCount;
  final DateTime? updatedAt;

  UserSummary? other(String? myId) {
    for (final participant in participants) {
      if (participant.id != myId) return participant;
    }
    return participants.isEmpty ? null : participants.first;
  }

  factory Conversation.fromJson(Json json) => Conversation(
    id: _s(json['id']),
    participants: _list(json['participants'], UserSummary.fromJson),
    lastMessage: _m(json['lastMessage']) == null ? null : ChatMessage.fromJson(_m(json['lastMessage'])!),
    unreadCount: _i(json['unreadCount']),
    updatedAt: parseApiDate(json['updatedAt']),
  );
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    this.icon,
    this.isRead = false,
    this.meta = const {},
    this.createdAt,
  });
  final String id;
  final String type;
  final String title;
  final String message;
  final String? icon;
  final bool isRead;
  final Json meta;
  final DateTime? createdAt;

  factory AppNotification.fromJson(Json json) => AppNotification(
    id: _s(json['id']),
    type: _s(json['type']),
    title: _s(json['title']),
    message: _s(json['message']),
    icon: json['icon'] as String?,
    isRead: _b(json['isRead']),
    meta: _m(json['meta']) ?? const {},
    createdAt: parseApiDate(json['createdAt']),
  );
}

class Bookmark {
  const Bookmark({required this.chapterId, required this.chapterIndex, required this.paragraphIndex, this.chapterTitle});
  final String chapterId;
  final int chapterIndex;
  final int paragraphIndex;
  final String? chapterTitle;

  static Bookmark? maybe(Object? json) => json is Map
      ? Bookmark(
          chapterId: _s(json['chapterId']),
          chapterIndex: _i(json['chapterIndex']),
          paragraphIndex: _i(json['paragraphIndex']),
          chapterTitle: json['chapterTitle'] as String?,
        )
      : null;
}

/// A page of results for the three pagination styles the API uses.
class Paged<T> {
  const Paged({required this.items, this.total = 0, this.page = 1, this.totalPages = 1});
  final List<T> items;
  final int total;
  final int page;
  final int totalPages;
}

// Helpers re-exported for feature code that reads loosely typed JSON
// (print funding, admin records).
String jsonString(Object? v, [String fallback = '']) => _s(v, fallback);
int jsonInt(Object? v, [int fallback = 0]) => _i(v, fallback);
double jsonDouble(Object? v, [double fallback = 0]) => _d(v, fallback);
bool jsonBool(Object? v, [bool fallback = false]) => _b(v, fallback);
Json? jsonMap(Object? v) => _m(v);
List<Json> jsonList(Object? v) => _list(v, (json) => json);
List<String> jsonIds(Object? v) => _ids(v);
