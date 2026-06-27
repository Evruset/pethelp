import { Injectable } from '@nestjs/common';
import type { CoverageCheckState } from './insurance.service';

export type ProviderCoverageState = Exclude<
  CoverageCheckState,
  'CONSENT_REQUIRED' | 'REQUESTED' | 'PROCESSING'
>;

export interface InsuranceProviderPolicySummary {
  insurerCode: string;
  policyReferenceMasked: string;
  validFrom: string | null;
  validUntil: string | null;
  verificationState: string;
}

export interface InsuranceProviderCoverageRequest {
  coverageCheckId: string;
  ownerId: string;
  petId: string;
  partnerCode: string;
  consentVersion: string;
  policy: InsuranceProviderPolicySummary | null;
}

export interface InsuranceProviderCoverageResult {
  state: ProviderCoverageState;
  providerReference: string;
  checkedAt: Date;
  coverageValidUntil: Date | null;
  responseSummary: Record<string, unknown>;
}

export interface InsuranceClaimDraft {
  draftId: string;
  partnerCode: string;
  status: 'DRAFT' | 'MANUAL_REVIEW';
  requiredDocuments: string[];
  createdAt: string;
  expiresAt: string;
}

@Injectable()
export class InsuranceProviderAdapter {
  async validatePolicy(
    request: InsuranceProviderCoverageRequest,
  ): Promise<{ verificationState: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'EXPIRED'; providerDataMasked: Record<string, unknown> }> {
    const policy = request.policy;
    if (!policy) return { verificationState: 'PENDING', providerDataMasked: {} };
    if (isExpired(policy.validUntil)) {
      return {
        verificationState: 'EXPIRED',
        providerDataMasked: { policyReference: policy.policyReferenceMasked },
      };
    }
    return {
      verificationState: 'VERIFIED',
      providerDataMasked: { policyReference: policy.policyReferenceMasked },
    };
  }

  async checkCoverage(
    request: InsuranceProviderCoverageRequest,
  ): Promise<InsuranceProviderCoverageResult> {
    const checkedAt = new Date();
    const providerReference = `${request.partnerCode}-${request.coverageCheckId.slice(0, 8).toUpperCase()}`;
    const baseSummary = {
      checkedAt: checkedAt.toISOString(),
      consentVersion: request.consentVersion,
      wording: 'Preliminary provider status only. VetHelp does not decide claims or payouts.',
    };

    if (!request.policy) {
      return {
        state: 'MANUAL_REVIEW',
        providerReference,
        checkedAt,
        coverageValidUntil: null,
        responseSummary: {
          ...baseSummary,
          statusText: 'Policy data is required for partner review.',
          nextStep: 'Add policy data or wait for manual partner review.',
        },
      };
    }

    if (isExpired(request.policy.validUntil)) {
      return {
        state: 'NOT_COVERED',
        providerReference,
        checkedAt,
        coverageValidUntil: null,
        responseSummary: {
          ...baseSummary,
          statusText: 'Policy validity date has passed.',
          policyReference: request.policy.policyReferenceMasked,
        },
      };
    }

    if (request.partnerCode === 'DIRECT_BILLING') {
      return {
        state: 'MANUAL_REVIEW',
        providerReference,
        checkedAt,
        coverageValidUntil: null,
        responseSummary: {
          ...baseSummary,
          statusText: 'Direct billing requires manual clinic and partner review.',
          policyReference: request.policy.policyReferenceMasked,
        },
      };
    }

    return {
      state: 'COVERED',
      providerReference,
      checkedAt,
      coverageValidUntil: new Date(checkedAt.getTime() + 24 * 60 * 60 * 1000),
      responseSummary: {
        ...baseSummary,
        statusText: 'Partner returned a preliminary covered status for this pet.',
        policyReference: request.policy.policyReferenceMasked,
        coverageScope: 'Telemedicine and clinic booking review',
      },
    };
  }

  async createLead(
    request: InsuranceProviderCoverageRequest,
  ): Promise<{ leadId: string; status: 'APPROVED_LEAD' | 'MANUAL_REVIEW' }> {
    return {
      leadId: `LED-${request.coverageCheckId.slice(0, 8).toUpperCase()}`,
      status: request.policy ? 'APPROVED_LEAD' : 'MANUAL_REVIEW',
    };
  }

  async createClaimDraft(
    request: InsuranceProviderCoverageRequest,
    coverage: InsuranceProviderCoverageResult,
  ): Promise<InsuranceClaimDraft | null> {
    if (coverage.state !== 'COVERED') return null;
    const createdAt = coverage.checkedAt;
    return {
      draftId: `CLM-${request.coverageCheckId.slice(0, 8).toUpperCase()}`,
      partnerCode: request.partnerCode,
      status: 'DRAFT',
      requiredDocuments: [
        'Doctor recommendation',
        'Invoice or payment receipt',
        'Pet medical record excerpt',
      ],
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async getClaimStatus(draftId: string): Promise<{ draftId: string; status: 'DRAFT' | 'SUBMITTED' | 'PARTNER_REVIEW' }> {
    return { draftId, status: 'DRAFT' };
  }
}

function isExpired(value: string | null): boolean {
  if (!value) return false;
  const endOfDay = new Date(`${value}T23:59:59.999Z`);
  return Number.isFinite(endOfDay.getTime()) && endOfDay < new Date();
}
