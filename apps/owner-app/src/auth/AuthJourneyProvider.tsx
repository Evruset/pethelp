import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { ApiError } from '@/api/errors';
import { useSession } from '@/session/SessionProvider';
import { authApi, type AuthApi, type OtpChallenge } from './auth-api';
import { isResumeIntent, type ResumeIntent } from './resume-intent';

type Phase = 'idle' | 'phone' | 'requesting' | 'otp' | 'verifying' | 'resending' | 'conflict';
type AuthMessage = 'INVALID_PHONE' | 'INVALID_OTP' | 'EXPIRED' | 'RATE_LIMITED' | 'DELIVERY_UNAVAILABLE' | 'TEMPORARY_FAILURE' | 'CHALLENGE_CONFLICT' | null;

export function createCommandGate() {
  let active = false;
  return { enter: () => active ? false : (active = true), leave: () => { active = false; } };
}

type AuthJourneyValue = Readonly<{
  phase: Phase;
  phone: string;
  code: string;
  challenge: OtpChallenge | null;
  message: AuthMessage;
  attemptsRemaining?: number;
  retryAt?: string;
  resumedIntent: ResumeIntent | null;
  start(intent?: ResumeIntent): void;
  cancel(): void;
  setPhone(value: string): void;
  setCode(value: string): void;
  requestOtp(): Promise<void>;
  verifyOtp(): Promise<void>;
  resendOtp(): Promise<void>;
  consumeResumedIntent(): void;
}>;

const AuthJourneyContext = createContext<AuthJourneyValue | null>(null);
const PHONE = /^\+[1-9]\d{7,14}$/;
const OTP = /^\d{6}$/;

function mapError(error: unknown): Pick<AuthJourneyValue, 'message' | 'attemptsRemaining' | 'retryAt'> {
  if (!(error instanceof ApiError)) return { message: 'TEMPORARY_FAILURE' };
  if (error.safeCode === 'OTP_INVALID') return { message: 'INVALID_OTP', attemptsRemaining: error.attemptsRemaining };
  if (error.safeCode === 'OTP_EXPIRED') return { message: 'EXPIRED' };
  if (error.safeCode === 'OTP_RATE_LIMITED' || error.safeCode === 'OTP_TEMPORARILY_BLOCKED' || error.safeCode === 'OTP_RESEND_COOLDOWN') return { message: 'RATE_LIMITED', retryAt: error.retryAt };
  if (error.safeCode === 'OTP_PROVIDER_UNAVAILABLE' || error.safeCode === 'OTP_PROVIDER_TIMEOUT' || error.safeCode === 'OTP_PROVIDER_OUTCOME_UNKNOWN') return { message: 'DELIVERY_UNAVAILABLE' };
  if (error.safeCode === 'OTP_CHALLENGE_NOT_FOUND' || error.safeCode === 'OTP_ALREADY_USED' || error.kind === 'CONFLICT') return { message: 'CHALLENGE_CONFLICT' };
  return { message: 'TEMPORARY_FAILURE' };
}

