// Services types, mirroring `apps/web/lib/types.ts` (Service, Review, Booking)
// so the API can be plugged in later without touching the screens.

import '../../adopt/data/adoption_models.dart' show GeoPoint, UserLite;

enum ServiceType { vet, shelter, transport, boarding, training, store }

/// A listed business: vet clinic, shelter, shop, transport...
class Service {
  const Service({
    required this.id,
    required this.type,
    required this.name,
    required this.location,
    required this.rating,
    required this.reviewCount,
    this.phone,
    this.openNow,
    this.photo,
    this.tags = const [],
    this.description,
    this.hours,
    this.ownerId,
    this.verified = false,
    this.pro = false,
  });

  final String id;
  final ServiceType type;
  final String name;

  /// `location.address` holds the city, as in the web seed.
  final GeoPoint location;
  final String? phone;
  final bool? openNow;
  final double rating;
  final int reviewCount;
  final String? photo;
  final List<String> tags;
  final String? description;
  final String? hours;
  final String? ownerId;

  /// Checked by an admin (license / registration).
  final bool verified;

  /// Pro subscribers: featured first + online appointments.
  final bool pro;

  String get city => location.address ?? '';
}

class Review {
  const Review({
    required this.id,
    required this.serviceId,
    required this.author,
    required this.rating,
    required this.text,
    required this.createdAt,
    this.reply,
  });

  final String id;
  final String serviceId;
  final UserLite author;

  /// 1 to 5.
  final int rating;
  final String text;
  final DateTime createdAt;

  /// Answer from the business (Pro feature).
  final String? reply;
}

enum BookingStatus { sent, confirmed, declined, cancelled }

/// An appointment request to a Pro business. No payment involved.
class Booking {
  const Booking({
    required this.id,
    required this.serviceId,
    required this.from,
    required this.date,
    required this.time,
    required this.animal,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String serviceId;
  final UserLite from;

  /// As the web stores them: `yyyy-MM-dd` and `HH:mm`.
  final String date;
  final String time;
  final String animal;
  final String reason;
  final BookingStatus status;
  final DateTime createdAt;
}
