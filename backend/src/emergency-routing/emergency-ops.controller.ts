import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { SubmitEmergencyReviewDto } from './dto/submit-emergency-review.dto';
import { EmergencyOpsService } from './emergency-ops.service';

@ApiTags('Emergency Operations')
@Controller('v1')
export class EmergencyOpsController {
  constructor(private readonly emergencyOps: EmergencyOpsService) {}

  @Post('clinics/:clinicId/emergency-ops/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Submit emergency evidence for platform review' })
  @ApiCreatedResponse({ description: 'Review is pending and clinic remains hidden from emergency search.' })
  async submit(@Param('clinicId') clinicId: string, @Body() dto: SubmitEmergencyReviewDto, @CurrentUser() employee: JwtPayload) {
    return this.emergencyOps.submitForReview(clinicId, dto.evidenceUrl, employee);
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
}
