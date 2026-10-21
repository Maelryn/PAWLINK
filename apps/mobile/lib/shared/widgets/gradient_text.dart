import 'package:flutter/material.dart';

/// Text painted with a [gradient] (the brand gradient for the wordmark and the
/// hero title). The style's own color is ignored.
class GradientText extends StatelessWidget {
  const GradientText(
    this.text, {
    super.key,
    required this.gradient,
    required this.style,
    this.textAlign,
  });

  final String text;
  final Gradient gradient;
  final TextStyle style;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    final direction = Directionality.of(context);

    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: (bounds) =>
          gradient.createShader(bounds, textDirection: direction),
      child: Text(
        text,
        textAlign: textAlign,
        // Any opaque color: the mask replaces it.
        style: style.copyWith(color: Colors.white),
      ),
    );
  }
}
