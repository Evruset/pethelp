import { IsUrl } from 'class-validator';

export class SubmitEmergencyReviewDto {
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['https', 'http'] })
  evidenceUrl!: string;
}
