import '../../../presentation/shell/owner_shell_feature_flag.dart';

const ownerV50MyBookingsFlagName = 'OWNER_V50_MY_BOOKINGS';
const ownerV50BookingDetailFlagName = 'OWNER_V50_BOOKING_DETAIL';
const ownerV50BookingCancellationFlagName = 'OWNER_V50_BOOKING_CANCELLATION';

class OwnerBookingsV50Flags {
  const OwnerBookingsV50Flags(
      {required this.myBookings,
      required this.detail,
      required this.cancellation});
  final bool myBookings;
  final bool detail;
  final bool cancellation;
}

OwnerBookingsV50Flags ownerBookingsV50Flags({
  required bool shellEnabled,
  String myBookingsValue =
      const String.fromEnvironment(ownerV50MyBookingsFlagName),
  String detailValue =
      const String.fromEnvironment(ownerV50BookingDetailFlagName),
  String cancellationValue =
      const String.fromEnvironment(ownerV50BookingCancellationFlagName),
}) {
  final list = shellEnabled && myBookingsValue == 'true';
  final detail = list && detailValue == 'true';
  return OwnerBookingsV50Flags(
    myBookings: list,
    detail: detail,
    cancellation: detail && cancellationValue == 'true',
  );
}

OwnerBookingsV50Flags resolvedOwnerBookingsV50Flags() =>
    ownerBookingsV50Flags(shellEnabled: isOwnerV50ShellEnabled());
