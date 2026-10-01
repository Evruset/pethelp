import { Injectable } from '@nestjs/common';
import { DomainErrors } from '../common/domain-error';

export type BookingContractProfile = 'MVP_V1_MANUAL' | 'V15_AUTO_CONFIRM';
export interface BookingPolicy {
  readonly contractProfile: BookingContractProfile;
  readonly confirmationMode: 'MANUAL_REQUEST' | 'AUTO_CONFIRM_PUBLISHED_SLOT';
}

@Injectable()
export class BookingPolicyResolver {
  resolve(input: { contractProfile: string | null | undefined; clinicStatus: string; locationStatus: string }): BookingPolicy {
    if (input.clinicStatus !== 'ACTIVE' || input.locationStatus !== 'ACTIVE') throw DomainErrors.slotUnavailable();
    if (input.contractProfile === 'MVP_V1_MANUAL') {
      return Object.freeze({ contractProfile: 'MVP_V1_MANUAL', confirmationMode: 'MANUAL_REQUEST' });
    }
    if (input.contractProfile === 'V15_AUTO_CONFIRM') {
      return Object.freeze({ contractProfile: 'V15_AUTO_CONFIRM', confirmationMode: 'AUTO_CONFIRM_PUBLISHED_SLOT' });
    }
    throw DomainErrors.bookingUnavailable();
  }
}
