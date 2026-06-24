import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { PendingEmergencyReviewsQueryDto } from './dto/pending-emergency-reviews-query.dto';
import { RevokeEmergencyCapabilitiesDto } from './dto/revoke-emergency-capabilities.dto';
import { SubmitEmergencyReviewDto } from './dto/submit-emergency-review.dto';
import { EmergencyOpsService } from './emergency-ops.service';
import { EmergencyReviewManagementService } from './emergency-review-management.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Emergency Operations')
@Controller('v1')
export class EmergencyOpsController {
  constructor(
    private readonly emergencyOps: EmergencyOpsService,
    private readonly reviewManagement: EmergencyReviewManagementService,
  ) {}

  @Post('clinics/:clinicId/emergency-ops/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Submit emergency evidence for platform review' })
  @ApiCreatedResponse({ description: 'Review is pending and clinic remains hidden from emergency search.' })
  async submit(@Param('clinicId') clinicId: string, @Body() dto: SubmitEmergencyReviewDto, @CurrentUser() employee: JwtPayload) {
    return this.emergencyOps.submitForReview(clinicId, dto.evidenceUrl, employee);
  }

  @Get('admin/emergency-ops/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Read FIFO backlog of emergency capability reviews' })
  async pending(@Query() query: PendingEmergencyReviewsQueryDto) {
    return this.reviewManagement.getPendingReviews(query.page, query.limit);
  }

  @Post('admin/emergency-ops/reviews/:reviewId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Approve emergency review for 90 days' })
  @ApiOkResponse({ description: 'Clinic is published to emergency search until review expiry.' })
  async approve(@Param('reviewId') reviewId: string, @CurrentUser() platformAdmin: JwtPayload) {
    return this.emergencyOps.approveEmergencyProfile(reviewId, platformAdmin.sub);
  }

  @Post('admin/clinics/:clinicId/emergency-ops/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Immediately revoke emergency publication and notify routing services' })
  async revoke(
    @Param('clinicId') clinicId: string,
    @Body() dto: RevokeEmergencyCapabilitiesDto,
    @CurrentUser() platformAdmin: JwtPayload,
    @Headers('x-correlation-id') suppliedCorrelationId?: string,
  ) {
    const correlationId = suppliedCorrelationId && UUID.test(suppliedCorrelationId) ? suppliedCorrelationId : randomUUID();
    return this.reviewManagement.revokeEmergencyCapabilities(clinicId, dto.reason, platformAdmin.sub, correlationId);
  }
}
