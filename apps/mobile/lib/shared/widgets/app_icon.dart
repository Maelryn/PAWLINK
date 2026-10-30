import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// An icon from `assets/icons/` (stroke `currentColor`), tinted with [color].
class AppIcon extends StatelessWidget {
  const AppIcon(
    this.asset, {
    super.key,
    required this.size,
    required this.color,
    this.matchTextDirection = false,
  });

  final String asset;
  final double size;
  final Color color;

  /// Mirror it in right-to-left (arrows and chevrons).
  final bool matchTextDirection;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      asset,
      width: size,
      height: size,
      matchTextDirection: matchTextDirection,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    );
  }
}
