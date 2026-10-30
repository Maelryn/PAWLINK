import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Five stars, [value] of them filled (rounded).
class ServiceStars extends StatelessWidget {
  const ServiceStars({super.key, required this.value, this.size = 14});

  final double value;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final filled = value.round();

    return Semantics(
      label: '${value.toStringAsFixed(1)} sur 5',
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 1; i <= 5; i++)
              Text(
                '★',
                style: TextStyle(
                  fontSize: size,
                  height: 1.1,
                  color: i <= filled ? colors.rating : colors.outline,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Tap target row to pick 1 to 5 stars (web `ReviewForm`).
class StarRatingInput extends StatelessWidget {
  const StarRatingInput({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final int value;
  final ValueChanged<int> onChanged;

  static const double _width = 36;
  static const double _height = 44;
  static const double _glyph = 26;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 1; i <= 5; i++)
          Semantics(
            button: true,
            selected: i == value,
            label: '$i sur 5',
            child: ExcludeSemantics(
              child: InkResponse(
                key: ValueKey('review-star-$i'),
                onTap: () => onChanged(i),
                radius: _width / 2,
                child: SizedBox(
                  width: _width,
                  height: _height,
                  child: Center(
                    child: Text(
                      '★',
                      style: TextStyle(
                        fontSize: _glyph,
                        height: 1,
                        color: i <= value ? colors.rating : colors.outline,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