export function AuthJourneyProvider({ children, api = authApi }: PropsWithChildren<{ api?: AuthApi }>) {
  const { establishSession } = useSession();
  const [phase, setPhase] = useState<Phase>('idle');
  const [phone, updatePhone] = useState('');
  const [code, updateCode] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [message, setMessage] = useState<AuthMessage>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>();
  const [retryAt, setRetryAt] = useState<string>();
  const [resumedIntent, setResumedIntent] = useState<ResumeIntent | null>(null);
  const pendingIntent = useRef<ResumeIntent | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const commandGate = useRef(createCommandGate());
  const resetError = () => { setMessage(null); setAttemptsRemaining(undefined); setRetryAt(undefined); };
  const start = useCallback((intent?: ResumeIntent) => {
    if (intent !== undefined && !isResumeIntent(intent)) return;
    generation.current += 1;
    controller.current?.abort();
    pendingIntent.current = intent ?? null;
    updatePhone(''); updateCode(''); setChallenge(null); resetError(); setPhase('phone');
  }, []);
  const cancel = useCallback(() => {
    generation.current += 1;
    controller.current?.abort();
    pendingIntent.current = null;
    updateCode(''); setChallenge(null); resetError(); setPhase('idle');
  }, []);

  const requestOtp = useCallback(async () => {
    const normalized = phone.trim();
    if (!PHONE.test(normalized)) { setMessage('INVALID_PHONE'); return; }
    if (!commandGate.current.enter()) return;
    const current = ++generation.current;
    const abort = new AbortController(); controller.current = abort; resetError(); setPhase('requesting');
    try {
      const next = await api.requestOtp(normalized, abort.signal);
      if (generation.current !== current) return;
      setChallenge(next); updateCode(''); setPhase('otp');
    } catch (error) {
      if (generation.current !== current) return;
      const mapped = mapError(error); setMessage(mapped.message); setAttemptsRemaining(mapped.attemptsRemaining); setRetryAt(mapped.retryAt); setPhase('phone');
    } finally { commandGate.current.leave(); }
  }, [api, phone]);

  const resendOtp = useCallback(async () => {
    if (challenge === null || Date.now() < Date.parse(challenge.resendAvailableAt) || !commandGate.current.enter()) return;
    const current = ++generation.current;
    const abort = new AbortController(); controller.current = abort; resetError(); setPhase('resending');
    try {
      const next = await api.resendOtp(challenge.challengeId, abort.signal);
      if (generation.current !== current) return;
      setChallenge(next); updateCode(''); setPhase('otp');
    } catch (error) {
      if (generation.current !== current) return;
      const mapped = mapError(error); setMessage(mapped.message); setRetryAt(mapped.retryAt);
      setPhase(mapped.message === 'CHALLENGE_CONFLICT' ? 'conflict' : 'otp');
    } finally { commandGate.current.leave(); }
  }, [api, challenge]);

  const verifyOtp = useCallback(async () => {
    if (challenge === null || !commandGate.current.enter()) return;
    if (!OTP.test(code)) { commandGate.current.leave(); setMessage('INVALID_OTP'); return; }
    if (Date.now() >= Date.parse(challenge.expiresAt)) { commandGate.current.leave(); setMessage('EXPIRED'); return; }
    const current = ++generation.current;
    const abort = new AbortController(); controller.current = abort; resetError(); setPhase('verifying');
    try {
      const result = await api.verifyOtp(challenge.challengeId, code, abort.signal);
      if (generation.current !== current) return;
      await establishSession({ opaqueCredential: result.sessionToken, cacheScope: result.owner.id, expiresAtEpochMs: Date.parse(result.expiresAt) });
      if (generation.current !== current) return;
      setResumedIntent(pendingIntent.current); pendingIntent.current = null;
      updateCode(''); setChallenge(null); setPhase('idle');
    } catch (error) {
      if (generation.current !== current) return;

      console.error('[VetHelp auth verify failed]', {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        kind:
          typeof error === 'object' && error !== null && 'kind' in error
            ? String((error as { kind?: unknown }).kind)
            : undefined,
      });

      const mapped = mapError(error); setMessage(mapped.message); setAttemptsRemaining(mapped.attemptsRemaining); setRetryAt(mapped.retryAt);
      setPhase(mapped.message === 'CHALLENGE_CONFLICT' || mapped.message === 'EXPIRED' ? 'conflict' : 'otp');
    } finally { commandGate.current.leave(); }
  }, [api, challenge, code, establishSession]);

  const value = useMemo<AuthJourneyValue>(() => ({
    phase, phone, code, challenge, message, attemptsRemaining, retryAt, resumedIntent,
    start, cancel, setPhone: updatePhone, setCode: (value) => updateCode(value.replace(/\D/g, '').slice(0, 6)),
    requestOtp, verifyOtp, resendOtp, consumeResumedIntent: () => setResumedIntent(null),
  }), [attemptsRemaining, cancel, challenge, code, message, phase, phone, requestOtp, resendOtp, resumedIntent, retryAt, start, verifyOtp]);
  return <AuthJourneyContext.Provider value={value}>{children}</AuthJourneyContext.Provider>;
}

export function useAuthJourney() {
  const value = useContext(AuthJourneyContext);
  if (value === null) throw new Error('useAuthJourney must be used within AuthJourneyProvider');
  return value;
}
