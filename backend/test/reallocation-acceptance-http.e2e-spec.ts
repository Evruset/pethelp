import 'reflect-metadata';
import type {INestApplication} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {JwtService} from '@nestjs/jwt';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {Role} from '../src/auth/auth.types';
import {ReallocationService} from '../src/booking-core/reallocation.service';
import {BookingErrorFilter} from '../src/common/booking-error.filter';
import {config} from '../src/config';
import {NestRoot} from '../src/nest-root-full';

describe('W6-C1 Owner acceptance HTTP contract',()=>{
  let app:INestApplication,jwt:JwtService,service:ReallocationService;
  beforeAll(async()=>{process.env.WORKERS_ENABLED='false';app=await NestFactory.create(NestRoot,{logger:false});app.useGlobalFilters(new BookingErrorFilter());await app.init();jwt=app.get(JwtService);service=app.get(ReallocationService);});
  afterAll(async()=>app.close());
  it('binds authenticated Owner, exact versions and idempotency to the bounded accept route',async()=>{
    const owner=randomUUID(),caseId=randomUUID(),offerId=randomUUID(),key=randomUUID(),slotId=randomUUID();const accept=jest.spyOn(service,'accept').mockResolvedValue({caseId,bookingChangeRequestId:randomUUID(),bookingHoldId:randomUUID(),status:'REPLACEMENT_PENDING_CONFIRMATION',eligibility:'BOOKING_INELIGIBLE',version:2,serverNow:new Date().toISOString(),createdAt:new Date().toISOString(),acceptedOfferId:offerId,replacementBooking:{holdId:randomUUID(),status:'PENDING_CONFIRMATION',confirmationMode:'MANUAL',slotId,aggregateVersion:1,expiresAt:new Date().toISOString()},offers:[]});
    const token=await jwt.signAsync({sub:owner,roles:[Role.OWNER]},{secret:config.jwtSecret,issuer:config.jwtIssuer,audience:config.jwtAudience,algorithm:'HS256'});
    const response=await request(app.getHttpServer()).post(`/v1/owner/reallocation-cases/${caseId}/accept`).set('Authorization',`Bearer ${token}`).set('Idempotency-Key',key).send({offerId,caseVersion:1,offerVersion:1,slotVersion:7});expect(response.status).toBe(201);expect(response.body).toMatchObject({caseId,status:'REPLACEMENT_PENDING_CONFIRMATION',acceptedOfferId:offerId,replacementBooking:{status:'PENDING_CONFIRMATION',slotId}});expect(accept).toHaveBeenCalledWith(expect.objectContaining({caseId,offerId,caseVersion:1,offerVersion:1,slotVersion:7,ownerId:owner,idempotencyKey:key}));
    expect((await request(app.getHttpServer()).post(`/v1/owner/reallocation-cases/${caseId}/accept`).set('Authorization',`Bearer ${token}`).send({offerId,caseVersion:1,offerVersion:1,slotVersion:7})).status).toBe(400);
  });
});
