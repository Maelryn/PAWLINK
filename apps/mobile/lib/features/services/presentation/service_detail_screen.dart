import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_background.dart';
import '../../../shared/widgets/glass_card.dart';
import '../../../shared/widgets/gradient_text.dart';
import '../../../shared/widgets/illustration.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/round_back_button.dart';
import '../../../shared/widgets/tinted_button.dart';
import '../data/rating_summary.dart';
import '../data/service_models.dart';
import '../providers.dart';
import 'service_format.dart';
import 'widgets/service_booking_card.dart';
import 'widgets/service_booking_sheet.dart';
import 'widgets/service_card.dart';
import 'widgets/service_reviews_section.dart';

/// Place detail: who it is, how to reach it, the appointment request (Pro
/// places only) and the reviews. Behavior follows the web `/services/[id]`;
/// there is no Make design for it, so it reuses the Services/Adopter language.
class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = ref.watch(serviceProvider(id));

    return Scaffold(
      body: AppBackground(
        child: service.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error:
              (error, stack) => _Message(
                title: 'Impossible de charger ce lieu.',
                actionLabel: 'Réessayer',
                onAction: () => ref.invalidate(serviceProvider(id)),
              ),
          data:
              (service) =>
                  service == null
                      ? _Message(
                        title: "Ce lieu n'existe pas.",
                        actionLabel: 'Retour',
                        onAction: () => context.pop(),
                      )
                      : _Detail(service: service),
        ),
      ),
    );
  }
}

class _Detail extends ConsumerWidget {
  const _Detail({required this.service});

  final Service service;

