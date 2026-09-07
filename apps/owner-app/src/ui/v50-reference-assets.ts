const V50_REFERENCE_COMMIT = 'd622a285b93c49761fdac3f28072f0aea012e992';
const V50_IMAGE_ROOT = `https://raw.githubusercontent.com/Evruset/pethelp/${V50_REFERENCE_COMMIT}/docs/ux/v50-reference/owner/assets/images`;

function image(name: string) {
  return { uri: `${V50_IMAGE_ROOT}/${name}` } as const;
}

/**
 * Canonical visual assets from the immutable Owner V50 reference pack.
 *
 * These images provide visual context only. They must never be presented as
 * factual photos of a clinic, doctor or pet returned by the production API.
 */
export const v50ReferenceAssets = Object.freeze({
  ownerClinic: image('banner-owner-clinic.webp'),
  clinicWalk: image('banner-clinic-walk.webp'),
  vetExam: image('banner-vet-exam.webp'),
  clinicDiagnostic: image('clinic-diagnostic.png'),
  clinicEquipment: image('clinic-equipment.webp'),
  clinicExam: image('clinic-exam.webp'),
  clinicFacade: image('clinic-facade-premium.png'),
  clinicReception: image('clinic-reception-premium.png'),
  clientEkaterina: image('client-ekaterina.webp'),
});

export { V50_REFERENCE_COMMIT };
