import { Body, Controller, Delete, Get, Headers, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload, Role } from './auth.types';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { CreateOwnerPetDto, UpdateOwnerPetDto } from './dto/owner-pet.dto';
import { OwnerPetService, PET_DOCUMENT_MAX_BYTES, type UploadedPetFile } from './owner-pet.service';

@ApiTags('Owner pets')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('v1/owner/pets')
export class OwnerPetController {
  constructor(private readonly pets: OwnerPetService) {}

  @Get()
  @ApiOperation({ summary: 'Список питомцев текущего владельца' })
  @ApiOkResponse({ description: 'Питомцы доступны только владельцу из JWT.' })
  async list(@CurrentUser() owner: JwtPayload, @Query('includeArchived') includeArchived?: string) {
    return this.pets.list(owner, includeArchived === 'true');
  }

  @Get(':petId/diary')
  @ApiOperation({ summary: 'Единая owner-scoped хронология питомца' })
  async diary(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.pets.diary(owner, petId, this.boundedInteger(limit, 20, 1, 100), this.boundedInteger(offset, 0, 0, 10000));
  }

  @Get(':petId/documents/:documentId')
  @ApiOperation({ summary: 'Безопасные метаданные документа питомца' })
  async documentMetadata(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.pets.documentMetadata(owner, petId, documentId);
  }

  @Get(':petId/care-summary')
  @ApiOperation({ summary: 'Медицинская карта питомца: профиль, документы и история помощи' })
  @ApiOkResponse({ description: 'Owner-scoped care summary без внутренних MIS/provider данных.' })
  async careSummary(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string) {
    const summary = await this.pets.careSummary(owner, petId);
    if (!summary) throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
    return summary;
  }

  @Post(':petId/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PET_DOCUMENT_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        docType: { type: 'string', enum: ['PASSPORT', 'HISTORY'] },
      },
    },
  })
  @ApiOperation({ summary: 'Загрузка медицинского файла питомца' })
  @ApiCreatedResponse({ description: 'Документ сохранён и доступен только владельцу питомца.' })
  async uploadDocumentPhoto(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @UploadedFile() file: UploadedPetFile | undefined,
    @Body('docType') docType?: 'PASSPORT' | 'HISTORY',
  ) {
    return this.pets.uploadDocumentFile(owner, petId, file, docType ?? 'HISTORY');
  }

  @Post(':petId/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PET_DOCUMENT_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Загрузка или замена фото профиля питомца' })
  async uploadPhoto(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @UploadedFile() file: UploadedPetFile | undefined,
  ) {
    return this.pets.uploadPetPhoto(owner, petId, file);
  }

  @Delete(':petId/photo')
  @ApiOperation({ summary: 'Удаление фото профиля питомца' })
  async deletePhoto(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string) {
    return this.pets.deletePetPhoto(owner, petId);
  }

  @Get(':petId/documents/:documentId/download')
  @ApiOperation({ summary: 'Owner-scoped download документа питомца' })
  async downloadDocument(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.pets.downloadDocument(owner, petId, documentId);
    response.setHeader('Content-Type', download.mimeType);
    response.setHeader('Content-Length', download.fileSizeBytes.toString());
    response.setHeader('Content-Disposition', `inline; filename="${download.safeFileName}"`);
    return new StreamableFile(download.stream);
  }

  @Delete(':petId/documents/:documentId')
  @ApiOperation({ summary: 'Удаление документа питомца владельцем' })
  async deleteDocument(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    await this.pets.deleteDocument(owner, petId, documentId);
    return { deleted: true };
  }

  @Get(':petId')
  @ApiOperation({ summary: 'Профиль питомца текущего владельца' })
  @ApiOkResponse({ description: 'Расширенный профиль питомца без чужих owner данных.' })
  async read(@CurrentUser() owner: JwtPayload, @Param('petId', new ParseUUIDPipe()) petId: string) {
    const pet = await this.pets.read(owner, petId);
    if (!pet) throw new NotFoundException({ code: 'OWNER_PET_NOT_FOUND', message: 'Pet was not found.' });
    return pet;
  }

  @Post()
  @ApiOperation({ summary: 'Создание питомца для текущего владельца' })
  @ApiCreatedResponse({ description: 'Питомец создан и принадлежит владельцу из JWT.' })
  async create(@CurrentUser() owner: JwtPayload, @Body() dto: CreateOwnerPetDto) {
    return this.pets.create(owner, dto);
  }

  @Patch(':petId')
  @ApiOperation({ summary: 'Обновление профиля питомца текущего владельца' })
  @ApiOkResponse({ description: 'Профиль обновлён, profileVersion увеличен.' })
  async update(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Body() dto: UpdateOwnerPetDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.pets.update(owner, petId, dto, this.parseIfMatch(ifMatch));
  }

  @Post(':petId/archive')
  @ApiOperation({ summary: 'Архивировать питомца без отмены записей и телемедицины' })
  async archive(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.pets.setArchived(owner, petId, true, this.parseIfMatch(ifMatch));
  }

  @Post(':petId/restore')
  @ApiOperation({ summary: 'Восстановить питомца из архива' })
  async restore(
    @CurrentUser() owner: JwtPayload,
    @Param('petId', new ParseUUIDPipe()) petId: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.pets.setArchived(owner, petId, false, this.parseIfMatch(ifMatch));
  }

  private parseIfMatch(value?: string): number | undefined {
    if (!value) return undefined;
    const normalized = value.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
    if (!/^\d+$/.test(normalized)) return undefined;
    return Number.parseInt(normalized, 10);
  }

  private boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10)));
  }
}
