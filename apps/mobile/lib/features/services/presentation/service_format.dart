import 'package:flutter/material.dart';

import '../../adopt/presentation/adopt_format.dart' show formatDate;
import '../data/service_models.dart';

const _weekdays = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

/// "mar. 28 oct. 2026" from a stored `yyyy-MM-dd`.
String formatBookingDay(String isoDate) {
  final d = DateTime.parse(isoDate);
  return '${_weekdays[d.weekday - 1]} ${formatDate(d)}';
}

/// "09:05" from the time picker.
String formatClock(TimeOfDay t) =>
    '${t.hour.toString().padLeft(2, '0')}:'
    '${t.minute.toString().padLeft(2, '0')}';

String reviewCountLabel(int n) => '$n avis';

/// "il y a 3 j", falling back to the date after a month.
String timeAgo(DateTime when, {DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(when);
  if (diff.inMinutes < 1) return "à l'instant";
  if (diff.inMinutes < 60) return 'il y a ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'il y a ${diff.inHours} h';
  if (diff.inDays < 30) return 'il y a ${diff.inDays} j';
  return formatDate(when);
}

/// Status of the viewer's appointment request (web `market.status`, with the
/// clinic as the one who answers).
String bookingStatusLabel(BookingStatus status) => switch (status) {
  BookingStatus.sent => 'En attente de confirmation',
  BookingStatus.confirmed => 'Confirmé',
  BookingStatus.declined => 'Indisponible, choisissez un autre créneau',
  BookingStatus.cancelled => 'Rendez-vous annulé',
};
