import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/glass_card.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../data/rating_summary.dart';
import '../../data/service_models.dart';
import '../service_format.dart';
import 'service_stars.dart';

/// "Avis" block of the detail (web `/services/[id]`): average and star
/// histogram, the viewer's own review form, then the written reviews with the
/// business' answer when there is one.
class ServiceReviewsSection extends StatelessWidget {
  const ServiceReviewsSection({
    super.key,
    required this.summary,
    required this.reviews,
    required this.viewerId,
    required this.canReview,
    required this.onSubmit,
    required this.onRetry,
  });

  final RatingSummary? summary;
  final AsyncValue<List<Review>> reviews;
  final String viewerId;

  /// False for the owner of the place.
  final bool canReview;

  /// Publishes (or replaces) the viewer's review.
  final Future<void> Function(int rating, String text) onSubmit;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colors = context.colors;
    final summary = this.summary;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Avis', style: textTheme.headlineSmall),
          if (summary != null) ...[
            const SizedBox(height: AppSpacing.lg),
            _Summary(summary: summary),
          ],
          if (canReview)
            reviews.maybeWhen(
              data: (list) {
                Review? mine;
                for (final r in list) {
                  if (r.author.id == viewerId) mine = r;
                }
                return Padding(
                  padding: const EdgeInsetsDirectional.only(top: AppSpacing.lg),
                  child: _ReviewForm(
                    key: ValueKey('review-form-${mine?.id}'),
                    existing: mine,
                    onSubmit: onSubmit,
                  ),
                );
              },
              orElse: () => const SizedBox.shrink(),
            ),
          const SizedBox(height: AppSpacing.lg),
          reviews.when(
            data:
                (list) =>
                    list.isEmpty
                        ? Padding(
                          padding: const EdgeInsetsDirectional.symmetric(
                            vertical: AppSpacing.md,
                          ),
                          child: Center(
                            child: Text(
                              "Pas encore d'avis",
                              style: textTheme.bodyMedium!.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        )
                        : Column(
                          children: [
                            for (final r in list) ...[
                              _ReviewTile(review: r),
                              if (r != list.last)
                                const SizedBox(height: AppSpacing.md),
                            ],
                          ],
                        ),
            loading:
                () => const Padding(
                  padding: EdgeInsetsDirectional.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                ),
            error:
                (error, stack) => Center(
                  child: Column(
                    children: [
                      Text(
                        'Impossible de charger les avis.',
                        style: textTheme.bodyMedium!.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                      TextButton(
                        onPressed: onRetry,
                        child: const Text('Réessayer'),
                      ),
                    ],
                  ),
                ),
          ),
        ],
      ),
    );
  }
}

/// Big average on the leading side, one bar per star on the other.
class _Summary extends StatelessWidget {
  const _Summary({required this.summary});

  final RatingSummary summary;

  static const double _barHeight = 6;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final label = textTheme.labelMedium!.copyWith(
      fontWeight: FontWeight.w400,
      color: colors.textSecondary,
    );

    return Row(
      children: [
        Column(
          children: [
            Text(
              summary.count == 0 ? '—' : summary.rating.toStringAsFixed(1),
              key: const ValueKey('reviews-average'),
              style: textTheme.displayLarge,
            ),
            const SizedBox(height: 4),
            ServiceStars(value: summary.rating, size: 16),
            const SizedBox(height: 4),
            Text(reviewCountLabel(summary.count), style: label),
          ],
        ),
        const SizedBox(width: AppSpacing.xl),
        Expanded(
          child: Column(
            children: [
              for (final stars in [5, 4, 3, 2, 1])
                Padding(
                  padding: const EdgeInsetsDirectional.symmetric(vertical: 2.5),
                  child: Row(
                    children: [
                      SizedBox(width: 12, child: Text('$stars', style: label)),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: AppRadius.fullAll,
                          child: SizedBox(
                            height: _barHeight,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: colors.surfaceVariant,
                              ),
                              child: FractionallySizedBox(
                                alignment: AlignmentDirectional.centerStart,
                                widthFactor: summary.shares[stars] ?? 0,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: colors.rating,
                                    borderRadius: AppRadius.fullAll,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Stars and a few words. Prefilled with the viewer's review when there is
/// one, which a new submit replaces.
class _ReviewForm extends StatefulWidget {
  const _ReviewForm({
    super.key,
    required this.existing,
    required this.onSubmit,
  });

  final Review? existing;
  final Future<void> Function(int rating, String text) onSubmit;

  @override
  State<_ReviewForm> createState() => _ReviewFormState();
}

class _ReviewFormState extends State<_ReviewForm> {
  late final TextEditingController _text = TextEditingController(
    text: widget.existing?.text,
  );
  late int _rating = widget.existing?.rating ?? 0;
  bool _sending = false;
  bool _failed = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _failed = false;
    });
    try {
      await widget.onSubmit(_rating, _text.text.trim());
      if (mounted) setState(() => _sending = false);
    } catch (_) {
      if (mounted) {
        setState(() {
          _sending = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.xlAll,
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.existing == null ? 'Laisser un avis' : 'Votre avis',
              style: textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.xs),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: StarRatingInput(
                value: _rating,
                onChanged: (v) => setState(() => _rating = v),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            TextField(
              key: const ValueKey('review-text'),
              controller: _text,
              minLines: 2,
              maxLines: 5,
              textCapitalization: TextCapitalization.sentences,
              style: textTheme.bodyLarge,
              decoration: InputDecoration(
                hintText: "Comment s'est passée votre expérience ?",
                hintStyle: textTheme.bodyLarge!.copyWith(
                  color: colors.textMuted,
                ),
                filled: true,
                fillColor: colors.surface,
                contentPadding: const EdgeInsetsDirectional.all(AppSpacing.md),
                border: OutlineInputBorder(
                  borderRadius: AppRadius.lgAll,
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: AppRadius.lgAll,
                  borderSide: BorderSide(color: colors.link, width: 2),
                ),
              ),
            ),
            if (_failed) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                "Impossible de publier l'avis. Réessayez.",
                textAlign: TextAlign.center,
                style: textTheme.bodyMedium!.copyWith(color: colors.urgent),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            PrimaryButton(
              key: const ValueKey('review-send'),
              label: 'Publier',
              onPressed: _rating > 0 && !_sending ? _send : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review});

  final Review review;

  static const double _avatar = 32;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final reply = review.reply;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.xlAll,
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: _avatar,
                  height: _avatar,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    review.author.name.characters.first.toUpperCase(),
                    style: textTheme.titleMedium!.copyWith(color: colors.link),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        review.author.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.titleMedium,
                      ),
                      Text(
                        timeAgo(review.createdAt),
                        style: textTheme.labelMedium!.copyWith(
                          fontWeight: FontWeight.w400,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                ServiceStars(value: review.rating.toDouble(), size: 13),
              ],
            ),
            if (review.text.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(review.text, style: textTheme.bodyLarge),
            ],
            if (reply != null) ...[
              const SizedBox(height: AppSpacing.sm),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: AppRadius.lgAll,
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: Padding(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Réponse de l'établissement",
                          style: textTheme.labelMedium!.copyWith(
                            color: colors.link,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(reply, style: textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
