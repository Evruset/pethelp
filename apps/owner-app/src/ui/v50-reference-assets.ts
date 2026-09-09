const V50_REFERENCE_COMMIT = 'd622a285b93c49761fdac3f28072f0aea012e992';

/**
 * Canonical visual assets from the immutable Owner V50 reference pack.
 *
 * These images provide visual context only. They must never be presented as
 * factual photos of a clinic, doctor or pet returned by the production API.
 */
export const v50ReferenceAssets = Object.freeze({
  ownerClinic: require('../../assets/v50-reference/banner-owner-clinic.webp'),
  vetExam: require('../../assets/v50-reference/banner-vet-exam.webp'),
  clinicDiagnostic: require('../../assets/v50-reference/clinic-diagnostic.png'),
  clinicExam: require('../../assets/v50-reference/clinic-exam.webp'),
  clinicFacade: require('../../assets/v50-reference/clinic-facade-premium.png'),
  clinicReception: require('../../assets/v50-reference/clinic-reception-premium.png'),
});

export { V50_REFERENCE_COMMIT };
