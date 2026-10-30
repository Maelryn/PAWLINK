import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../data/adoption_models.dart';
import '../adopt_format.dart';

/// Floating glass bar at the bottom of the detail. What it offers depends on
/// the viewer's request (web: `AdoptionProfilePage` action bar):
/// no request -> ask; sent/accepted/declined -> its status (+ the owner's
/// phone once accepted); someone else's request accepted -> on hold.
class AdoptActionBar extends StatelessWidget {
  const AdoptActionBar({
    super.key,
    required this.pet,
    required this.request,
    required this.onRequest,
    required this.onCancel,
    required this.onCall,
    required this.onWhatsapp,
  });

  final AdoptionProfile pet;
  final AdoptionRequest? request;
  final VoidCallback onRequest;
  final VoidCallback onCancel;
  final ValueChanged<String> onCall;
  final ValueChanged<String> onWhatsapp;

  static const double _maxWidth = 406;
  static const double _sideMargin = 12;
  static const double _bottomMargin = 10;
  static const double _blur = 20;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(
          _sideMargin,
          0,
          _sideMargin,
          _bottomMargin,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _maxWidth),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: AppRadius.xxxlAll,
              boxShadow: AppShadows.floating(brightness),
            ),
            child: ClipRRect(
              borderRadius: AppRadius.xxxlAll,
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: _blur, sigmaY: _blur),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colors.glassMedium,
                    borderRadius: AppRadius.xxxlAll,
                    border: Border.all(color: colors.glassBorder),
                  ),
                  child: Padding(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
                    child: _content(context),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _content(BuildContext context) {
    final mine = request;
    if (mine != null) return _MyRequest(pet: pet, request: mine, bar: this);
    if (pet.reserved || pet.status != AdoptionStatus.approved) {
      return const _OnHold();
    }
    return _Ask(pet: pet, onRequest: onRequest);
  }
}

class _Ask extends StatelessWidget {
  const _Ask({required this.pet, required this.onRequest});

  final AdoptionProfile pet;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                pet.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.titleLarge,
              ),
              Text(
                pet.shelter.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.labelMedium!.copyWith(
                  fontWeight: FontWeight.w400,
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        // Flexible: on a narrow screen the label wraps instead of overflowing.
        Flexible(
          flex: 2,
          child: PrimaryButton(
            key: const ValueKey('adopt-cta'),
            label: "Je veux l'adopter",
            icon: 'assets/icons/heart.svg',
            onPressed: onRequest,
          ),
        ),
      ],
    );
  }
}

class _OnHold extends StatelessWidget {
  const _OnHold();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Adoption en cours', style: textTheme.titleLarge),
        const SizedBox(height: 3),
        Text(
          "Le propriétaire a accepté une demande. Si ça ne se fait pas, "
          "l'animal sera de nouveau disponible.",
          style: textTheme.bodyMedium!.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }
}

class _MyRequest extends StatelessWidget {
  const _MyRequest({
    required this.pet,
    required this.request,
    required this.bar,
  });

  final AdoptionProfile pet;
  final AdoptionRequest request;
  final AdoptActionBar bar;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final status = request.status;
    final phone = pet.ownerPhone;
    final accepted = status == RequestStatus.accepted;
    final canCancel =
        status == RequestStatus.sent || status == RequestStatus.accepted;
    final statusColor = switch (status) {
      RequestStatus.accepted => colors.success,
      RequestStatus.declined => colors.urgent,
      _ => colors.monitor,
    };

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(end: AppSpacing.md),
              child: Text(
                'Votre demande',
                style: textTheme.bodyMedium!.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ),
            Flexible(
              child: Text(
                requestStatusLabel(status),
                key: const ValueKey('adopt-request-status'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.titleMedium!.copyWith(color: statusColor),
              ),
            ),
          ],
        ),
        // The phone arrives with the accepted request, never from the screen.
        if (accepted && phone != null) ...[
          const SizedBox(height: AppSpacing.md),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Text(
              phone,
              key: const ValueKey('adopt-owner-phone'),
              textAlign: TextAlign.center,
              style: textTheme.headlineSmall!.copyWith(color: colors.link),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: PrimaryButton(
                  key: const ValueKey('adopt-call'),
                  label: 'Appeler',
                  icon: 'assets/icons/phone.svg',
                  onPressed: () => bar.onCall(phone),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _TintedButton(
                  key: const ValueKey('adopt-whatsapp'),
                  label: 'WhatsApp',
                  icon: 'assets/icons/message-circle.svg',
                  onPressed: () => bar.onWhatsapp(phone),
                ),
              ),
            ],
          ),
        ],
        if (canCancel) ...[
          const SizedBox(height: AppSpacing.xs),
          _CancelButton(onConfirm: bar.onCancel),
        ],
      ],
    );
  }
}

/// Soft secondary pill (Make: primaryContainer fill, link-blue label).
class _TintedButton extends StatelessWidget {
  const _TintedButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final String icon;
  final VoidCallback onPressed;

  static const double _height = 52;
  static const double _iconSize = 19;
  static const double _gap = 9;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Material(
      color: colors.primaryContainer,
      borderRadius: AppRadius.fullAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: SizedBox(
          height: _height,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SvgPicture.asset(
                icon,
                width: _iconSize,
                height: _iconSize,
                colorFilter: ColorFilter.mode(colors.link, BlendMode.srcIn),
              ),
              const SizedBox(width: _gap),
              Flexible(
                child: Text(
                  label,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge!.copyWith(color: colors.link),
                ),
              ),
            ],
          ),
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

    return TextButton(
      key: const ValueKey('adopt-cancel'),
      onPressed: () {
        if (_armed) {
          widget.onConfirm();
        } else {
          setState(() => _armed = true);
        }
      },
      child: Text(
        _armed ? "Confirmer l'annulation" : 'Annuler ma demande',
        style: Theme.of(context).textTheme.titleSmall!.copyWith(
          color: _armed ? colors.urgent : colors.textSecondary,
        ),
      ),
    );
  }
}
