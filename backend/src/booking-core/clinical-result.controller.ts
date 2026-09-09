import { BadRequestException,Body,Controller,Get,Headers,HttpCode,HttpStatus,Param,Patch,Post,UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload,Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApiOperation } from '@nestjs/swagger';
import { ClinicalResultService } from './clinical-result.service';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(v:string|undefined,n:string){if(!v||!UUID.test(v))throw new BadRequestException({code:'INVALID_REQUEST',message:`${n} must be a UUID.`});return v;}
function version(v:string|undefined){const x=v?.trim().replace(/^W\//,'').replace(/^"|"$/g,'');const n=Number(x);if(!Number.isSafeInteger(n)||n<1)throw new BadRequestException({code:'INVALID_REQUEST'});return n;}
@Controller('v1/clinic/visits/:visitId/results') @UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.CLINIC_VETERINARIAN)
export class ClinicalResultController{
 constructor(private readonly service:ClinicalResultService){}
 @Get() @ApiOperation({operationId:'ClinicalResult_readCurrent'}) current(@Param('visitId') v:string,@CurrentUser() a:JwtPayload){return this.service.readCurrent(uuid(v,'visitId'),a);}
 @Post() @ApiOperation({operationId:'ClinicalResult_createDraft'}) create(@Param('visitId') v:string,@Body() b:{clinicalSummary?:string},@Headers('idempotency-key') k:string|undefined,@Headers('x-correlation-id') c:string|undefined,@CurrentUser() a:JwtPayload){return this.service.createDraft(uuid(v,'visitId'),b.clinicalSummary??'',uuid(k,'Idempotency-Key'),a,uuid(c,'X-Correlation-ID'));}
 @Get(':resultId') @ApiOperation({operationId:'ClinicalResult_read'}) read(@Param('visitId') v:string,@Param('resultId') r:string,@CurrentUser() a:JwtPayload){return this.service.read(uuid(v,'visitId'),uuid(r,'resultId'),a);}
 @Patch(':resultId') @ApiOperation({operationId:'ClinicalResult_updateDraft'}) update(@Param('visitId') v:string,@Param('resultId') r:string,@Body() b:{clinicalSummary?:string},@Headers('if-match') m:string|undefined,@Headers('x-correlation-id') c:string|undefined,@CurrentUser() a:JwtPayload){return this.service.updateDraft(uuid(v,'visitId'),uuid(r,'resultId'),b.clinicalSummary??'',version(m),a,uuid(c,'X-Correlation-ID'));}
 @Post(':resultId/publish') @ApiOperation({operationId:'ClinicalResult_publish'}) @HttpCode(HttpStatus.OK) publish(@Param('visitId') v:string,@Param('resultId') r:string,@Headers('x-correlation-id') c:string|undefined,@CurrentUser() a:JwtPayload){return this.service.publish(uuid(v,'visitId'),uuid(r,'resultId'),a,uuid(c,'X-Correlation-ID'));}
 @Post(':resultId/amendments') @ApiOperation({operationId:'ClinicalResult_createAmendment'}) amend(@Param('visitId') v:string,@Param('resultId') r:string,@Body() b:{content?:string},@Headers('idempotency-key') k:string|undefined,@Headers('x-correlation-id') c:string|undefined,@CurrentUser() a:JwtPayload){return this.service.amend(uuid(v,'visitId'),uuid(r,'resultId'),b.content??'',uuid(k,'Idempotency-Key'),a,uuid(c,'X-Correlation-ID'));}
}
