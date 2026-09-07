import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AuthenticatedHomeScreen from '../app/(app)/index';

const mockReadActive=jest.fn();
const mockCancel=jest.fn();
const mockStart=jest.fn();
const mockUsePetJourney=jest.fn();
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'11111111-1111-4111-8111-111111111111',opaqueCredential:'credential-a'},error:null,logout:jest.fn()})}));
jest.mock('@/auth/AuthJourneyProvider',()=>({useAuthJourney:()=>({resumedIntent:null,consumeResumedIntent:jest.fn()})}));
jest.mock('@/pets/PetJourneyProvider',()=>({usePetJourney:()=>mockUsePetJourney()}));
jest.mock('@/booking/active-booking-store',()=>({activeBookingStore:{read:(...args:unknown[])=>mockReadActive(...args)}}));
jest.mock('@/booking/BookingStatusScreen',()=>{const React=jest.requireActual('react');const{Text}=jest.requireActual('react-native');return{BookingStatusScreen:({holdId}:{holdId:string})=>React.createElement(Text,null,`status:${holdId}`)};});
jest.mock('@/booking/BookingReviewScreen',()=>({BookingReviewScreen:()=>null}));
jest.mock('@/pets/PetJourneyScreen',()=>({PetJourneyScreen:()=>null}));
jest.mock('@/pets/PetDiaryScreen',()=>{const React=jest.requireActual('react');const{Text}=jest.requireActual('react-native');return{PetDiaryScreen:({petId}:{petId:string})=>React.createElement(Text,null,`diary:${petId}`)};});
jest.mock('@/clinics/ClinicCatalogScreen',()=>({ClinicCatalogScreen:()=>null}));
jest.mock('@/clinics/ClinicServiceScreen',()=>{const React=jest.requireActual('react');const{Text}=jest.requireActual('react-native');return{ClinicServiceScreen:({clinic,preferredServiceId}:{clinic:{clinicId:string;locationId:string};preferredServiceId?:string})=>React.createElement(Text,null,`service:${clinic.clinicId}:${clinic.locationId}:${preferredServiceId}`)};});
jest.mock('@/clinics/AvailabilityScreen',()=>({AvailabilityScreen:()=>null}));
jest.mock('@/discovery/SpecialistDiscoveryScreen',()=>{const React=jest.requireActual('react');const{Pressable,Text}=jest.requireActual('react-native');return{SpecialistDiscoveryScreen:({onContinue}:{onContinue(value:unknown):void})=>React.createElement(Pressable,{accessibilityRole:'button',onPress:()=>onContinue({specialtyId:'11111111-1111-4111-8111-111111111111',doctorId:'22222222-2222-4222-8222-222222222222',serviceId:'33333333-3333-4333-8333-333333333333',clinicId:'44444444-4444-4444-8444-444444444444',locationId:'55555555-5555-4555-8555-555555555555',slotId:'66666666-6666-4666-8666-666666666666',expectedSlotVersion:3})},React.createElement(Text,null,'choose-specialist'))};});

describe('authenticated home booking re-entry',()=>{
  beforeEach(()=>{mockReadActive.mockReset();mockReadActive.mockResolvedValue(null);mockCancel.mockReset();mockStart.mockReset();mockUsePetJourney.mockReturnValue({active:false,continuedPetId:null,pets:[],start:mockStart,cancel:mockCancel});});
  it('opens the durable owner-scoped booking reference through authoritative status readback',async()=>{const holdId='66666666-6666-4666-8666-666666666666';mockReadActive.mockResolvedValue(holdId);const view=await render(<AuthenticatedHomeScreen/>);await waitFor(()=>expect(view.getByText(`status:${holdId}`)).toBeTruthy());expect(mockReadActive).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');});
  it('does not interrupt a newly started journey with a late stored-booking read',async()=>{let resolve!:(value:string)=>void;mockReadActive.mockReturnValue(new Promise(value=>{resolve=value;}));const view=await render(<AuthenticatedHomeScreen/>);fireEvent.press(view.getByText('Начать запись'));expect(mockStart).toHaveBeenCalledTimes(1);await act(async()=>{resolve('66666666-6666-4666-8666-666666666666');});expect(view.queryByText('status:66666666-6666-4666-8666-666666666666')).toBeNull();});
});
