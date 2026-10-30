import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/widgets/app_icon.dart';
import '../../../../shared/widgets/tinted_button.dart';
import '../../providers.dart';
import 'step_header.dart';

/// Step 1: a photo from the camera or the gallery. Optional, as on the web.
class PhotoStep extends ConsumerWidget {
  const PhotoStep({super.key});

  static const double _height = 288;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final state = ref.watch(reportControllerProvider);
    final controller = ref.read(reportControllerProvider.notifier);
    final photo = state.draft.photoPath;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const StepHeader(
          icon: 'assets/icons/camera.svg',
          title: 'Ajoutez une photo',
          body:
              "Une photo nette aide les secouristes à comprendre la situation.",
        ),
        if (photo != null)
          _PhotoPreview(path: photo, onRemove: controller.removePhoto)
        else
          Material(
            color: colors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.xxxlAll,
              side: BorderSide(color: colors.outline, width: 2),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: const ValueKey('report-photo-area'),
              onTap: () => controller.pickPhoto(ImageSource.gallery),
              child: SizedBox(
                height: 200,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: colors.primary,
                        shape: BoxShape.circle,
                        boxShadow: AppShadows.glow(colors.primary),
                      ),
                      child: AppIcon(
                        'assets/icons/image-plus.svg',
                        size: 24,
                        color: colors.onPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Touchez pour ajouter une photo',
                      style: textTheme.titleSmall!.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        if (photo == null) ...[
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: TintedButton(
                  key: const ValueKey('report-photo-camera'),
                  label: 'Prendre une photo',
                  icon: 'assets/icons/camera.svg',
                  onPressed: () => controller.pickPhoto(ImageSource.camera),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: TintedButton(
                  key: const ValueKey('report-photo-gallery'),
                  label: 'Galerie',
                  icon: 'assets/icons/image-plus.svg',
                  onPressed: () => controller.pickPhoto(ImageSource.gallery),
                ),
              ),
            ],
          ),
        ],
        if (state.photoError != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            state.photoError!,
            style: textTheme.bodyMedium!.copyWith(color: colors.urgent),
          ),
        ],
      ],
    );
  }
}

class _PhotoPreview extends StatelessWidget {
  const _PhotoPreview({required this.path, required this.onRemove});

  final String path;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return ClipRRect(
      borderRadius: AppRadius.xxxlAll,
      child: SizedBox(
        height: PhotoStep._height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.file(File(path), fit: BoxFit.cover),
            PositionedDirectional(
              top: AppSpacing.md,
              end: AppSpacing.md,
              child: Semantics(
                button: true,
                label: 'Retirer la photo',
                child: ExcludeSemantics(
                  child: Material(
                    color: colors.glassStrong,
                    shape: const CircleBorder(),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      key: const ValueKey('report-photo-remove'),
                      onTap: onRemove,
                      child: SizedBox(
                        width: 36,
                        height: 36,
                        child: Center(
                          child: AppIcon(
                            'assets/icons/x.svg',
                            size: 18,
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            PositionedDirectional(
              bottom: AppSpacing.md,
              start: AppSpacing.md,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.glassStrong,
                  borderRadius: AppRadius.fullAll,
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: 6,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AppIcon(
                        'assets/icons/check.svg',
                        size: 14,
                        color: colors.success,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Photo ajoutée',
                        style: textTheme.titleSmall!.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
