import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import 'pet_card.dart';

/// Swipeable photos of one animal (at most three, see `maxAdoptionPhotos`)
/// with dots on the photo. A single photo shows no dots.
class PhotoGallery extends StatefulWidget {
  const PhotoGallery({super.key, required this.photos, required this.label});

  final List<String> photos;
  final String label;

  /// Photo width / height.
  static const double aspect = 0.86;

  @override
  State<PhotoGallery> createState() => _PhotoGalleryState();
}

class _PhotoGalleryState extends State<PhotoGallery> {
  int _page = 0;

  static const double _dotSize = 7;
  static const double _dotGap = 5;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final count = widget.photos.length;

    return AspectRatio(
      aspectRatio: PhotoGallery.aspect,
      child: ClipRRect(
        borderRadius: AppRadius.xxxlAll,
        child: ColoredBox(
          color: colors.surfaceMuted,
          child: Stack(
            fit: StackFit.expand,
            children: [
              PageView.builder(
                key: const ValueKey('adopt-gallery'),
                itemCount: count,
                onPageChanged: (page) => setState(() => _page = page),
                itemBuilder:
                    (context, i) => PetPhoto(
                      widget.photos[i],
                      label: '${widget.label}, photo ${i + 1} sur $count',
                    ),
              ),
              if (count > 1)
                PositionedDirectional(
                  bottom: 12,
                  start: 0,
                  end: 0,
                  child: Center(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.glassStrong,
                        borderRadius: AppRadius.fullAll,
                      ),
                      child: Padding(
                        padding: const EdgeInsetsDirectional.symmetric(
                          horizontal: 9,
                          vertical: 6,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (var i = 0; i < count; i++) ...[
                              if (i > 0) const SizedBox(width: _dotGap),
                              AnimatedContainer(
                                key: ValueKey('adopt-dot-$i'),
                                duration: const Duration(milliseconds: 200),
                                width: i == _page ? _dotSize * 2 : _dotSize,
                                height: _dotSize,
                                decoration: BoxDecoration(
                                  color:
                                      i == _page
                                          ? colors.link
                                          : colors.textMuted,
                                  borderRadius: AppRadius.fullAll,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
