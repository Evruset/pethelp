import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { CurrentUser } from './current-user.decorator';
import { JwtPayload } from './auth.types';
import { effectiveCapabilities } from './capability';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Authentication')
@Controller('v1/auth')
export class EffectiveSessionController {
  constructor(private readonly database: DatabaseService) {}

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Server-derived effective capabilities and active clinic scopes' })
  @ApiOkResponse({ description: 'UX hint only; authorization is always evaluated server-side.' })
  async read(@CurrentUser() actor: JwtPayload) {
    const rows = await this.database.query<{ clinic_id: string; location_id: string }>(`
      SELECT location.clinic_id::text, membership.clinic_location_id::text AS location_id
      FROM clinic_schema.employee_location_memberships membership
      JOIN clinic_schema.clinic_locations location ON location.id = membership.clinic_location_id
      WHERE membership.employee_id = $1::uuid AND membership.active = true AND location.status = 'ACTIVE'
    `, [actor.sub]);
    const clinicScopes = rows.rows.map((row) => ({ clinicId: row.clinic_id, locationId: row.location_id }));
    return { subjectId: actor.sub, roles: actor.roles, effectiveCapabilities: effectiveCapabilities(actor), clinicScopes };
  }
}
