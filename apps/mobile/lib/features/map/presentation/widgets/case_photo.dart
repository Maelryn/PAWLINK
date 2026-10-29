import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/brand_header.dart';

/// A case photo: a bundled asset (demo data) or a URL (API), covering its
/// box. Falls back to the brand icon when there is none or it fails to load.
class CasePhoto extends StatelessWidget {
  const CasePhoto({super.key, required this.src});

  final String? src;

  @override
  Widget build(BuildContext context) {
    final path = src;
    if (path == null || path.isEmpty) return _Placeholder();

    if (path.startsWith('http')) {
      return CachedNetworkImage(
        imageUrl: path,
        fit: BoxFit.cover,
        placeholder: (context, url) => _Placeholder(),
        errorWidget: (context, url, error) => _Placeholder(),
      );
    }
    // A photo taken in the report flow is a file on the phone.
    if (!path.startsWith('assets/')) {
      return Image.file(
        File(path),
        fit: BoxFit.cover,
        excludeFromSemantics: true,
        errorBuilder: (context, error, stack) => _Placeholder(),
      );
    }
    return Image.asset(
      path,
      fit: BoxFit.cover,
      excludeFromSemantics: true,
      errorBuilder: (context, error, stack) => _Placeholder(),
    );
  }
}

class _Placeholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.colors.surfaceMuted,
      child: Center(
        child: SvgPicture.asset(brandIconAsset(context), width: 24, height: 24),
      ),
    );
  }
}
