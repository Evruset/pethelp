import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { type JwtPayload, Role } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AcceptReallocationOfferDto, ReallocationCaseDto } from './dto/reallocation.dto';
import { ReallocationService } from './reallocation.service';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value:string|undefined,field:string){if(!value||!UUID.test(value))throw new BadRequestException({code:'INVALID_REQUEST',field});return value;}
@ApiTags('booking-reallocation') @ApiBearerAuth() @UseGuards(JwtAuthGuard,RolesGuard) @Controller('v1')
export class ReallocationController {
  constructor(private readonly service:ReallocationService){}
  @Post('owner/booking-change-requests/:requestId/reallocation') @HttpCode(HttpStatus.CREATED) @Roles(Role.OWNER) @ApiHeader({name:'Idempotency-Key',required:true,schema:{format:'uuid'}}) @ApiCreatedResponse({type:ReallocationCaseDto})
  open(@Param('requestId') requestId:string,@CurrentUser() owner:JwtPayload,@Headers('idempotency-key') key?:string,@Headers('x-correlation-id') correlation?:string){return this.service.open({requestId:uuid(requestId,'requestId'),ownerId:owner.sub,idempotencyKey:uuid(key,'Idempotency-Key'),correlationId:UUID.test(correlation??'')?correlation!:randomUUID()});}
  @Get('owner/reallocation-cases/:caseId') @Roles(Role.OWNER) @ApiOkResponse({type:ReallocationCaseDto}) owner(@Param('caseId') caseId:string,@CurrentUser() owner:JwtPayload){return this.service.owner(uuid(caseId,'caseId'),owner.sub);}
  @Post('owner/reallocation-cases/:caseId/accept') @HttpCode(HttpStatus.CREATED) @Roles(Role.OWNER) @ApiHeader({name:'Idempotency-Key',required:true,schema:{format:'uuid'}}) @ApiCreatedResponse({type:ReallocationCaseDto})
  accept(@Param('caseId') caseId:string,@Body() body:AcceptReallocationOfferDto,@CurrentUser() owner:JwtPayload,@Headers('idempotency-key') key?:string,@Headers('x-correlation-id') correlation?:string){return this.service.accept({caseId:uuid(caseId,'caseId'),offerId:body.offerId,caseVersion:body.caseVersion,offerVersion:body.offerVersion,slotVersion:body.slotVersion,ownerId:owner.sub,idempotencyKey:uuid(key,'Idempotency-Key'),correlationId:UUID.test(correlation??'')?correlation!:randomUUID()});}
  @Get('operations/reallocation-cases/:caseId') @Roles(Role.SUPPORT_L1,Role.SUPPORT_L2,Role.PLATFORM_ADMIN) @ApiOkResponse({type:ReallocationCaseDto}) readOperationsCase(@Param('caseId') caseId:string){return this.service.operations(uuid(caseId,'caseId'));}
}
