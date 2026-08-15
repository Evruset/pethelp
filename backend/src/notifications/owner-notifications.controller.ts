import { BadRequestException, Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload, Role } from '../auth/auth.types';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { NotificationFoundationRepository } from './notification-foundation.repository';
import { OwnerNotificationDto, OwnerNotificationListDto } from './owner-notifications.dto';
import type { OwnerNotificationRecord } from './notification-foundation.repository';
import { ApiErrorDto } from '../booking-core/dto/booking-openapi.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Owner Notifications')
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('v1/owner/notifications')
export class OwnerNotificationsController {
  constructor(private readonly notifications: NotificationFoundationRepository) {}

  @Get()
  @ApiOperation({ summary: 'List safe in-app notifications for the authenticated Owner' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '1 to 100; default 50.' })
  @ApiOkResponse({ type: OwnerNotificationListDto })
  @ApiBadRequestResponse({ description: 'Limit is invalid.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Owner JWT is missing or invalid.', type: ApiErrorDto })
  async list(@CurrentUser() owner: JwtPayload, @Query('limit') rawLimit?: string): Promise<OwnerNotificationListDto> {
    const limit = rawLimit === undefined ? 50 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'limit is invalid.' });
    await this.notifications.projectPendingForOwner(owner.sub);
    return { notifications: (await this.notifications.listForOwner(owner.sub, limit)).map(publicNotification) };
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark one authenticated Owner notification as read' })
  @ApiParam({ name: 'notificationId', format: 'uuid' })
  @ApiOkResponse({ type: OwnerNotificationDto })
  @ApiBadRequestResponse({ description: 'Notification ID is invalid.', type: ApiErrorDto })
  @ApiNotFoundResponse({ description: 'Notification is absent or belongs to another Owner.', type: ApiErrorDto })
  @ApiUnauthorizedResponse({ description: 'Owner JWT is missing or invalid.', type: ApiErrorDto })
  async markRead(@CurrentUser() owner: JwtPayload, @Param('notificationId') notificationId: string): Promise<OwnerNotificationDto> {
    if (!UUID.test(notificationId)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'notificationId must be a UUID.' });
    const found = await this.notifications.markReadAndGet(owner.sub, notificationId);
    if (!found) throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' });
    return publicNotification(found);
  }
}

function publicNotification(record: OwnerNotificationRecord): OwnerNotificationDto {
  return {
    id: record.id, notificationType: record.notificationType, title: record.title, body: record.body,
    bookingHoldId: record.bookingHoldId, appointmentId: record.appointmentId,
    readAt: record.readAt, createdAt: record.createdAt,
  };
}
