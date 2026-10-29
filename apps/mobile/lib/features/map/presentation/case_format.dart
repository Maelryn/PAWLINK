import 'package:flutter/painting.dart';

import '../../../core/theme/app_colors.dart';
import '../../adopt/data/adoption_models.dart' show Species;
import '../../cases/data/case_models.dart';

/// Pin, label and dot color of a triage level.
Color triageColor(AppColors colors, Triage triage) => switch (triage) {
  Triage.urgent => colors.urgent,
  Triage.monitoring => colors.monitor,
  Triage.stable => colors.success,
};

String triageLabel(Triage triage) => switch (triage) {
  Triage.urgent => 'Urgent',
  Triage.monitoring => 'À surveiller',
  Triage.stable => 'Stable',
};

String speciesLabel(Species species) => switch (species) {
  Species.dog => 'Chien',
  Species.cat => 'Chat',
  Species.bird => 'Oiseau',
  Species.horse => 'Cheval',
  Species.cow => 'Vache',
  Species.sheep => 'Mouton',
  Species.goat => 'Chèvre',
  Species.camel => 'Chameau',
  Species.donkey => 'Âne',
  Species.rabbit => 'Lapin',
  Species.chicken => 'Poule',
  Species.other => 'Autre',
};

/// "il y a 11 min", "il y a 3 h", "il y a 2 j".
String timeAgo(DateTime date, {DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(date);
  if (diff.inMinutes < 1) return "à l'instant";
  if (diff.inMinutes < 60) return 'il y a ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'il y a ${diff.inHours} h';
  return 'il y a ${diff.inDays} j';
}

/// "Larbaâ Nath Irathen · il y a 11 min".
String caseSubtitle(Case c) {
  final where = c.place ?? c.wilaya;
  final ago = timeAgo(c.createdAt);
  return where == null ? ago : '$where · $ago';
}

/// The most urgent level among [cases] (urgent comes first in the enum).
Triage mostUrgent(Iterable<Case> cases) =>
    cases.map((c) => c.triage).reduce((a, b) => a.index <= b.index ? a : b);
