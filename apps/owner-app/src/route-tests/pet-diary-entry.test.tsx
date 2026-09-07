import { fireEvent, render } from '@testing-library/react-native';
import AuthenticatedHomeScreen from '../app/(app)/index';

const PET_ID='11111111-1111-4111-8111-111111111111';
const mockStart=jest.fn();
const mockCancel=jest.fn();
const mockUsePetJourney=jest.fn();

jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'owner-a',opaqueCredential:'credential-a'},error:null,logout:jest.fn()})}));
jest.mock('@/auth/AuthJourneyProvider',()=>({useAuthJourney:()=>({resumedIntent:null,consumeResumedIntent:jest.fn()})}));
jest.mock('@/pets/PetJourneyProvider',()=>({usePetJourney:()=>mockUsePetJourney()}));
jest.mock('@/booking/active-booking-store',()=>({activeBookingStore:{read:jest.fn().mockResolvedValue(null)}}));
jest.mock('@/booking/BookingStatusScreen',()=>({BookingStatusScreen:()=>null}));
jest.mock('@/booking/BookingReviewScreen',()=>({BookingReviewScreen:()=>null}));
jest.mock('@/pets/PetJourneyScreen',()=>({PetJourneyScreen:()=>null}));
jest.mock('@/pets/PetDiaryScreen',()=>{const React=jest.requireActual('react');const{Text}=jest.requireActual('react-native');return{PetDiaryScreen:({petId}:{petId:string})=>React.createElement(Text,null,`diary:${petId}`)};});
jest.mock('@/clinics/ClinicServiceScreen',()=>({ClinicServiceScreen:()=>null}));
jest.mock('@/clinics/AvailabilityScreen',()=>({AvailabilityScreen:()=>null}));
jest.mock('@/discovery/SpecialistDiscoveryScreen',()=>({SpecialistDiscoveryScreen:()=>null}));

it('opens the selected pet diary from the Pet experience',async()=>{
  mockUsePetJourney.mockReturnValue({active:false,continuedPetId:null,pets:[],start:mockStart,cancel:mockCancel});
  const view=await render(<AuthenticatedHomeScreen/>);
  fireEvent.press(view.getByText('Открыть дневник'));
  expect(mockStart).toHaveBeenCalledTimes(1);
  mockUsePetJourney.mockReturnValue({active:false,continuedPetId:PET_ID,pets:[{petId:PET_ID,name:'Рекс'}],start:mockStart,cancel:mockCancel});
  await view.rerender(<AuthenticatedHomeScreen/>);
  expect(view.getByText(`diary:${PET_ID}`)).toBeTruthy();
});
