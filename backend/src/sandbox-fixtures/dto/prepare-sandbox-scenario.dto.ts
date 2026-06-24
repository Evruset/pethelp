import { IsUUID } from 'class-validator';

export class PrepareSandboxScenarioDto {
  @IsUUID()
  correlationId!: string;
}
