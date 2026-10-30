import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/glass_card.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../data/service_models.dart';
import '../service_format.dart';

/// "Prendre rendez-vous" block of the detail (web `BookingCard`). Appointment
/// requests exist for Pro places only; the owner of a place cannot book it.
/// For the viewer's own request it shows the day, the animal and the state
/// (sent, confirmed, declined, cancelled); a declined or cancelled request
/// leaves the way open to ask for another slot.
class ServiceBookingCard extends StatelessWidget {
  const ServiceBookingCard({
    super.key,
    required this.service,
    required this.booking,
    required this.isOwn,
    required this.onRequest,
    required this.onCancel,
  });

  final Service service;

  /// The viewer's latest request for this place, if any.
  final Booking? booking;
  final bool isOwn;
  final VoidCallback onRequest;
  final VoidCallback onCancel;

  static const double _iconSize = 20;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SvgPicture.asset(
                'assets/icons/calendar.svg',
                width: _iconSize,
                height: _iconSize,
                colorFilter: ColorFilter.mode(colors.link, BlendMode.srcIn),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Prendre rendez-vous',
                  style: textTheme.headlineSmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _body(context),
        ],
      ),
    );
  }

  Widget _body(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final muted = textTheme.bodyMedium!.copyWith(color: colors.textSecondary);

    if (isOwn) {
      return Text(
        "C'est votre fiche. Les clients réservent et vous notent ici.",
        style: muted,
      );
    }
    if (!service.pro) {
      return Text(
        "Cet établissement ne prend pas encore de rendez-vous en ligne. "
        'Appelez-le directement.',
        key: const ValueKey('booking-only-pro'),
        style: muted,
      );
    }

    final mine = booking;
    final canAsk = mine == null || !mine.isActive;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (mine != null) _MyBooking(booking: mine, onCancel: onCancel),
        if (mine == null)
          Padding(
            padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
            child: Text(
              "Choisissez un créneau, l'établissement confirme. "
              "Aucun paiement n'est demandé.",
              style: muted,
            ),
          ),
        if (mine != null && canAsk) const SizedBox(height: AppSpacing.md),
        if (canAsk)
          PrimaryButton(
            key: const ValueKey('booking-cta'),
            label:
                mine == null
                    ? 'Demander un rendez-vous'
                    : 'Demander un autre créneau',
            icon: 'assets/icons/calendar.svg',
            onPressed: onRequest,
          ),
      ],
    );
  }
}

class _MyBooking extends StatelessWidget {
  const _MyBooking({required this.booking, required this.onCancel});

  final Booking booking;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final statusColor = switch (booking.status) {
      BookingStatus.confirmed => colors.success,
      BookingStatus.declined => colors.urgent,
      BookingStatus.cancelled => colors.textSecondary,
      BookingStatus.sent => colors.monitor,
    };
    final about = [
      booking.animal,
      booking.reason,
    ].where((s) => s.isNotEmpty).join(' · ');

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
            // The time stays left-to-right inside right-to-left text.
            Row(
              key: const ValueKey('booking-when'),
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    '${formatBookingDay(booking.date)} · ',
                    style: textTheme.titleMedium,
                  ),
                ),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(booking.time, style: textTheme.titleMedium),
                ),
              ],
            ),
            if (about.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                about,
                style: textTheme.bodyMedium!.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Text(
              bookingStatusLabel(booking.status),
              key: const ValueKey('booking-status'),
              style: textTheme.titleMedium!.copyWith(color: statusColor),
            ),
            if (booking.isActive) ...[
              const SizedBox(height: AppSpacing.xs),
              _CancelButton(onConfirm: onCancel),
            ],
          ],
        ),
      ),
    );
  }
}

/// Two taps, so a withdrawn request is never an accident (web: ConfirmButton).
class _CancelButton extends StatefulWidget {
  const _CancelButton({required this.onConfirm});

  final VoidCallback onConfirm;

  @override
  State<_CancelButton> createState() => _CancelButtonState();
}

class _CancelButtonState extends State<_CancelButton> {
  bool _armed = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: TextButton(
        key: const ValueKey('booking-cancel'),
        onPressed: () {
          if (_armed) {
            widget.onConfirm();
          } else {
            setState(() => _armed = true);
          }
        },
        child: Text(
          _armed ? "Confirmer l'annulation" : 'Annuler le rendez-vous',
          style: Theme.of(context).textTheme.titleSmall!.copyWith(
            color: _armed ? colors.urgent : colors.textSecondary,
          ),
        ),
      ),
    );
  }
}
