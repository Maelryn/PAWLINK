// The part of the web's anti-abuse preview (`apps/web/lib/trust.ts`) that can
// be checked on the phone. The photo checks (EXIF position and date, duplicate,
// "is there an animal?") need the backend, so they are left out rather than
// guessed. The backend must redo all of it.

import '../../cases/data/case_models.dart';
import 'report_models.dart';

/// Reports one person may send per hour (web: 5).
const int maxReportsPerHour = 5;

Trust computeReportTrust({
  required ReportPosition position,
  required bool inAlgeria,
  required int recentReports,
}) {
  final checks = [
    TrustCheck(id: TrustCheckId.inAlgeria, ok: inAlgeria),
    // The shortcut position never counts as on site.
    TrustCheck(id: TrustCheckId.onSite, ok: !position.isDemo),
    TrustCheck(
      id: TrustCheckId.rateLimit,
      ok: recentReports < maxReportsPerHour,
    ),
  ];
  final passed = checks.where((c) => c.ok == true).length;
  final score = (passed / checks.length * 100).round();
  final hardFail = checks.any(
    (c) =>
        c.ok == false &&
        (c.id == TrustCheckId.inAlgeria || c.id == TrustCheckId.rateLimit),
  );
  // "Verified" needs a verified phone, and there is no account yet.
  final level =
      hardFail || score < 50 ? TrustLevel.suspicious : TrustLevel.unverified;
  return Trust(level: level, score: score, checks: checks);
}
