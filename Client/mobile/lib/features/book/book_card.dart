import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/ui.dart';
import '../share/share_sheet.dart';

const _reasons = {
  'LIKED_GENRE': ('Beğendiğin türden', Color(0xFF7C3AED)),
  'SAVED_GENRE': ('Kaydettiğin türden', Color(0xFF0891B2)),
  'COMMENTED_GENRE': ('Yorum yaptığın türden', Color(0xFF059669)),
  'QUOTED_GENRE': ('Alıntı aldığın türden', Color(0xFFD97706)),
  'ONBOARDING_GENRE': ('Tercih ettiğin türden', Color(0xFF7C3AED)),
  'SOCIAL': ('Takip ettiğin biri beğendi', Color(0xFFDB2777)),
  'NEW': ('Yeni eklendi', Color(0xFF16A34A)),
  'POPULAR': ('Popüler', Color(0xFF6B7280)),
};

class ReasonBadge extends StatelessWidget {
  const ReasonBadge(this.reason, {super.key});
  final String reason;

  @override
  Widget build(BuildContext context) {
    final (text, color) = _reasons[reason] ?? _reasons['POPULAR']!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.19)),
      ),
      child: Text(
        text,
        style: sans(size: 11, weight: FontWeight.w500, color: color),
      ),
    );
  }
}

/// Campaign strip on cards: "Desteğe açık / Test kampanyası / raised /
/// target / Tamamlanma".
class BookFundingProgress extends StatelessWidget {
  const BookFundingProgress(this.funding, {super.key});
  final FundingSummary funding;

  @override
  Widget build(BuildContext context) {
    final percent = funding.progressPercent.clamp(0, 100).toDouble();
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: BetikColors.sepiaLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: BetikColors.borderMedium),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 2,
            alignment: WrapAlignment.spaceBetween,
            children: [
              Text(
                funding.goalReached ? 'Hedef tamamlandı' : (funding.isOpen ? 'Desteğe açık' : 'Kampanya kapalı'),
                style: sans(size: 12.5, weight: FontWeight.w700),
              ),
              if (funding.environment == 'SANDBOX') Text('Test kampanyası', style: sans(size: 11, color: BetikColors.rust)),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: percent / 100, minHeight: 6),
          ),
          const SizedBox(height: 6),
          Text(
            '${formatMoneyTl(funding.acceptedMinor)} / ${formatMoneyTl(funding.targetMinor)} hedef',
            style: sans(size: 12, color: BetikColors.graphite),
          ),
          Text('Tamamlanma: ${formatPercent(percent)}', style: sans(size: 11.5, color: BetikColors.ashGray)),
        ],
      ),
    );
  }
}

String truncateDescription(String description) {
  if (description.trim().isEmpty) return 'Henüz açıklama eklenmemiş.';
  return description.length > 120 ? '${description.substring(0, 120)}...' : description;
}

/// Book card (F-DISC-05, F-BOOK-02). All derived values are client rules:
/// page chip `{n}S.`, "Popüler" above 1000 views, description cut at 120
/// characters, reading time `ceil(pages / 3)` minutes.
class BookCard extends StatelessWidget {
  const BookCard(this.book, {super.key, this.reason});
  final Book book;
  final String? reason;

  @override
  Widget build(BuildContext context) {
    final chips = book.classification.summary;
    return PaperCard(
      padding: const EdgeInsets.all(12),
      onTap: () => context.push('/book/${book.id}'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: BetikColors.agedPaper,
                  border: Border.all(color: BetikColors.borderHeavy),
                ),
                child: BookCover(book.imageUrl, width: 92, radius: 2),
              ),
              // Like the website: no badge when the page count is unknown
              // (recommendations carry none).
              if (book.pageCount > 0)
                Positioned(
                  right: 0,
                  top: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: BetikColors.paperWhite,
                      border: Border.all(color: BetikColors.inkBlack),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text('${book.pageCount}S.', style: sans(size: 10.5, weight: FontWeight.w700)),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (reason != null) Padding(padding: const EdgeInsets.only(bottom: 6), child: ReasonBadge(reason!)),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (book.isPopular) const TagChip('Popüler', dark: true),
                    if (book.status == 'FUNDING') const TagChip('Basım bilgileri'),
                    if (book.status == 'PUBLISHED') const TagChip('Yayımlandı'),
                    for (final chip in chips.take(3)) TagChip(chip),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  trUpper(book.title),
                  style: serif(size: 15, weight: FontWeight.w700, letterSpacing: 0.6, height: 1.3),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                GestureDetector(
                  onTap: book.author == null || book.isPrinted ? null : () => context.push('/user/${book.author!.id}'),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: 'Yazar: ',
                          style: sans(size: 12.5, color: BetikColors.ashGray),
                        ),
                        TextSpan(
                          text: book.authorName,
                          style: sans(size: 12.5, weight: FontWeight.w600),
                        ),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  truncateDescription(book.description),
                  style: serif(size: 12.5, style: FontStyle.italic, color: BetikColors.graphite, height: 1.45),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                if (book.funding != null) ...[BookFundingProgress(book.funding!), const SizedBox(height: 8)],
                if (book.readingMinutes > 0) Text('~${book.readingMinutes} DK OKUMA', style: label(size: 10.5)),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    CountLabel(icon: Icons.visibility_outlined, value: book.views, noun: 'görüntülenme', size: 12),
                    const SizedBox(width: 12),
                    CountLabel(icon: Icons.chat_bubble_outline, value: book.commentCount, noun: 'yorum', size: 12),
                    const SizedBox(width: 12),
                    CountLabel(icon: Icons.favorite_border, value: book.likes, noun: 'beğeni', size: 12),
                    if (!book.isDraft)
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        iconSize: 18,
                        tooltip: 'Kitabı paylaş',
                        icon: const Icon(Icons.ios_share),
                        onPressed: () => showShareSheet(context, type: 'BOOK', id: book.id),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact cover tile used by profile carousels and the printed catalogue.
class BookTile extends StatelessWidget {
  const BookTile(this.book, {super.key, this.width = 120, this.badge});
  final Book book;
  final double width;
  final String? badge;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => context.push('/book/${book.id}'),
    child: SizedBox(
      width: width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              BookCover(book.imageUrl, width: width),
              if (badge != null) Positioned(left: 4, top: 4, child: TagChip(badge!, dark: true)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            book.title,
            style: serif(size: 13, weight: FontWeight.w700),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            book.authorName,
            style: sans(size: 11.5, color: BetikColors.ashGray),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    ),
  );
}
