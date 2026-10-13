import { BadRequestException, Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, Role } from './auth.types';
import { ocrEmptyRequest, ocrJobSchema, ocrReadSchema } from './owner-ocr.openapi';
import { OwnerOcrService } from './owner-ocr.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@ApiTags('Owner OCR candidates')
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('v1/owner/pets/:petId/documents/:documentId/ocr')
export class OwnerOcrController {
  constructor(private readonly jobs: OwnerOcrService) {}
  @ApiBody({schema:ocrEmptyRequest,required:false}) @ApiCreatedResponse({schema:ocrJobSchema})
  @Post() @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'OwnerOcr_enqueue', summary: 'Idempotently queue non-authoritative OCR for an owned document' })
  enqueue(@Body() body: unknown, @CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string, @Param('documentId', new ParseUUIDPipe()) documentId: string) { this.empty(body); return this.jobs.enqueue(owner, petId, documentId); }
  @ApiOkResponse({schema:ocrReadSchema})
  @Get() @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'OwnerOcr_read', summary: 'Read private unconfirmed OCR and text candidate; no medical promotion' })
  read(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string, @Param('documentId', new ParseUUIDPipe()) documentId: string) { return this.jobs.read(owner, petId, documentId); }
  @ApiBody({schema:ocrEmptyRequest,required:false}) @ApiCreatedResponse({schema:ocrJobSchema})
  @Post('retry') @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'OwnerOcr_retry', summary: 'Retry failed owned OCR within its lifetime three-attempt budget' })
  retry(@Body() body: unknown, @CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string, @Param('documentId', new ParseUUIDPipe()) documentId: string) { this.empty(body); return this.jobs.retry(owner, petId, documentId); }
  private empty(body: unknown): void {
    if (body !== undefined && (body === null || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)) throw new BadRequestException({code:'INVALID_REQUEST',message:'No OCR authority fields are accepted.'});
  }
}
