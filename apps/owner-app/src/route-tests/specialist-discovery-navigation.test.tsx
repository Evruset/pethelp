import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AuthenticatedHomeScreen from '../app/(app)/index';
const mockReadActive=jest.fn().mockResolvedValue(null);
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'11111111-1111-4111-8111-111111111111',opaqueCredential:'credential-a'},error:null,logout:jest.fn()})}));
jest.mock('@/auth/AuthJourneyProvider',()=>({useAuthJourney:()=>({resumedIntent:null,consumeResumedIntent:jest.fn()})}));
jest.mock('@/pets/PetJourneyProvider',()=>({usePetJourney:()=>({active:false,continuedPetId:'77777777-7777-4777-8777-777777777777',start:jest.fn(),cancel:jest.fn()})}));
jest.mock('@/booking/active-booking-store',()=>({activeBookingStore:{read:(...args:unknown[])=>mockReadActive(...args)}}));
jest.mock('@/booking/BookingStatusScreen',()=>({BookingStatusScreen:()=>null}));
jest.mock('@/booking/BookingReviewScreen',()=>({BookingReviewScreen:()=>null}));
jest.mock('@/pets/PetJourneyScreen',()=>({PetJourneyScreen:()=>null}));
jest.mock('@/clinics/ClinicServiceScreen',()=>{const React=jest.requireActual('react');const{Text}=jest.requireActual('react-native');return{ClinicServiceScreen:({clinic,preferredServiceId}:{clinic:{clinicId:string;locationId:string};preferredServiceId?:string})=>React.createElement(Text,null,`service:${clinic.clinicId}:${clinic.locationId}:${preferredServiceId}`)};});
jest.mock('@/clinics/AvailabilityScreen',()=>({AvailabilityScreen:()=>null}));
jest.mock('@/discovery/SpecialistDiscoveryScreen',()=>{const React=jest.requireActual('react');const{Pressable,Text}=jest.requireActual('react-native');return{SpecialistDiscoveryScreen:({onContinue}:{onContinue(value:unknown):void})=>React.createElement(Pressable,{accessibilityRole:'button',onPress:()=>onContinue({specialtyId:'11111111-1111-4111-8111-111111111111',doctorId:'22222222-2222-4222-8222-222222222222',serviceId:'33333333-3333-4333-8333-333333333333',clinicId:'44444444-4444-4444-8444-444444444444',locationId:'55555555-5555-4555-8555-555555555555',slotId:'66666666-6666-4666-8666-666666666666',expectedSlotVersion:3})},React.createElement(Text,null,'choose-specialist'))};});

it('preserves specialist clinic/location/service identities into the existing service journey',async()=>{const view=await render(<AuthenticatedHomeScreen/>);await waitFor(()=>expect(view.getByText('choose-specialist')).toBeTruthy());await act(async()=>fireEvent.press(view.getByText('choose-specialist')));await waitFor(()=>expect(view.getByText('service:44444444-4444-4444-8444-444444444444:55555555-5555-4555-8555-555555555555:33333333-3333-4333-8333-333333333333')).toBeTruthy());});
