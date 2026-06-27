import { Role, JwtPayload } from '../../auth/auth.types';
import { DomainException } from '../../common/domain-error';
import { DatabaseService } from '../../database/database.service';
import { TelemedService } from './telemed.service';
import { TelemedVetWorkspaceService } from './telemed-vet-workspace.service';

const VET_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_VET_ID = '55555555-5555-4555-8555-555555555555';
const CASE_ID = '66666666-6666-4666-8666-666666666666';
const INTAKE_ID = '77777777-7777-4777-8777-777777777777';
const PET_ID = '22222222-2222-4222-8222-222222222222';

const veterinarian: JwtPayload = {
  sub: VET_ID,
  roles: [Role.TELEMED_VETERINARIAN],
};

function caseRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-06-27T10:45:00.000Z');
  return {
    case_id: CASE_ID,
    state: 'QUEUED',
    queue_priority: 110,
    urgency_band: 'ROUTINE',
    service_level: 'STANDARD',
    safety_escalation: false,
    recommendation_text: null,
    follow_up_notes: null,
    assigned_employee_id: null,
    assigned_at: null,
    created_at: now,
    updated_at: now,
    intake_id: INTAKE_ID,
    category: 'GENERAL_QUESTION',
    symptom_duration: 'NO_SYMPTOMS',
    prior_clinic_visit: false,
    emergency_red_flags: [],
    pet_id: PET_ID,
    pet_name: 'Demo Pet',
    pet_species: 'DOG',
    pet_breed: null,
    pet_birth_date: null,
    pet_weight_kg: null,
    pet_allergies: [],
    pet_chronic_conditions: [],
    latest_event_type: null,
    latest_event_at: null,
    session_id: null,
    session_state: null,
    session_expires_at: null,
    ...overrides,
  };
}

function serviceWith(query: jest.Mock) {
  const database = {
    withTransaction: async (work: (client: { query: jest.Mock }) => Promise<unknown>) =>
      work({ query }),
  } as unknown as DatabaseService;

  return new TelemedVetWorkspaceService(database, {} as TelemedService);
}

describe('TelemedVetWorkspaceService', () => {
  it('shows queued cases and only cases assigned to the requesting veterinarian', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT clock_timestamp() AS now')) {
        return { rows: [{ now: new Date('2026-06-27T10:45:00.000Z') }] };
      }
      if (sql.includes('FROM telemed_schema.telemed_cases telemed_case')) {
        return {
          rows: [
            caseRow(),
            caseRow({
              case_id: '88888888-8888-4888-8888-888888888888',
              state: 'ASSIGNED',
              assigned_employee_id: VET_ID,
            }),
          ],
        };
      }
      return { rows: [] };
    });

    const result = await serviceWith(query).queue({
      employee: veterinarian,
      limit: 50,
    });

    const queueCall = query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('FROM telemed_schema.telemed_cases telemed_case'),
    ) as unknown as [string, unknown[]];

    expect(queueCall[0]).toContain("telemed_case.state = 'QUEUED'");
    expect(queueCall[0]).toContain('telemed_case.assigned_employee_id = $1::uuid');
    expect(queueCall[1]).toEqual([VET_ID, 50]);
    expect(result.availableCases.map((item) => item.caseId)).toEqual([CASE_ID]);
    expect(result.assignedCases.map((item) => item.assignedEmployeeId)).toEqual([VET_ID]);
  });

  it('rejects workspace changes from another veterinarian before mutating the case', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT assigned_employee_id')) {
        return { rows: [{ assigned_employee_id: OTHER_VET_ID }] };
      }
      return { rows: [] };
    });

    try {
      await serviceWith(query).updateWorkspace({
        caseId: CASE_ID,
        employee: veterinarian,
        dto: { followUpNotes: 'Attempt by another veterinarian' },
      });
      throw new Error('Expected TELEMED_CASE_ASSIGNEE_MISMATCH');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      const domainError = error as DomainException;
      expect(domainError.getStatus()).toBe(403);
      expect(domainError.getResponse()).toMatchObject({
        code: 'TELEMED_CASE_ASSIGNEE_MISMATCH',
      });
    }

    expect(query.mock.calls.some(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE telemed_schema.telemed_cases'),
    )).toBe(false);
  });

  it('pins workspace updates to the assigned veterinarian in the SQL predicate', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT assigned_employee_id')) {
        return { rows: [{ assigned_employee_id: VET_ID }] };
      }
      if (sql.includes('UPDATE telemed_schema.telemed_cases')) {
        return { rows: [{ id: CASE_ID }] };
      }
      if (sql.includes('FROM telemed_schema.telemed_cases telemed_case')) {
        return {
          rows: [caseRow({
            state: 'ASSIGNED',
            assigned_employee_id: VET_ID,
            follow_up_notes: 'Нужно наблюдение.',
          })],
        };
      }
      return { rows: [] };
    });

    const result = await serviceWith(query).updateWorkspace({
      caseId: CASE_ID,
      employee: veterinarian,
      dto: { followUpNotes: 'Нужно наблюдение.' },
    });

    const updateCall = query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE telemed_schema.telemed_cases'),
    ) as unknown as [string, unknown[]];

    expect(updateCall[0]).toContain('assigned_employee_id = $2::uuid');
    expect(updateCall[1]).toEqual([
      CASE_ID,
      VET_ID,
      null,
      null,
      'Нужно наблюдение.',
    ]);
    expect(result.assignedEmployeeId).toBe(VET_ID);
    expect(result.followUpNotes).toBe('Нужно наблюдение.');
  });
});
