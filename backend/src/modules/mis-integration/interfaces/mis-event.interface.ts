export interface MisReservationRequestedPayload {
  holdId: string;
  slotId: string;
  clinicId: string;
  externalPatientId: string;
  correlationId?: string;
}
