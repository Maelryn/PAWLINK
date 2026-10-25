import 'package:flutter/material.dart';

/// Temporary screen showing only its title, until the real one is built.
/// Set [closable] for screens pushed above the shell, which need a way back.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    super.key,
    required this.title,
    this.closable = false,
  });

  final String title;
  final bool closable;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:
          closable
              ? AppBar(leading: const CloseButton(), title: Text(title))
              : null,
      body: Center(
        child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
      ),
    );
  }
}
