import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiHeader, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiErrorDto } from '../booking-core/dto/booking-openapi.dto';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { CurrentUser } from './current-user.decorator';
import { CreateOwnerPetMvpDto, OwnerPetMvpDto } from './dto/owner-pet.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, Role } from './auth.types';
import { OwnerPetService } from './owner-pet.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@ApiTags('Owner pets') @ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.OWNER)
@Controller('v1/owner/pets')
export class OwnerPetMvpController {
  constructor(private readonly pets: OwnerPetService) {}
  @Get() @ApiOkResponse({ type: OwnerPetMvpDto, isArray: true }) @ApiUnauthorizedResponse({ type: ApiErrorDto }) @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  list(@CurrentUser() owner: JwtPayload) { return this.pets.listMvp(owner); }
  @Get(':petId') @ApiOkResponse({ type: OwnerPetMvpDto }) @ApiBadRequestResponse({ type: ApiErrorDto }) @ApiUnauthorizedResponse({ type: ApiErrorDto }) @ApiNotFoundResponse({ type: ApiErrorDto }) @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  async read(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string) { const pet=await this.pets.readMvp(owner,petId); if(!pet)throw new NotFoundException({code:'OWNER_PET_NOT_FOUND',message:'Pet was not found.'}); return pet; }
  @Get(':petId/diary')
  @ApiOperation({ operationId: 'OwnerPet_readDiary', summary: 'Published clinical diary for the current owner pet' })
  @ApiOkResponse({ schema: { type: 'object', additionalProperties: false, required: ['petId', 'entries', 'clinicalEntries', 'page'], properties: {
    petId: { type: 'string', format: 'uuid' },
    entries: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['type', 'sourceId', 'occurredAt', 'endsAt', 'title', 'summary', 'lifecycleStatus', 'downloadUrl'], properties: { type: { type: 'string', enum: ['DOCUMENT', 'VISIT', 'TELEMED', 'RESULT', 'RESULT_AMENDMENT'] }, sourceId: { type: 'string' }, occurredAt: { type: 'string', format: 'date-time' }, endsAt: { type: 'string', format: 'date-time', nullable: true }, title: { type: 'string' }, summary: { type: 'string', nullable: true }, lifecycleStatus: { type: 'string' }, downloadUrl: { type: 'string', nullable: true } } } },
    clinicalEntries: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['visit', 'result', 'amendments'], properties: {
      visit: { type: 'object', additionalProperties: false, required: ['visitId', 'occurredAt', 'clinic', 'location', 'service', 'doctor'], properties: { visitId: { type: 'string', format: 'uuid' }, occurredAt: { type: 'string', format: 'date-time' }, clinic: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' } } }, location: { type: 'object', nullable: true, additionalProperties: false, required: ['address'], properties: { address: { type: 'string' } } }, service: { type: 'object', nullable: true, additionalProperties: false, required: ['name'], properties: { name: { type: 'string' } } }, doctor: { type: 'object', nullable: true, additionalProperties: false, required: ['name'], properties: { name: { type: 'string' } } } } },
      result: { type: 'object', additionalProperties: false, required: ['resultId', 'publishedAt', 'content'], properties: { resultId: { type: 'string', format: 'uuid' }, publishedAt: { type: 'string', format: 'date-time' }, content: { type: 'string' } } },
      amendments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['amendmentId', 'version', 'createdAt', 'publishedAt', 'content'], properties: { amendmentId: { type: 'string', format: 'uuid' }, version: { type: 'integer', minimum: 1 }, createdAt: { type: 'string', format: 'date-time' }, publishedAt: { type: 'string', format: 'date-time' }, content: { type: 'string' } } } },
    } } },
    page: { type: 'object', additionalProperties: false, required: ['limit', 'offset', 'nextOffset', 'total'], properties: { limit: { type: 'integer' }, offset: { type: 'integer' }, nextOffset: { type: 'integer', nullable: true }, total: { type: 'integer' } } },
  } } })
  @ApiBadRequestResponse({ type: ApiErrorDto }) @ApiUnauthorizedResponse({ type: ApiErrorDto }) @ApiNotFoundResponse({ type: ApiErrorDto }) @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  diary(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.pets.diary(owner, petId, this.boundedInteger(limit, 20, 1, 100), this.boundedInteger(offset, 0, 0, 10000));
  }
  @Post() @ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}}) @ApiBody({schema:{type:'object',additionalProperties:false,required:['name','species'],properties:{name:{type:'string',minLength:1,maxLength:120},species:{type:'string',enum:['DOG','CAT','OTHER']}}}}) @ApiCreatedResponse({type:OwnerPetMvpDto}) @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiConflictResponse({type:ApiErrorDto}) @ApiInternalServerErrorResponse({type:ApiErrorDto})
  create(@CurrentUser() owner:JwtPayload,@Body() body:Record<string,unknown>,@Headers('idempotency-key') key?:string){
    if(!key||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw new BadRequestException({code:'INVALID_REQUEST',message:'Idempotency-Key must be a UUID.'});
    if(body===null||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some((field)=>!['name','species'].includes(field))||typeof body.name!=='string')throw new BadRequestException({code:'INVALID_REQUEST',message:'Only name and species are accepted.'});
    if(!['DOG','CAT','OTHER'].includes(String(body.species)))throw new BadRequestException({code:'INVALID_PET_SPECIES',message:'species must be DOG, CAT or OTHER.'});
    return this.pets.createMvp(owner,{name:body.name,species:body.species as CreateOwnerPetMvpDto['species']},key);
  }
  private boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `Value must be an integer between ${min} and ${max}.` });
    return parsed;
  }
}
