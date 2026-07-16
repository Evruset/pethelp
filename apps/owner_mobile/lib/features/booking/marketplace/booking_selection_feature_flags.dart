import '../../catalog/owner_catalog_v50_feature_flags.dart';
import '../../../presentation/shell/owner_shell_feature_flag.dart';

const ownerV50ServiceSelectionFlagName = 'OWNER_V50_SERVICE_SELECTION';
const ownerV50SlotSelectionFlagName = 'OWNER_V50_SLOT_SELECTION';
const ownerV50BookingReviewFlagName = 'OWNER_V50_BOOKING_REVIEW';
const ownerV50CreateHoldFlagName = 'OWNER_V50_CREATE_HOLD';
const ownerV50BookingStatusFlagName = 'OWNER_V50_BOOKING_STATUS';

class OwnerBookingSelectionV50Flags {
  const OwnerBookingSelectionV50Flags({
    required this.serviceSelection,
    required this.slotSelection,
    required this.bookingReview,
    required this.createHold,
    required this.bookingStatus,
  });

  final bool serviceSelection;
  final bool slotSelection;
  final bool bookingReview;
  final bool createHold;
  final bool bookingStatus;
}

OwnerBookingSelectionV50Flags ownerBookingSelectionV50Flags({
  required bool shellEnabled,
  required bool clinicDetailEnabled,
  String serviceValue =
      const String.fromEnvironment(ownerV50ServiceSelectionFlagName),
  String slotValue =
      const String.fromEnvironment(ownerV50SlotSelectionFlagName),
  String reviewValue =
      const String.fromEnvironment(ownerV50BookingReviewFlagName),
  String createHoldValue =
      const String.fromEnvironment(ownerV50CreateHoldFlagName),
  String bookingStatusValue =
      const String.fromEnvironment(ownerV50BookingStatusFlagName),
}) {
  final service = shellEnabled && clinicDetailEnabled && serviceValue == 'true';
  final slot = service && slotValue == 'true';
  final review = slot && reviewValue == 'true';
  final createHold = review && createHoldValue == 'true';
  return OwnerBookingSelectionV50Flags(
    serviceSelection: service,
    slotSelection: slot,
    bookingReview: review,
    createHold: createHold,
    bookingStatus: createHold && bookingStatusValue == 'true',
  );
}

bool isOwnerBookingSelectionV50Enabled() {
  final shellEnabled = isOwnerV50ShellEnabled();
  final catalog = ownerCatalogV50Flags(shellEnabled: shellEnabled);
  final flags = ownerBookingSelectionV50Flags(
    shellEnabled: shellEnabled,
    clinicDetailEnabled: catalog.clinicDetail,
  );
  return flags.serviceSelection && flags.slotSelection && flags.bookingReview;
}
