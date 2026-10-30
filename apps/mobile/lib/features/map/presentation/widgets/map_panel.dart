import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../cases/data/case_models.dart';
import '../../../cases/providers.dart';
import '../case_format.dart';
import 'case_photo.dart';

/// The glass panel under the header: search, emergency mode, status tabs and
/// the latest reports. While a case is selected it folds down to the search
/// and the tabs, so the map stays visible.
class MapPanel extends ConsumerStatefulWidget {
  const MapPanel({super.key, required this.onCaseTap});

  /// A row of the list was tapped.
  final ValueChanged<Case> onCaseTap;

  @override
  ConsumerState<MapPanel> createState() => _MapPanelState();
}

class _MapPanelState extends ConsumerState<MapPanel> {
  static const double _padding = 13;
  static const double _blur = 16;
  static const double _gap = 10;

  /// Under this height the list starts folded, so the panel leaves the map
  /// visible on a phone.
  static const double _compactHeight = 700;

  /// Null until the user toggles it: then it follows the screen height.
  bool? _listOpen;

  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final brightness = Theme.of(context).brightness;
    // The query can also be cleared from elsewhere (a new report opens the
    // map on its case): the field follows.
    ref.listen(mapQueryProvider, (previous, next) {
      if (_search.text != next) _search.text = next;
    });
    final collapsed = ref.watch(selectedCaseProvider) != null;
    final listOpen =
        _listOpen ?? MediaQuery.sizeOf(context).height >= _compactHeight;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: AppRadius.xxlAll,
        boxShadow: AppShadows.floating(brightness),
      ),
      child: ClipRRect(
        borderRadius: AppRadius.xxlAll,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: _blur, sigmaY: _blur),
          child: Container(
            padding: const EdgeInsets.all(_padding),
            decoration: BoxDecoration(
              color: colors.glassStrong,
              borderRadius: AppRadius.xxlAll,
              border: Border.all(color: colors.glassBorder),
            ),
            // Fits its content; scrolls only if the screen is too short for it.
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _SearchField(
                    controller: _search,
                    onChanged: ref.read(mapQueryProvider.notifier).set,
                  ),
                  _Collapsible(
                    open: !collapsed,
                    child: const Padding(
                      padding: EdgeInsetsDirectional.only(top: _gap),
                      child: _EmergencyRow(),
                    ),
                  ),
                  const SizedBox(height: _gap),
                  const _StatusTabs(),
                  _Collapsible(
                    open: !collapsed,
                    child: _ReportList(
                      open: listOpen,
                      onToggle: () => setState(() => _listOpen = !listOpen),
                      onCaseTap: widget.onCaseTap,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Animates a block in and out of the layout.
class _Collapsible extends StatelessWidget {
  const _Collapsible({required this.open, required this.child});

  final bool open;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 200),
      curve: Curves.ease,
      alignment: AlignmentDirectional.topStart,
      child: open ? child : const SizedBox(width: double.infinity),
    );
  }
}

