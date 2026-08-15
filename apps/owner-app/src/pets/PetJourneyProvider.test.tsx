import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SessionProvider } from '@/session/SessionProvider';
import type { SessionStore } from '@/session/secure-session-store';
import type { SessionAuthority } from '@/session/session-authority';
import { PetJourneyProvider, continuedPetForScope, usePetJourney } from './PetJourneyProvider';
import type { PetApi } from './pet-api';

const A={opaqueCredential:'vh_a',cacheScope:'11111111-1111-4111-8111-111111111111',expiresAtEpochMs:Date.now()+60000};
const ONE={petId:'22222222-2222-4222-8222-222222222222',name:'Ася',species:'CAT' as const,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};
const store:SessionStore={read:async()=>A,write:async()=>undefined,clear:async()=>undefined};
const authority:SessionAuthority={validate:async()=>({subjectId:A.cacheScope,roles:['OWNER']}),revoke:async()=>undefined};

function Probe(){const p=usePetJourney();return <><Text>{`active:${p.active}`}</Text><Text>{`selected:${p.selectedPetId}`}</Text><Text>{`stale:${p.selectionStale}`}</Text><Text>{`continued:${p.continuedPetId}`}</Text><Pressable onPress={p.start}><Text>start</Text></Pressable><Pressable onPress={p.cancel}><Text>cancel</Text></Pressable><Pressable onPress={p.continueSelection}><Text>continue</Text></Pressable><Pressable onPress={()=>{void p.create({name:'Мурка',species:'CAT'}).catch(()=>undefined)}}><Text>create</Text></Pressable><Pressable onPress={p.retry}><Text>retry</Text></Pressable></>}
async function setup(api:jest.Mocked<PetApi>){const view=await render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><SessionProvider store={store} authority={authority}><PetJourneyProvider api={api}><Probe /></PetJourneyProvider></SessionProvider></QueryClientProvider>);await waitFor(()=>expect(view.getByText('start')).toBeTruthy());return view;}

it('auto-selects one pet, continues with exactly that id, and fresh start/cancel clear journey state',async()=>{const api={list:jest.fn().mockResolvedValue([ONE]),create:jest.fn()} as jest.Mocked<PetApi>;const view=await setup(api);await act(async()=>fireEvent.press(view.getByText('start')));await waitFor(()=>expect(view.getByText(`selected:${ONE.petId}`)).toBeTruthy());await act(async()=>fireEvent.press(view.getByText('continue')));expect(view.getByText(`continued:${ONE.petId}`)).toBeTruthy();await act(async()=>fireEvent.press(view.getByText('start')));expect(view.getByText('continued:null')).toBeTruthy();await act(async()=>fireEvent.press(view.getByText('cancel')));expect(view.getByText('active:false')).toBeTruthy();});

it('auto-selects authoritative create and reuses one key after ambiguous retry',async()=>{let attempts=0;const api={list:jest.fn().mockResolvedValue([]),create:jest.fn().mockImplementation(async()=>{attempts+=1;if(attempts===1)throw new Error('network');return ONE;})} as jest.Mocked<PetApi>;const view=await setup(api);await waitFor(()=>expect(view.getByText('active:false')).toBeTruthy());await act(async()=>fireEvent.press(view.getByText('start')));await waitFor(()=>expect(view.getByText('active:true')).toBeTruthy());await act(async()=>fireEvent.press(view.getByText('create')));await waitFor(()=>expect(api.create).toHaveBeenCalledTimes(1));await waitFor(()=>expect(view.getByText('selected:null')).toBeTruthy());await act(async()=>fireEvent.press(view.getByText('create')));await waitFor(()=>expect(view.getByText(`selected:${ONE.petId}`)).toBeTruthy());expect(api.create).toHaveBeenCalledTimes(2);expect(api.create.mock.calls[0][2]).toBe(api.create.mock.calls[1][2]);});

it('marks a disappeared selected pet stale after authoritative refresh',async()=>{const api={list:jest.fn().mockResolvedValueOnce([ONE]).mockResolvedValueOnce([]),create:jest.fn()} as jest.Mocked<PetApi>;const view=await setup(api);await act(async()=>fireEvent.press(view.getByText('start')));await waitFor(()=>expect(view.getByText(`selected:${ONE.petId}`)).toBeTruthy());await act(async()=>fireEvent.press(view.getByText('retry')));await waitFor(()=>expect(view.getByText('stale:true')).toBeTruthy());expect(view.getByText('selected:null')).toBeTruthy();});

it('never exposes Owner A continuation after logout or authority change',()=>{const selected={scope:A.cacheScope,petId:ONE.petId};expect(continuedPetForScope(selected,'authenticated',A.cacheScope)).toBe(ONE.petId);expect(continuedPetForScope(selected,'public',A.cacheScope)).toBeNull();expect(continuedPetForScope(selected,'authenticated','33333333-3333-4333-8333-333333333333')).toBeNull();});
