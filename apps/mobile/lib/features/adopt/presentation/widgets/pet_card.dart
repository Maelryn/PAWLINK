import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/adoption_models.dart';
import '../adopt_format.dart';

/// Photo with the heart on the top end corner and the age pill bottom start,
/// then name + sex and one detail line.
class PetCard extends StatelessWidget {
  const PetCard({
    super.key,
    required this.pet,
    required this.isFavorite,
    required this.onToggleFavorite,
    required this.onTap,
  });

  final AdoptionProfile pet;
  final bool isFavorite;
  final VoidCallback onToggleFavorite;

  /// Opens the detail; the heart handles its own taps.
  final VoidCallback onTap;

  /// Photo width / height (Make: aspect-ratio .79).
  static const double _photoAspect = 0.79;
  static const double _favoriteSize = 36;
  static const double _favoriteIconSize = 18;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: _photoAspect,
            child: ClipRRect(
              borderRadius: AppRadius.xxlAll,
              child: ColoredBox(
                color: colors.surfaceMuted,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    PetPhoto(pet.coverPhoto, label: pet.name),
                    PositionedDirectional(
                      top: 9,
                      end: 9,
                      child: _FavoriteButton(
                        key: ValueKey('adopt-favorite-${pet.id}'),
                        name: pet.name,
                        selected: isFavorite,
                        size: _favoriteSize,
                        iconSize: _favoriteIconSize,
                        onTap: onToggleFavorite,
                      ),
                    ),
                    PositionedDirectional(
                      bottom: 8,
                      start: 8,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.glassStrong,
                          borderRadius: AppRadius.fullAll,
                        ),
                        child: Padding(
                          padding: const EdgeInsetsDirectional.symmetric(
                            horizontal: 7,
                            vertical: 4,
                          ),
                          child: Text(
                            formatAge(pet.ageMonths),
                            style: textTheme.labelSmall!.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text(
                  pet.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.titleLarge,
                ),
              ),
              Text(sexSymbol(pet.sex), style: textTheme.titleLarge),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            petDetail(pet),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: textTheme.labelMedium!.copyWith(
              fontWeight: FontWeight.w400,
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Bundled asset or remote URL, cropped to fill the card. Decoded at full
/// size on purpose: the card crops landscape photos to portrait, so a
/// width-based downscale would leave them blurry. Listings should ship
/// card-sized thumbnails once the API serves photos.
class PetPhoto extends StatelessWidget {
  const PetPhoto(this.source, {super.key, required this.label});

  final String source;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      label: label,
      child: ExcludeSemantics(
        child:
            source.startsWith('http')
                ? CachedNetworkImage(imageUrl: source, fit: BoxFit.cover)
                : Image.asset(source, fit: BoxFit.cover),
      ),
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({
    super.key,
    required this.name,
    required this.selected,
    required this.size,
    required this.iconSize,
    required this.onTap,
  });

  final String name;
  final bool selected;
  final double size;
  final double iconSize;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      selected: selected,
      label:
          selected ? 'Retirer $name des favoris' : 'Ajouter $name aux favoris',
      child: ExcludeSemantics(
        child: Material(
          color: selected ? colors.favorite : colors.glassMedium,
          shape: CircleBorder(side: BorderSide(color: colors.glassBorder)),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              width: size,
              height: size,
              child: Center(
                child: SvgPicture.asset(
                  'assets/icons/heart.svg',
                  width: iconSize,
                  height: iconSize,
                  colorFilter: ColorFilter.mode(
                    selected ? colors.onPrimary : colors.favorite,
                    BlendMode.srcIn,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
