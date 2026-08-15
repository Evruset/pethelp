import { BadRequestException } from '@nestjs/common';
import { OwnerPetMvpController } from './owner-pet-mvp.controller';
import { ownerPetCreateFingerprint, type OwnerPetService } from './owner-pet.service';
import { Role } from './auth.types';

const owner={sub:'11111111-1111-4111-8111-111111111111',roles:[Role.OWNER]};
it('returns the closed invalid-species contract before service execution',()=>{const pets={createMvp:jest.fn()} as unknown as OwnerPetService;const controller=new OwnerPetMvpController(pets);try{controller.create(owner,{name:'Ася',species:'PARROT'},'22222222-2222-4222-8222-222222222222');throw new Error('expected rejection');}catch(error){expect(error).toMatchObject({response:{code:'INVALID_PET_SPECIES'}});}expect(pets.createMvp).not.toHaveBeenCalled();});
it('rejects mature fields with safe 400',()=>{const pets={createMvp:jest.fn()} as unknown as OwnerPetService;const controller=new OwnerPetMvpController(pets);expect(()=>controller.create(owner,{name:'Ася',species:'CAT',breed:'x'},'22222222-2222-4222-8222-222222222222')).toThrow(BadRequestException);});
it('uses a deterministic domain key independent from OTP/JWT rotation',()=>{const stable=ownerPetCreateFingerprint('Ася','CAT','p'.repeat(32));expect(ownerPetCreateFingerprint('Ася','CAT','p'.repeat(32))).toBe(stable);expect(ownerPetCreateFingerprint('Ася','CAT','o'.repeat(32))).not.toBe(stable);});
it.each([null,[],['bad']])('rejects malformed body %p with safe 400',(body)=>{const controller=new OwnerPetMvpController({createMvp:jest.fn()} as unknown as OwnerPetService);expect(()=>controller.create(owner,body as unknown as Record<string,unknown>,'22222222-2222-4222-8222-222222222222')).toThrow(BadRequestException);});
