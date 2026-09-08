const V50_REFERENCE_COMMIT = 'd622a285b93c49761fdac3f28072f0aea012e992';

/**
 * Canonical visual assets from the immutable Owner V50 reference pack.
 *
 * These images provide visual context only. They must never be presented as
 * factual photos of a clinic, doctor or pet returned by the production API.
 */
export const v50ReferenceAssets = Object.freeze({
  ownerClinic: require('../../assets/v50/owner/banner-owner-clinic.webp'),
  vetExam: require('../../assets/v50/owner/banner-vet-exam.webp'),
  clinicExam: require('../../assets/v50/owner/clinic-exam.webp'),
  clinicReception: require('../../assets/v50/owner/clinic-reception-premium.png'),
});

export const v50ReferenceAssetSemantics = Object.freeze({
  ownerClinic: Object.freeze({ screen: 'Home', role: 'hero atmosphere', factual: false, fallback: 'blue gradient surface' }),
  vetExam: Object.freeze({ screen: 'unused in production', role: 'canonical comparison only', factual: false, fallback: 'none' }),
  clinicExam: Object.freeze({ screen: 'Home', role: 'booking atmosphere', factual: false, fallback: 'blue action surface' }),
  clinicReception: Object.freeze({ screen: 'unused in production', role: 'canonical comparison only', factual: false, fallback: 'neutral missing-photo panel' }),
});

export { V50_REFERENCE_COMMIT };
