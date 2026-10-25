import 'service_models.dart';

abstract interface class ServiceRepository {
  /// Approved listings. Order is the repository's; the screen sorts Pro first.
  /// API: GET /services
  Future<List<Service>> services();

  /// API: GET /services/:id
  Future<Service?> service(String id);

  /// Written reviews of a place, newest first.
  /// API: GET /services/:id/reviews
  Future<List<Review>> reviews(String serviceId);

  /// Publishes the viewer's review; a new one replaces the previous. The
  /// owner of a place cannot review it.
  /// API: PUT /services/:id/reviews/mine
  Future<Review> saveReview({
    required String serviceId,
    required int rating,
    required String text,
  });

  /// The viewer's latest appointment request for this place, whatever its
  /// state. Null when there is none, or when a sent/confirmed one is already
  /// past (the viewer can ask again).
  /// API: GET /services/:id/bookings/mine
  Future<Booking?> myBooking(String serviceId);

  /// Appointment request to a Pro place. [date] is `yyyy-MM-dd`, [time] is
  /// `HH:mm`; both must be in the future.
  /// API: POST /services/:id/bookings
  Future<Booking> sendBooking({
    required String serviceId,
    required String date,
    required String time,
    required String animal,
    required String reason,
  });

  /// The client withdraws a sent or confirmed request.
  /// API: POST /bookings/:id/cancel
  Future<void> cancelBooking(String bookingId);
}
