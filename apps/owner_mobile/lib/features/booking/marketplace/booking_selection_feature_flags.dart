import '../../catalog/owner_catalog_v50_feature_flags.dart';
import '../../../presentation/shell/owner_shell_feature_flag.dart';

const ownerV50ServiceSelectionFlagName = 'OWNER_V50_SERVICE_SELECTION';
const ownerV50SlotSelectionFlagName = 'OWNER_V50_SLOT_SELECTION';
const ownerV50BookingReviewFlagName = 'OWNER_V50_BOOKING_REVIEW';

class OwnerBookingSelectionV50Flags {
  const OwnerBookingSelectionV50Flags({
    required this.serviceSelection,
    required this.slotSelection,
    required this.bookingReview,
  });

  final bool serviceSelection;
  final bool slotSelection;
  final bool bookingReview;
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
}) {
  final service = shellEnabled && clinicDetailEnabled && serviceValue == 'true';
  final slot = service && slotValue == 'true';
  return OwnerBookingSelectionV50Flags(
    serviceSelection: service,
    slotSelection: slot,
    bookingReview: slot && reviewValue == 'true',
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
