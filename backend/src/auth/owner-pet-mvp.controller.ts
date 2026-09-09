import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiHeader, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
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
  @Get(':petId/diary') @ApiOkResponse({ description: 'Owner-scoped published pet chronology.' }) @ApiBadRequestResponse({ type: ApiErrorDto }) @ApiUnauthorizedResponse({ type: ApiErrorDto }) @ApiNotFoundResponse({ type: ApiErrorDto }) @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  diary(@CurrentUser() owner: JwtPayload,@Param('petId',new ParseUUIDPipe()) petId:string,@Query('limit') limit?:string,@Query('offset') offset?:string){return this.pets.diary(owner,petId,this.boundedInteger(limit,20,1,100),this.boundedInteger(offset,0,0,10000));}
  @Get(':petId') @ApiOkResponse({ type: OwnerPetMvpDto }) @ApiBadRequestResponse({ type: ApiErrorDto }) @ApiUnauthorizedResponse({ type: ApiErrorDto }) @ApiNotFoundResponse({ type: ApiErrorDto }) @ApiInternalServerErrorResponse({ type: ApiErrorDto })
  async read(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string) { const pet=await this.pets.readMvp(owner,petId); if(!pet)throw new NotFoundException({code:'OWNER_PET_NOT_FOUND',message:'Pet was not found.'}); return pet; }
  @Post() @ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}}) @ApiBody({schema:{type:'object',additionalProperties:false,required:['name','species'],properties:{name:{type:'string',minLength:1,maxLength:120},species:{type:'string',enum:['DOG','CAT','OTHER']}}}}) @ApiCreatedResponse({type:OwnerPetMvpDto}) @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiConflictResponse({type:ApiErrorDto}) @ApiInternalServerErrorResponse({type:ApiErrorDto})
  create(@CurrentUser() owner:JwtPayload,@Body() body:Record<string,unknown>,@Headers('idempotency-key') key?:string){
    if(!key||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw new BadRequestException({code:'INVALID_REQUEST',message:'Idempotency-Key must be a UUID.'});
    if(body===null||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some((field)=>!['name','species'].includes(field))||typeof body.name!=='string')throw new BadRequestException({code:'INVALID_REQUEST',message:'Only name and species are accepted.'});
    if(!['DOG','CAT','OTHER'].includes(String(body.species)))throw new BadRequestException({code:'INVALID_PET_SPECIES',message:'species must be DOG, CAT or OTHER.'});
    return this.pets.createMvp(owner,{name:body.name,species:body.species as CreateOwnerPetMvpDto['species']},key);
  }
  private boundedInteger(value:string|undefined,fallback:number,min:number,max:number){if(value===undefined)return fallback;const parsed=Number(value);if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new BadRequestException({code:'INVALID_REQUEST'});return parsed;}
}
