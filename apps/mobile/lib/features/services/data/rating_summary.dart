import 'service_models.dart';

/// Average and star histogram of a place (web `ratingOf` + the bars of
/// `/services/[id]`). A listing carries a historical average over
/// `reviewCount` reviews; the written reviews are blended into it.
class RatingSummary {
  const RatingSummary({
    required this.rating,
    required this.count,
    required this.shares,
  });

  factory RatingSummary.of(Service service, List<Review> reviews) {
    final count = service.reviewCount + reviews.length;
    final total =
        service.rating * service.reviewCount +
        reviews.fold<int>(0, (sum, r) => sum + r.rating);
    // The historical reviews are all counted at the rounded average.
    final historical = service.rating.round();
    return RatingSummary(
      rating: count == 0 ? 0 : (total / count * 10).round() / 10,
      count: count,
      shares: {
        for (var stars = 5; stars >= 1; stars--)
          stars:
              count == 0
                  ? 0
                  : (reviews.where((r) => r.rating == stars).length +
                          (stars == historical ? service.reviewCount : 0)) /
                      count,
      },
    );
  }

  /// One decimal, 0 when there is no review at all.
  final double rating;
  final int count;

  /// Fraction (0 to 1) of the reviews per star, keyed 5 down to 1.
  final Map<int, double> shares;
}
