import { BadRequestException, Body, Controller, Get, Header, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, Role } from './auth.types';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { OwnerOcrReviewService } from './owner-ocr-review.service';
import { correctionBody, emptyReviewBody, reviewMutationSchema, reviewReadSchema } from './owner-ocr-review.openapi';
const Match=()=>ApiHeader({name:'If-Match',required:true,schema:{type:'string',pattern:'^"(0|[1-9][0-9]{0,9})"$'}});
const Idempotency=()=>ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}});

@ApiTags('Owner OCR review') @ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard,RolesGuard) @Roles(Role.OWNER)
@ApiResponse({status:400,description:'Invalid request or concurrency headers'}) @ApiResponse({status:403,description:'Owner role required'})
@ApiResponse({status:404,description:'Exact current Owner/Pet/Document/candidate unavailable'}) @ApiResponse({status:409,description:'Revision, terminal decision or idempotency conflict'})
@Controller('v1/owner/pets/:petId/documents/:documentId/ocr/candidates/:candidateId/review')
export class OwnerOcrReviewController {
  constructor(private readonly reviews:OwnerOcrReviewService) {}
  @Get() @ApiQuery({name:'limit',required:false,schema:{type:'integer',minimum:1,maximum:20,default:10}}) @ApiQuery({name:'offset',required:false,schema:{type:'integer',minimum:0,maximum:1000000,default:0}}) @Header('Cache-Control','no-store') @ApiOperation({operationId:'OwnerOcrReview_read'}) @ApiOkResponse({schema:reviewReadSchema})
  async read(@CurrentUser() owner:JwtPayload,@Param('petId',new ParseUUIDPipe()) pet:string,@Param('documentId',new ParseUUIDPipe()) doc:string,@Param('candidateId',new ParseUUIDPipe()) candidate:string,@Res({passthrough:true}) response:Response,@Query('limit') limit?:string,@Query('offset') offset?:string) {
    const result=await this.reviews.read(owner,pet,doc,candidate,this.integer(limit,10),this.integer(offset,0));response.setHeader('ETag',`"${result.revision}"`);return result;
  }
  @Post('start') @HttpCode(200) @Header('Cache-Control','no-store') @Match() @Idempotency() @ApiBody({schema:emptyReviewBody,required:false}) @ApiOkResponse({schema:reviewMutationSchema}) @ApiOperation({operationId:'OwnerOcrReview_start'})
  async start(@CurrentUser() owner:JwtPayload,@Param('petId',new ParseUUIDPipe()) pet:string,@Param('documentId',new ParseUUIDPipe()) doc:string,@Param('candidateId',new ParseUUIDPipe()) candidate:string,@Body() body:unknown,@Headers('if-match') match:string,@Headers('idempotency-key') key:string,@Res({passthrough:true}) response:Response) {const result=await this.reviews.mutate(owner,pet,doc,candidate,'START',body,match,key);response.setHeader('ETag',`"${result.revision}"`);return result;}
  @Post('corrections') @HttpCode(200) @Header('Cache-Control','no-store') @Match() @Idempotency() @ApiBody({schema:correctionBody}) @ApiOkResponse({schema:reviewMutationSchema}) @ApiOperation({operationId:'OwnerOcrReview_correct'})
  async correct(@CurrentUser() owner:JwtPayload,@Param('petId',new ParseUUIDPipe()) pet:string,@Param('documentId',new ParseUUIDPipe()) doc:string,@Param('candidateId',new ParseUUIDPipe()) candidate:string,@Body() body:unknown,@Headers('if-match') match:string,@Headers('idempotency-key') key:string,@Res({passthrough:true}) response:Response) {const result=await this.reviews.mutate(owner,pet,doc,candidate,'CORRECT',body,match,key);response.setHeader('ETag',`"${result.revision}"`);return result;}
  @Post('confirm') @HttpCode(200) @Header('Cache-Control','no-store') @Match() @Idempotency() @ApiBody({schema:emptyReviewBody,required:false}) @ApiOkResponse({schema:reviewMutationSchema}) @ApiOperation({operationId:'OwnerOcrReview_confirm'})
  async confirm(@CurrentUser() owner:JwtPayload,@Param('petId',new ParseUUIDPipe()) pet:string,@Param('documentId',new ParseUUIDPipe()) doc:string,@Param('candidateId',new ParseUUIDPipe()) candidate:string,@Body() body:unknown,@Headers('if-match') match:string,@Headers('idempotency-key') key:string,@Res({passthrough:true}) response:Response) {const result=await this.reviews.mutate(owner,pet,doc,candidate,'CONFIRM',body,match,key);response.setHeader('ETag',`"${result.revision}"`);return result;}
  @Post('reject') @HttpCode(200) @Header('Cache-Control','no-store') @Match() @Idempotency() @ApiBody({schema:emptyReviewBody,required:false}) @ApiOkResponse({schema:reviewMutationSchema}) @ApiOperation({operationId:'OwnerOcrReview_reject'})
  async reject(@CurrentUser() owner:JwtPayload,@Param('petId',new ParseUUIDPipe()) pet:string,@Param('documentId',new ParseUUIDPipe()) doc:string,@Param('candidateId',new ParseUUIDPipe()) candidate:string,@Body() body:unknown,@Headers('if-match') match:string,@Headers('idempotency-key') key:string,@Res({passthrough:true}) response:Response) {const result=await this.reviews.mutate(owner,pet,doc,candidate,'REJECT',body,match,key);response.setHeader('ETag',`"${result.revision}"`);return result;}
  private integer(value:string|undefined,fallback:number):number {if(value===undefined)return fallback;if(!/^(0|[1-9][0-9]*)$/.test(value))throw new BadRequestException({code:'INVALID_REQUEST',message:'Invalid review page.'});return Number(value);}
}
