class AlternativeSlotV50FeatureFlags {
  const AlternativeSlotV50FeatureFlags._();
  static const shell = bool.fromEnvironment('VETHELP_OWNER_V50_SHELL');
  static const bookings = bool.fromEnvironment('OWNER_V50_MY_BOOKINGS');
  static const details = bool.fromEnvironment('OWNER_V50_BOOKING_DETAIL');
  static const resolution =
      bool.fromEnvironment('OWNER_V50_ALTERNATIVE_RESOLUTION');
  static bool get enabled => shell && bookings && details && resolution;
}
