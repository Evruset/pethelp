import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateEmergencyTriageDto } from './dto/create-emergency-triage.dto';

type EmergencyTriageOutcome =
  | 'EMERGENCY'
  | 'SAME_DAY_CLINIC'
  | 'TELEMED_ELIGIBLE'
  | 'PLANNED_VISIT'
  | 'INSUFFICIENT_DATA';

interface RuleSetRow {
  id: string;
  version: string;
}

interface RuleRow {
  signal_code: string;
  outcome: EmergencyTriageOutcome;
  priority: number;
  required_capabilities: string[];
  owner_message: string;
}

export interface EmergencyTriageDecision {
  sessionId: string;
  ruleSetVersion: string;
  outcome: EmergencyTriageOutcome;
  requiredCapabilities: string[];
  ownerMessage: string;
  selectedSignals: string[];
}

@Injectable()
export class EmergencyTriageService {
  constructor(private readonly database: DatabaseService) {}

  async decide(dto: CreateEmergencyTriageDto): Promise<EmergencyTriageDecision> {
    if (!dto.disclaimerAccepted) {
      throw new BadRequestException({ code: 'TRIAGE_DISCLAIMER_REQUIRED', message: 'Safety acknowledgement is required.' });
    }
    const selectedSignals = normalizeSignals(dto.signalCodes);
    return this.database.withTransaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '250ms'");
      const ruleSetResult = await client.query<RuleSetRow>(`
        SELECT id::text, version
        FROM clinic_schema.emergency_triage_rule_sets
        WHERE active = true
        ORDER BY activated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `);
      const ruleSet = ruleSetResult.rows[0];
      if (!ruleSet) {
        throw new BadRequestException({ code: 'TRIAGE_RULE_SET_MISSING', message: 'Triage rules are not configured.' });
      }

      const rules = selectedSignals.length === 0 ? [] : (await client.query<RuleRow>(`
        SELECT signal_code, outcome, priority, required_capabilities, owner_message
        FROM clinic_schema.emergency_triage_rules
        WHERE rule_set_id = $1::uuid
          AND signal_code = ANY($2::text[])
          AND species IN ($3::text, 'ALL')
        ORDER BY priority DESC, signal_code ASC
      `, [ruleSet.id, selectedSignals, dto.species])).rows;

      const decision = chooseDecision(rules, selectedSignals);
      const session = await client.query<{ id: string }>(`
        INSERT INTO clinic_schema.emergency_triage_sessions (
          rule_set_id, species, outcome, required_capabilities, owner_message, disclaimer_accepted
        ) VALUES ($1::uuid, $2, $3, $4::text[], $5, true)
        RETURNING id::text
      `, [ruleSet.id, dto.species, decision.outcome, decision.requiredCapabilities, decision.ownerMessage]);

      if (selectedSignals.length > 0) {
        await client.query(`
          INSERT INTO clinic_schema.emergency_triage_answers (session_id, signal_code, selected)
          SELECT $1::uuid, signal_code, true
          FROM unnest($2::text[]) AS selected(signal_code)
          ON CONFLICT (session_id, signal_code) DO NOTHING
        `, [session.rows[0].id, selectedSignals]);
      }

      return {
        sessionId: session.rows[0].id,
        ruleSetVersion: ruleSet.version,
        outcome: decision.outcome,
        requiredCapabilities: decision.requiredCapabilities,
        ownerMessage: decision.ownerMessage,
        selectedSignals,
      };
    });
  }
}

function normalizeSignals(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))];
}

function chooseDecision(rules: RuleRow[], selectedSignals: string[]): {
  outcome: EmergencyTriageOutcome;
  requiredCapabilities: string[];
  ownerMessage: string;
} {
  if (selectedSignals.length === 0 || rules.length === 0) {
    return {
      outcome: 'INSUFFICIENT_DATA',
      requiredCapabilities: [],
      ownerMessage: 'Ответов недостаточно. Если состояние кажется тяжёлым, выбирайте срочную клинику и звоните перед выездом.',
    };
  }
  const strongest = rules[0];
  return {
    outcome: strongest.outcome,
    requiredCapabilities: [...new Set(rules
      .filter((rule) => rule.outcome === strongest.outcome)
      .flatMap((rule) => rule.required_capabilities))]
      .sort(),
    ownerMessage: strongest.owner_message,
  };
}