/// Make `.map-search`: 48px, radius 18, tinted fill.
class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  static const double _height = 48;
  static const double _iconSize = 19;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      height: _height,
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.lgAll,
      ),
      child: Row(
        children: [
          SvgPicture.asset(
            'assets/icons/search.svg',
            width: _iconSize,
            height: _iconSize,
            colorFilter: ColorFilter.mode(colors.textTertiary, BlendMode.srcIn),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              textInputAction: TextInputAction.search,
              style: textTheme.bodyMedium!.copyWith(color: colors.textPrimary),
              cursorColor: colors.link,
              decoration: InputDecoration(
                hintText: 'Rechercher un lieu, un cas...',
                hintStyle: textTheme.bodyMedium!.copyWith(
                  color: colors.textMuted,
                ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isCollapsed: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "Mode urgence": on means only urgent cases are shown, which is the
/// "Urgent" tab. The line under the title counts urgent cases in the wilaya
/// that has the most.
class _EmergencyRow extends ConsumerWidget {
  const _EmergencyRow();

  static const double _illustrationSize = 39;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final on = ref.watch(mapStatusFilterProvider) == MapStatusFilter.urgent;
    final summary = ref.watch(emergencySummaryProvider);

    final subtitle = switch (summary) {
      null => 'Aucun cas urgent',
      EmergencySummary(:final wilaya, :final urgentCount) =>
        '${wilaya == null ? '' : '$wilaya · '}'
            '$urgentCount urgent${urgentCount > 1 ? 's' : ''}',
    };

    void toggle(bool value) => ref
        .read(mapStatusFilterProvider.notifier)
        .select(value ? MapStatusFilter.urgent : MapStatusFilter.all);

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colors.urgentContainer,
        borderRadius: AppRadius.lgAll,
      ),
      child: Row(
        children: [
          Image.asset(
            'assets/illustrations/fire.png',
            width: _illustrationSize,
            height: _illustrationSize,
            fit: BoxFit.contain,
            excludeFromSemantics: true,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Mode urgence',
                  style: textTheme.titleSmall!.copyWith(color: colors.urgent),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.labelSmall!.copyWith(
                    fontWeight: FontWeight.w400,
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 9),
          _Toggle(
            key: const ValueKey('map-emergency'),
            value: on,
            onChanged: toggle,
          ),
        ],
      ),
    );
  }
}

/// Make `.toggle`: 43x25 track, 19px thumb.
class _Toggle extends StatelessWidget {
  const _Toggle({super.key, required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  static const double _width = 43;
  static const double _height = 25;
  static const double _thumb = 19;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      toggled: value,
      label: 'Mode urgence',
      child: ExcludeSemantics(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onChanged(!value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: _width,
            height: _height,
            padding: const EdgeInsets.all(3),
            alignment:
                value
                    ? AlignmentDirectional.centerEnd
                    : AlignmentDirectional.centerStart,
            decoration: BoxDecoration(
              color: value ? colors.urgent : colors.outline,
              borderRadius: AppRadius.fullAll,
            ),
            child: Container(
              width: _thumb,
              height: _thumb,
              decoration: BoxDecoration(
                color: colors.surface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: colors.textPrimary.withValues(alpha: 0.13),
                    blurRadius: 5,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusTabs extends ConsumerWidget {
  const _StatusTabs();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(mapStatusFilterProvider);
    final notifier = ref.read(mapStatusFilterProvider.notifier);

    return Row(
      children: [
        for (final filter in MapStatusFilter.values) ...[
          if (filter != MapStatusFilter.values.first) const SizedBox(width: 6),
          _StatusTab(
            key: ValueKey('map-tab-${filter.name}'),
            filter: filter,
            active: filter == selected,
            onTap: () => notifier.select(filter),
          ),
        ],
      ],
    );
  }
}

class _StatusTab extends StatelessWidget {
  const _StatusTab({
    super.key,
    required this.filter,
    required this.active,
    required this.onTap,
  });

  final MapStatusFilter filter;
  final bool active;
  final VoidCallback onTap;

  static const double _height = 34;
  static const double _dot = 7;

  String get _label => switch (filter) {
    MapStatusFilter.all => 'Tous',
    MapStatusFilter.urgent => triageLabel(Triage.urgent),
    MapStatusFilter.monitoring => triageLabel(Triage.monitoring),
  };

  Color? _dotColor(AppColors colors) => switch (filter) {
    MapStatusFilter.all => null,
    MapStatusFilter.urgent => colors.urgent,
    MapStatusFilter.monitoring => colors.monitor,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final dot = _dotColor(colors);

    return Semantics(
      button: true,
      selected: active,
      label: _label,
      child: ExcludeSemantics(
        child: Material(
          color: active ? colors.inverse : colors.surface,
          borderRadius: AppRadius.fullAll,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              height: _height,
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(horizontal: 11),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (dot != null) ...[
                      Container(
                        width: _dot,
                        height: _dot,
                        decoration: BoxDecoration(
                          color: dot,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                    ],
                    Text(
                      _label,
                      maxLines: 1,
                      style: Theme.of(context).textTheme.labelSmall!.copyWith(
                        fontWeight: FontWeight.w400,
                        color: active ? colors.onInverse : colors.textPrimary,
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

/// "Derniers signalements" with the two latest visible cases (Make shows
/// two). Tapping the header folds the rows away.
class _ReportList extends ConsumerWidget {
  const _ReportList({
    required this.open,
    required this.onToggle,
    required this.onCaseTap,
  });

  final bool open;
  final VoidCallback onToggle;
  final ValueChanged<Case> onCaseTap;

  /// Rows shown under the header.
  static const int _maxRows = 2;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final cases = ref.watch(visibleCasesProvider);
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          expanded: open,
          label: 'Derniers signalements',
          child: ExcludeSemantics(
            child: InkWell(
              key: const ValueKey('map-list-toggle'),
              onTap: onToggle,
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(3, 17, 3, open ? 9 : 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Derniers signalements',
                        style: textTheme.titleLarge,
                      ),
                    ),
                    if (cases.value != null)
                      Text(
                        '${cases.value!.length} cas',
                        style: textTheme.labelSmall!.copyWith(
                          fontWeight: FontWeight.w400,
                          color: colors.textSecondary,
                        ),
                      ),
                    const SizedBox(width: AppSpacing.sm),
                    AnimatedRotation(
                      turns: open ? (rtl ? -0.25 : 0.25) : 0,
                      duration: const Duration(milliseconds: 200),
                      child: SvgPicture.asset(
                        'assets/icons/chevron.svg',
                        width: 18,
                        height: 18,
                        colorFilter: ColorFilter.mode(
                          colors.textSecondary,
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        _Collapsible(
          open: open,
          child: cases.when(
            data:
                (list) =>
                    list.isEmpty
                        ? Padding(
                          padding: const EdgeInsetsDirectional.symmetric(
                            vertical: AppSpacing.lg,
                          ),
                          child: Text(
                            'Aucun signalement trouvé.',
                            textAlign: TextAlign.center,
                            style: textTheme.bodySmall!.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        )
                        : Column(
                          children: [
                            for (final item in list.take(_maxRows))
                              _ReportRow(
                                key: ValueKey('map-row-${item.id}'),
                                item: item,
                                onTap: () => onCaseTap(item),
                              ),
                          ],
                        ),
            loading:
                () => const Padding(
                  padding: EdgeInsetsDirectional.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                ),
            error:
                (error, stack) => Padding(
                  padding: const EdgeInsetsDirectional.symmetric(vertical: 16),
                  child: Text(
                    'Impossible de charger les signalements.',
                    textAlign: TextAlign.center,
                    style: textTheme.bodySmall!.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ),
          ),
        ),
      ],
    );
  }
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({super.key, required this.item, required this.onTap});

  final Case item;
  final VoidCallback onTap;

  static const double _photo = 52;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textTheme = Theme.of(context).textTheme;
    final color = triageColor(colors, item.triage);

    return Semantics(
      button: true,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: 3,
            vertical: 8,
          ),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: colors.divider)),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: SizedBox(
                  width: _photo,
                  height: _photo,
                  child: CasePhoto(src: item.photos.firstOrNull),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '● ${triageLabel(item.triage)}',
                      style: textTheme.labelSmall!.copyWith(
                        fontWeight: FontWeight.w800,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.titleSmall!.copyWith(fontSize: 12),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      caseSubtitle(item),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelSmall!.copyWith(
                        fontWeight: FontWeight.w400,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
