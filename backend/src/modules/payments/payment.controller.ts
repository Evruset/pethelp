import { Body, Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOperation, ApiTags, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { PaymentIntentResult, PaymentService } from './payment.service';

interface PaymentAuthorizedWebhookDto {
  idempotencyKey?: string;
}

@ApiTags('Payments & Ledger')
@Controller('v1')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('booking-holds/:holdId/payment-intents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Создание payment intent с фиксацией hold_version fence' })
  @ApiCreatedResponse({ description: 'Payment intent создан или возвращён существующий для hold/version.' })
  async createIntent(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
  ): Promise<PaymentIntentResult> {
    return this.paymentService.createPaymentIntent(holdId, owner.sub);
  }

  @Post('payments/webhooks/authorized')
  @ApiOperation({ summary: 'Webhook эквайринга: авторизация платежа с Payment Attempt Fencing' })
  @ApiHeader({ name: 'Idempotency-Key', required: false, schema: { type: 'string' } })
  @ApiUnprocessableEntityResponse({ description: 'PAYMENT_FENCED_SLOT_EXPIRED или PAYMENT_FENCED_HOLD_VERSION_MISMATCH.' })
  async paymentAuthorized(
    @Body() body: PaymentAuthorizedWebhookDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ): Promise<PaymentIntentResult> {
    return this.paymentService.handlePaymentAuthorized(body.idempotencyKey ?? idempotencyHeader ?? '');
  }
}
