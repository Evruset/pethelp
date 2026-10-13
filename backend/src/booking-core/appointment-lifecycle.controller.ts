import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { TraceContext } from '../observability/trace-context.context';
import { AppointmentLifecycleService } from './appointment-lifecycle.service';
import { ApiErrorDto } from './dto/booking-openapi.dto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=(v:string|undefined,n:string)=>{if(!v||!UUID.test(v))throw new BadRequestException({code:'VALIDATION_ERROR',message:`${n} must be a UUID`});return v;};
const version=(v:string|undefined)=>{const x=v?.replace(/^W\//,'').replace(/^"|"$/g,'');const n=Number(x);if(!Number.isSafeInteger(n)||n<1)throw new BadRequestException({code:'VALIDATION_ERROR',message:'If-Match must be a positive version'});return n;};
const lifecycleResponse={type:'object',required:['appointmentId','lifecycle','aggregateVersion'],properties:{appointmentId:{type:'string',format:'uuid'},lifecycle:{type:'string',enum:['CANCELLED_BY_CLINIC','RESCHEDULE_PROPOSED','NO_SHOW']},aggregateVersion:{type:'integer'},proposalId:{type:'string',format:'uuid'},originalSlotId:{type:'string',format:'uuid'},targetSlotId:{type:'string',format:'uuid'},expiresAt:{type:'string',format:'date-time'},cancelledAt:{type:'string',format:'date-time'},noShowAt:{type:'string',format:'date-time'},reasonCode:{type:'string',nullable:true},reasonText:{type:'string',nullable:true},nextAction:{type:'string',enum:['SELECT_ALTERNATIVE']}}};

@ApiTags('Clinic Appointments')
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard,RolesGuard)
@Roles(Role.CLINIC_RECEPTIONIST,Role.CLINIC_ADMIN)
@Controller('v1/clinic/:clinicId/locations/:locationId/appointments/:appointmentId')
export class AppointmentLifecycleController {
  constructor(private readonly lifecycle:AppointmentLifecycleService,private readonly trace:TraceContext){}
  private common(clinicId:string,locationId:string,appointmentId:string,employee:JwtPayload,key?:string,match?:string,correlation?:string){return{clinicId:id(clinicId,'clinicId'),locationId:id(locationId,'locationId'),appointmentId:id(appointmentId,'appointmentId'),employee,idempotencyKey:id(key,'Idempotency-Key'),expectedVersion:version(match),correlationId:correlation&&UUID.test(correlation)?correlation:(this.trace.getCorrelationId()??randomUUID())};}

  @Post('cancel') @HttpCode(HttpStatus.OK)
  @ApiOperation({summary:'Cancel a confirmed appointment as the authoritative clinic'})
  @ApiHeader({name:'Idempotency-Key',required:true}) @ApiHeader({name:'If-Match',required:true})
  @ApiBody({schema:{type:'object',additionalProperties:false,properties:{reasonCode:{type:'string'},reasonText:{type:'string'}}}})
  @ApiOkResponse({description:'CANCELLED_BY_CLINIC with persisted reason.',schema:lifecycleResponse})
  @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiForbiddenResponse({type:ApiErrorDto}) @ApiConflictResponse({type:ApiErrorDto}) @ApiUnprocessableEntityResponse({type:ApiErrorDto})
  cancel(@Param('clinicId')c:string,@Param('locationId')l:string,@Param('appointmentId')a:string,@CurrentUser()e:JwtPayload,@Headers('idempotency-key')k?:string,@Headers('if-match')m?:string,@Headers('x-correlation-id')x?:string,@Body()b?:{reasonCode?:string;reasonText?:string}){return this.lifecycle.cancelByClinic({...this.common(c,l,a,e,k,m,x),reasonCode:b?.reasonCode,reasonText:b?.reasonText});}

  @Post('reschedule-proposals') @HttpCode(HttpStatus.OK)
  @ApiOperation({summary:'Propose, but do not apply, another slot'})
  @ApiHeader({name:'Idempotency-Key',required:true}) @ApiHeader({name:'If-Match',required:true})
  @ApiBody({schema:{type:'object',additionalProperties:false,required:['targetSlotId','expectedTargetSlotVersion'],properties:{targetSlotId:{type:'string',format:'uuid'},expectedTargetSlotVersion:{type:'integer',minimum:1}}}})
  @ApiOkResponse({description:'RESCHEDULE_PROPOSED; original appointment remains authoritative.',schema:lifecycleResponse})
  @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiForbiddenResponse({type:ApiErrorDto}) @ApiConflictResponse({type:ApiErrorDto}) @ApiUnprocessableEntityResponse({type:ApiErrorDto})
  propose(@Param('clinicId')c:string,@Param('locationId')l:string,@Param('appointmentId')a:string,@CurrentUser()e:JwtPayload,@Headers('idempotency-key')k?:string,@Headers('if-match')m?:string,@Headers('x-correlation-id')x?:string,@Body()b?:{targetSlotId?:string;expectedTargetSlotVersion?:number}){if(!Number.isSafeInteger(b?.expectedTargetSlotVersion)||Number(b?.expectedTargetSlotVersion)<1)throw new BadRequestException({code:'VALIDATION_ERROR',message:'expectedTargetSlotVersion is required'});return this.lifecycle.propose({...this.common(c,l,a,e,k,m,x),targetSlotId:id(b?.targetSlotId,'targetSlotId'),expectedTargetSlotVersion:Number(b!.expectedTargetSlotVersion)});}

  @Post('no-show') @HttpCode(HttpStatus.OK)
  @ApiOperation({summary:'Mark an eligible past confirmed appointment as no-show'})
  @ApiHeader({name:'Idempotency-Key',required:true}) @ApiHeader({name:'If-Match',required:true})
  @ApiOkResponse({description:'NO_SHOW with authoritative actor and timestamp.',schema:lifecycleResponse})
  @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiForbiddenResponse({type:ApiErrorDto}) @ApiConflictResponse({type:ApiErrorDto}) @ApiUnprocessableEntityResponse({type:ApiErrorDto})
  noShow(@Param('clinicId')c:string,@Param('locationId')l:string,@Param('appointmentId')a:string,@CurrentUser()e:JwtPayload,@Headers('idempotency-key')k?:string,@Headers('if-match')m?:string,@Headers('x-correlation-id')x?:string){return this.lifecycle.markNoShow(this.common(c,l,a,e,k,m,x));}
}
