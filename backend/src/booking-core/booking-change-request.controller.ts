import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { type JwtPayload, Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApiErrorDto } from './dto/booking-openapi.dto';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { BookingChangeRequestService } from './booking-change-request.service';
import { BookingChangeRequestDto, BookingChangeRequestStatus, BookingChangeRequestType, CreateBookingChangeRequestDto, OperationsBookingChangeRequestDetailDto, OperationsBookingChangeRequestPageDto, OperationsBookingChangeRequestQueryDto, ProcessBookingChangeRequestDto } from './dto/booking-change-request.dto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requiredUuid=(value:string|undefined,name:string)=>{if(!value||!UUID.test(value))throw new BadRequestException({code:'INVALID_REQUEST',field:name});return value;};
const requestTypes=new Set(Object.values(BookingChangeRequestType));
const statuses=new Set(Object.values(BookingChangeRequestStatus));

@ApiTags('Booking change requests')
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard,RolesGuard)
@Controller('v1')
export class BookingChangeRequestController{
  constructor(private readonly service:BookingChangeRequestService){}

  @Post('owner/bookings/:holdId/change-requests') @HttpCode(HttpStatus.CREATED)
  @Roles(Role.OWNER)
  @ApiOperation({summary:'Create an Owner cancellation or reschedule request without mutating Booking'})
  @ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}})
  @ApiHeader({name:'X-Correlation-ID',required:false,schema:{type:'string',format:'uuid'}})
  @ApiResponse({status:425,type:ApiErrorDto,description:'An identical command is still processing'})
  @ApiCreatedResponse({type:BookingChangeRequestDto}) @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiForbiddenResponse({type:ApiErrorDto}) @ApiNotFoundResponse({type:ApiErrorDto}) @ApiConflictResponse({type:ApiErrorDto}) @ApiUnprocessableEntityResponse({type:ApiErrorDto})
  create(@Param('holdId') holdId:string,@CurrentUser() owner:JwtPayload,@Headers('idempotency-key') key?:string,@Headers('x-correlation-id') correlation?:string,@Body() body?:CreateBookingChangeRequestDto){
    if(!body||!requestTypes.has(body.requestType))throw new BadRequestException({code:'INVALID_REQUEST',field:'requestType'});
    return this.service.create({holdId:requiredUuid(holdId,'holdId'),ownerId:owner.sub,requestType:body.requestType,idempotencyKey:requiredUuid(key,'Idempotency-Key'),correlationId:UUID.test(correlation??'')?correlation!:randomUUID()});
  }

  @Get('owner/bookings/:holdId/change-requests/current')
  @Roles(Role.OWNER)
  @ApiOkResponse({type:BookingChangeRequestDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiForbiddenResponse({type:ApiErrorDto}) @ApiNotFoundResponse({type:ApiErrorDto})
  current(@Param('holdId') holdId:string,@CurrentUser() owner:JwtPayload){return this.service.readCurrent({holdId:requiredUuid(holdId,'holdId'),ownerId:owner.sub});}

  @Get('operations/booking-change-requests')
  @Roles(Role.SUPPORT_L1,Role.SUPPORT_L2,Role.PLATFORM_ADMIN)
  @ApiOkResponse({type:OperationsBookingChangeRequestPageDto}) @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiForbiddenResponse({type:ApiErrorDto})
  operations(@Query() query:OperationsBookingChangeRequestQueryDto,@CurrentUser() actor:JwtPayload){
    const limit=Number(query.limit??25);
    if(!Number.isInteger(limit)||limit<1||limit>50)throw new BadRequestException({code:'INVALID_REQUEST',field:'limit'});
    if(query.status&&!statuses.has(query.status))throw new BadRequestException({code:'INVALID_REQUEST',field:'status'});
    const locationId=query.locationId?requiredUuid(query.locationId,'locationId'):undefined;
    return this.service.readOperations({status:query.status,locationId,limit,actor});
  }

  @Get('operations/booking-change-requests/:requestId')
  @Roles(Role.SUPPORT_L1,Role.SUPPORT_L2,Role.PLATFORM_ADMIN)
  @ApiOkResponse({type:OperationsBookingChangeRequestDetailDto}) @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiForbiddenResponse({type:ApiErrorDto}) @ApiNotFoundResponse({type:ApiErrorDto})
  operationsDetail(@Param('requestId') requestId:string,@CurrentUser() actor:JwtPayload){return this.service.readOperationsDetail({requestId:requiredUuid(requestId,'requestId'),actor});}

  @Post('operations/booking-change-requests/:requestId/:command') @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPPORT_L1,Role.SUPPORT_L2,Role.PLATFORM_ADMIN)
  @ApiOperation({summary:'Transition the request or atomically apply its authoritative Booking cancellation/reschedule'})
  @ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}})
  @ApiHeader({name:'If-Match',required:true,schema:{type:'integer',minimum:1}})
  @ApiHeader({name:'X-Correlation-ID',required:false,schema:{type:'string',format:'uuid'}})
  @ApiResponse({status:425,type:ApiErrorDto,description:'An identical command is still processing'})
  @ApiOkResponse({type:OperationsBookingChangeRequestDetailDto}) @ApiBadRequestResponse({type:ApiErrorDto}) @ApiUnauthorizedResponse({type:ApiErrorDto}) @ApiForbiddenResponse({type:ApiErrorDto}) @ApiNotFoundResponse({type:ApiErrorDto}) @ApiConflictResponse({type:ApiErrorDto})
  transition(@Param('requestId') requestId:string,@Param('command') command:string,@CurrentUser() actor:JwtPayload,@Headers('idempotency-key') key?:string,@Headers('if-match') ifMatch?:string,@Headers('x-correlation-id') correlation?:string,@Body() body:ProcessBookingChangeRequestDto={}){
    const commands={start:'START',complete:'COMPLETE',reject:'REJECT',cancel:'CANCEL'} as const;
    const resolved=commands[command as keyof typeof commands];
    if(!resolved)throw new BadRequestException({code:'INVALID_REQUEST',field:'command'});
    const expectedVersion=Number(ifMatch);
    if(!Number.isInteger(expectedVersion)||expectedVersion<1)throw new BadRequestException({code:'INVALID_REQUEST',field:'If-Match'});
    if((body.replacementSlotId===undefined)!==(body.replacementSlotVersion===undefined))throw new BadRequestException({code:'INVALID_REQUEST',field:'replacementSlot'});
    return this.service.transitionOperations({requestId:requiredUuid(requestId,'requestId'),actor,command:resolved,expectedVersion,idempotencyKey:requiredUuid(key,'Idempotency-Key'),correlationId:UUID.test(correlation??'')?correlation!:randomUUID(),replacementSlotId:body.replacementSlotId,replacementSlotVersion:body.replacementSlotVersion});
  }
}
