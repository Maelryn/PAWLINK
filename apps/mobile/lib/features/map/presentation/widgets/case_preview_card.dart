import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/widgets/round_close_button.dart';
import '../../../cases/data/case_models.dart';
import '../case_format.dart';
import 'case_photo.dart';

/// Bottom card of a tapped pin. Styled after the report rows of the panel
/// (photo, triage label, title, place and time), with the description and the
/// "Je peux aider" action. There is no separate detail screen.
class CasePreviewCard extends StatefulWidget {
  const CasePreviewCard({
    super.key,
    required this.item,
    required this.viewerId,
    required this.onHelp,
    required this.onClose,
  });

  final Case item;
  final String viewerId;

  /// Offers to help. May fail; the card then says so and stays usable.
  final Future<void> Function() onHelp;
  final VoidCallback onClose;

  @override
  State<CasePreviewCard> createState() => _CasePreviewCardState();
}

class _CasePreviewCardState extends State<CasePreviewCard> {
  static const double _blur = 16;
  static const double _photo = 76;

  bool _sending = false;

  Future<void> _help() async {
    setState(() => _sending = true);
    try {
      await widget.onHelp();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Impossible d'envoyer votre aide pour le moment."),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final brightness = Theme.of(context).brightness;
    final item = widget.item;
    final helping = item.isHelpedBy(widget.viewerId);
    final others = item.helpers.where((h) => h.user.id != widget.viewerId);

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: AppRadius.xxlAll,
        boxShadow: AppShadows.floating(brightness),
      ),
      child: ClipRRect(
        borderRadius: AppRadius.xxlAll,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: _blur, sigmaY: _blur),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.glassStrong,
              borderRadius: AppRadius.xxlAll,
              border: Border.all(color: colors.glassBorder),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: AppRadius.lgAll,
                      child: SizedBox(
                        width: _photo,
                        height: _photo,
                        child: CasePhoto(src: item.photos.firstOrNull),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: _Summary(item: item)),
                    const SizedBox(width: AppSpacing.sm),
                    RoundCloseButton(onTap: widget.onClose),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  item.description,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodySmall!.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                if (others.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    others.length == 1
                        ? '1 personne aide déjà sur ce cas'
                        : '${others.length} personnes aident déjà sur ce cas',
                    style: textTheme.labelMedium!.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                if (helping)
                  const _HelpingBadge()
                else
                  PrimaryButton(
                    key: const ValueKey('map-help'),
                    label: 'Je peux aider',
                    onPressed: _sending ? null : _help,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.item});

  final Case item;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final count = item.count;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '● ${triageLabel(item.triage)}',
          style: textTheme.labelSmall!.copyWith(
            fontWeight: FontWeight.w800,
            color: triageColor(colors, item.triage),
          ),
        ),
        const SizedBox(height: 3),
        Text(
          item.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: textTheme.titleLarge,
        ),
        const SizedBox(height: 3),
        Text(
          caseSubtitle(item),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: textTheme.labelSmall!.copyWith(
            fontWeight: FontWeight.w400,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          count == null || count < 2
              ? speciesLabel(item.species)
              : '${speciesLabel(item.species)} · $count',
          style: textTheme.labelSmall!.copyWith(color: colors.link),
        ),
      ],
    );
  }
}

/// Replaces the button once the viewer has offered help.
class _HelpingBadge extends StatelessWidget {
  const _HelpingBadge();

  static const double _height = 52;
  static const double _iconSize = 19;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      container: true,
      label: 'Vous aidez sur ce cas',
      child: ExcludeSemantics(
        child: Container(
          key: const ValueKey('map-helping'),
          height: _height,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: colors.successRing,
            borderRadius: AppRadius.fullAll,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SvgPicture.asset(
                'assets/icons/check.svg',
                width: _iconSize,
                height: _iconSize,
                colorFilter: ColorFilter.mode(colors.success, BlendMode.srcIn),
              ),
              const SizedBox(width: 9),
              Text(
                'Vous aidez sur ce cas',
                style: Theme.of(
                  context,
                ).textTheme.labelLarge!.copyWith(color: colors.textPrimary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
