import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/illustration.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/widgets/round_close_button.dart';
import '../../data/service_models.dart';
import '../../providers.dart';
import '../service_format.dart';
import 'service_card.dart';

/// Opens the appointment request form. Resolves to true once it was sent.
Future<bool?> showServiceBookingSheet(BuildContext context, Service service) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: context.colors.scrim,
    builder: (context) => ServiceBookingSheet(service: service),
  );
}

/// Web `BookingCard` form: date, time, animal and an optional reason. The
/// slot must be in the future.
class ServiceBookingSheet extends ConsumerStatefulWidget {
  const ServiceBookingSheet({super.key, required this.service});

  final Service service;

  @override
  ConsumerState<ServiceBookingSheet> createState() =>
      _ServiceBookingSheetState();
}

class _ServiceBookingSheetState extends ConsumerState<ServiceBookingSheet> {
  final _animal = TextEditingController();
  final _reason = TextEditingController();
  DateTime? _date;
  TimeOfDay? _time;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _animal.dispose();
    _reason.dispose();
    super.dispose();
  }

  bool get _ready =>
      _date != null && _time != null && _animal.text.trim().isNotEmpty;

  Future<void> _pickDate() async {
    final today = DateUtils.dateOnly(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? today.add(const Duration(days: 1)),
      firstDate: today,
      lastDate: today.add(const Duration(days: 365)),
    );
    if (picked != null && mounted) {
      setState(() {
        _date = picked;
        _error = null;
      });
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time ?? const TimeOfDay(hour: 9, minute: 0),
      builder:
          (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
            child: child!,
          ),
    );
    if (picked != null && mounted) {
      setState(() {
        _time = picked;
        _error = null;
      });
    }
  }

  Future<void> _send() async {
    final date = _date!;
    final time = _time!;
    final when = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );
    if (when.isBefore(DateTime.now())) {
      setState(() => _error = 'Choisissez une date et une heure à venir.');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref
          .read(serviceActionsProvider)
          .sendBooking(
            serviceId: widget.service.id,
            date: bookingDateKey(date),
            time: formatClock(time),
            animal: _animal.text.trim(),
            reason: _reason.text.trim(),
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = "Impossible d'envoyer la demande. Réessayez.";
        });
      }
    }
  }

  InputDecoration _decoration(BuildContext context, String hint) {
    final colors = context.colors;
    return InputDecoration(
      hintText: hint,
      hintStyle: Theme.of(
        context,
      ).textTheme.bodyLarge!.copyWith(color: colors.textMuted),
      filled: true,
      fillColor: colors.surface,
      contentPadding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      border: OutlineInputBorder(
        borderRadius: AppRadius.xlAll,
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: AppRadius.xlAll,
        borderSide: BorderSide(color: colors.link, width: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final service = widget.service;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final date = _date;
    final time = _time;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sheet,
        borderRadius: AppRadius.sheetTop,
        boxShadow: AppShadows.sheet(Theme.of(context).brightness),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsetsDirectional.fromSTEB(
          AppSpacing.xl,
          AppSpacing.md,
          AppSpacing.xl,
          AppSpacing.xl + keyboard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 5,
                decoration: BoxDecoration(
                  color: colors.outline,
                  borderRadius: AppRadius.fullAll,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: colors.tone(service.type.tone),
                    borderRadius: AppRadius.xlAll,
                  ),
                  child: Illustration(
                    service.type.illustration,
                    size: 38,
                    shadowBlur: 8,
                    shadowOffsetY: 5,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Demande de rendez-vous',
                        style: textTheme.titleSmall!.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                      Text(
                        service.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.headlineMedium,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                RoundCloseButton(
                  key: const ValueKey('booking-sheet-close'),
                  onTap: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              children: [
                Expanded(
                  child: _PickerField(
                    key: const ValueKey('booking-date'),
                    label: 'Date',
                    icon: 'assets/icons/calendar.svg',
                    value:
                        date == null
                            ? null
                            : formatBookingDay(bookingDateKey(date)),
                    onTap: _pickDate,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _PickerField(
                    key: const ValueKey('booking-time'),
                    label: 'Heure',
                    icon: 'assets/icons/clock.svg',
                    value: time == null ? null : formatClock(time),
                    onTap: _pickTime,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('Animal', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              key: const ValueKey('booking-animal'),
              controller: _animal,
              onChanged: (_) => setState(() {}),
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.next,
              style: textTheme.bodyLarge,
              decoration: _decoration(context, 'Luna, chienne de 2 ans'),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text('Motif', style: textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              key: const ValueKey('booking-reason'),
              controller: _reason,
              textCapitalization: TextCapitalization.sentences,
              style: textTheme.bodyLarge,
              decoration: _decoration(context, 'Vaccin, contrôle, blessure…'),
            ),
            const SizedBox(height: AppSpacing.md),
            const _ConfirmRule(),
            const SizedBox(height: AppSpacing.xl),
            if (_error != null) ...[
              Text(
                _error!,
                key: const ValueKey('booking-error'),
                textAlign: TextAlign.center,
                style: textTheme.bodyMedium!.copyWith(color: colors.urgent),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            PrimaryButton(
              key: const ValueKey('booking-send'),
              label: 'Envoyer la demande',
              onPressed: _ready && !_sending ? _send : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// Tappable field that opens the date or time picker.
class _PickerField extends StatelessWidget {
  const _PickerField({
    super.key,
    required this.label,
    required this.icon,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String icon;

  /// Null until picked.
  final String? value;
  final VoidCallback onTap;

  static const double _iconSize = 18;
  static const double _height = 56;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final picked = value != null;

    return Semantics(
      button: true,
      label: picked ? '$label, $value' : label,
      child: ExcludeSemantics(
        child: Material(
          color: colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.xlAll,
            side: BorderSide(color: picked ? colors.link : colors.outline),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              height: _height,
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                ),
                child: Row(
                  children: [
                    SvgPicture.asset(
                      icon,
                      width: _iconSize,
                      height: _iconSize,
                      colorFilter: ColorFilter.mode(
                        picked ? colors.link : colors.textSecondary,
                        BlendMode.srcIn,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        value ?? label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.titleSmall!.copyWith(
                          color: picked ? colors.textPrimary : colors.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// What happens next, said plainly.
class _ConfirmRule extends StatelessWidget {
  const _ConfirmRule();

  static const double _iconSize = 18;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.primaryContainer,
        borderRadius: AppRadius.lgAll,
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(top: 1),
              child: SvgPicture.asset(
                'assets/icons/calendar.svg',
                width: _iconSize,
                height: _iconSize,
                colorFilter: ColorFilter.mode(colors.link, BlendMode.srcIn),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                "L'établissement confirme le créneau ou l'indique indisponible. "
                "Aucun paiement n'est demandé.",
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