  static const double _bottomClearance = 32;
  static const double _sectionGap = AppSpacing.md;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final viewerId = ref.watch(currentUserIdProvider);
    final isOwn = service.ownerId == viewerId;
    final summary = ref.watch(ratingSummaryProvider(service.id));
    final reviews = ref.watch(serviceReviewsProvider(service.id));
    final booking = ref.watch(myBookingProvider(service.id)).value;
    final actions = ref.read(serviceActionsProvider);

    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: AppSpacing.screenPadding.copyWith(
            top: top + AppSpacing.md,
            bottom: bottom + _bottomClearance,
          ),
          sliver: SliverList.list(
            children: [
              RoundBackButton(onTap: () => context.pop()),
              const SizedBox(height: AppSpacing.md),
              _Visual(service: service),
              _Header(service: service, summary: summary),
              _ContactButtons(service: service),
              const SizedBox(height: _sectionGap),
              _AboutCard(service: service),
              const SizedBox(height: _sectionGap),
              ServiceBookingCard(
                service: service,
                booking: booking,
                isOwn: isOwn,
                onRequest: () => _request(context),
                onCancel: () async {
                  if (booking == null) return;
                  await actions.cancelBooking(booking);
                  if (context.mounted) _toast(context, 'Rendez-vous annulé');
                },
              ),
              const SizedBox(height: _sectionGap),
              ServiceReviewsSection(
                summary: summary,
                reviews: reviews,
                viewerId: viewerId,
                canReview: !isOwn,
                onSubmit: (rating, text) async {
                  await actions.saveReview(
                    serviceId: service.id,
                    rating: rating,
                    text: text,
                  );
                  if (context.mounted) {
                    _toast(context, 'Merci pour votre avis !');
                  }
                },
                onRetry:
                    () => ref.invalidate(serviceReviewsProvider(service.id)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _request(BuildContext context) async {
    final sent = await showServiceBookingSheet(context, service);
    if (sent == true && context.mounted) {
      _toast(context, "Demande envoyée. L'établissement va confirmer.");
    }
  }

  void _toast(BuildContext context, String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));
  }
}

/// Tone-colored visual with the type illustration, as on the directory card.
class _Visual extends StatelessWidget {
  const _Visual({required this.service});

  final Service service;

  static const double _height = 168;
  static const double _illustrationSize = 92;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final arabic = Localizations.localeOf(context).languageCode == 'ar';

    return Container(
      height: _height,
      decoration: BoxDecoration(
        gradient: colors.tone(service.type.tone),
        borderRadius: AppRadius.xxlAll,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Illustration(
            service.type.illustration,
            size: _illustrationSize,
            shadowBlur: 14,
          ),
          if (service.pro)
            PositionedDirectional(
              top: AppSpacing.md,
              start: AppSpacing.md,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.glassStrong,
                  borderRadius: AppRadius.fullAll,
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  child: Text(
                    'Mis en avant',
                    style: AppTextStyles.micro(
                      arabic: arabic,
                    ).copyWith(letterSpacing: 0, color: colors.link),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Type, name in brand gradient (with the verified badge), rating and city.
class _Header extends StatelessWidget {
  const _Header({required this.service, required this.summary});

  final Service service;
  final RatingSummary? summary;

  static const double _badgeSize = 24;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final arabic = Localizations.localeOf(context).languageCode == 'ar';
    final rating = summary?.rating ?? service.rating;
    final count = summary?.count ?? service.reviewCount;

    return Padding(
      padding: const EdgeInsetsDirectional.only(
        top: AppSpacing.lg,
        bottom: AppSpacing.lg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            service.type.label.toUpperCase(),
            style: AppTextStyles.micro(
              arabic: arabic,
            ).copyWith(color: colors.link),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Flexible(
                child: GradientText(
                  service.name,
                  gradient: colors.brandGradient,
                  style: textTheme.headlineLarge!,
                ),
              ),
              if (service.verified) ...[
                const SizedBox(width: AppSpacing.sm),
                Padding(
                  padding: const EdgeInsetsDirectional.only(top: 5),
                  child: Semantics(
                    label: 'Vérifié',
                    child: SvgPicture.asset(
                      'assets/icons/badge-check.svg',
                      width: _badgeSize,
                      height: _badgeSize,
                      colorFilter: ColorFilter.mode(
                        colors.link,
                        BlendMode.srcIn,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '★', style: TextStyle(color: colors.rating)),
                TextSpan(
                  text:
                      count == 0
                          ? ' —'
                          : ' ${rating.toStringAsFixed(1)}'
                              ' (${reviewCountLabel(count)})',
                ),
                if (service.city.isNotEmpty)
                  TextSpan(text: ' · ${service.city}'),
              ],
            ),
            style: textTheme.bodyLarge!.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// Call (when the place has a phone) and directions in Google Maps.
class _ContactButtons extends StatelessWidget {
  const _ContactButtons({required this.service});

  final Service service;

  @override
  Widget build(BuildContext context) {
    final phone = service.phone;
    final at = service.location;

    return Row(
      children: [
        if (phone != null) ...[
          Expanded(
            child: PrimaryButton(
              key: const ValueKey('service-call'),
              label: 'Appeler',
              icon: 'assets/icons/phone.svg',
              onPressed:
                  () => _open(
                    Uri(
                      scheme: 'tel',
                      path: phone.replaceAll(RegExp(r'\s'), ''),
                    ),
                  ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
        ],
        Expanded(
          child: TintedButton(
            key: const ValueKey('service-directions'),
            label: 'Itinéraire',
            icon: 'assets/icons/navigation.svg',
            onPressed:
                () => _open(
                  Uri.https('www.google.com', '/maps/dir/', {
                    'api': '1',
                    'destination': '${at.lat},${at.lng}',
                  }),
                ),
          ),
        ),
      ],
    );
  }

  Future<void> _open(Uri uri) =>
      launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Description, tags and opening hours.
class _AboutCard extends StatelessWidget {
  const _AboutCard({required this.service});

  final Service service;

  static const double _iconSize = 18;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final description = service.description;
    final hours = service.hours;
    final open = service.openNow;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (description != null || service.tags.isNotEmpty) ...[
            const SectionEyebrow('À propos'),
            const SizedBox(height: AppSpacing.sm),
            if (description != null)
              Text(description, style: textTheme.bodyLarge),
            if (service.tags.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final tag in service.tags)
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.primaryContainer,
                        borderRadius: AppRadius.fullAll,
                      ),
                      child: Padding(
                        padding: const EdgeInsetsDirectional.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        child: Text(
                          tag,
                          style: textTheme.titleSmall!.copyWith(
                            color: colors.link,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ],
          if (hours != null) ...[
            if (description != null || service.tags.isNotEmpty)
              const SizedBox(height: AppSpacing.lg),
            const SectionEyebrow('Horaires'),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                SvgPicture.asset(
                  'assets/icons/clock.svg',
                  width: _iconSize,
                  height: _iconSize,
                  colorFilter: ColorFilter.mode(
                    colors.textSecondary,
                    BlendMode.srcIn,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Flexible(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: hours),
                        if (open != null)
                          TextSpan(
                            text: open ? ' · Ouvert' : ' · Fermé',
                            style: TextStyle(
                              color: open ? colors.success : colors.urgent,
                            ),
                          ),
                      ],
                    ),
                    style: textTheme.titleMedium,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Not found / load error, with one way out.
class _Message extends StatelessWidget {
  const _Message({
    required this.title,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: AppSpacing.screenPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Illustration(
              'assets/illustrations/stethoscope.png',
              size: 70,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: textTheme.headlineMedium,
            ),
            TextButton(onPressed: onAction, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}
