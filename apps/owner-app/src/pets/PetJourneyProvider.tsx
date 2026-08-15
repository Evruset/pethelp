import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useSession } from '@/session/SessionProvider';
import { petApi, type Pet, type PetApi, type PetSpecies } from './pet-api';

type PetJourney = Readonly<{
  active: boolean; continuedPetId: string | null; pets: Pet[]; selectedPetId: string | null; selectionStale: boolean; loading: boolean; error: boolean; creating: boolean; createError: boolean;
  start(): void; cancel(): void; select(petId: string): void; retry(): void;
  continueSelection(): void;
  create(input: { name: string; species: PetSpecies }): Promise<void>;
}>;
const Context = createContext<PetJourney | null>(null);
const randomKey = () => {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error('SECURE_RANDOM_UNAVAILABLE');
  return value;
};
export function continuedPetForScope(selection:{scope:string;petId:string}|null,status:string,scope?:string){return status==='authenticated'&&selection!==null&&selection.scope===scope?selection.petId:null;}

export function PetJourneyProvider({ children, api = petApi }: PropsWithChildren<{ api?: PetApi }>) {
  const { session, status } = useSession();
  const queryClient = useQueryClient();
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const [storedSelection, setSelected] = useState<string | null>(null);
  const selectionRef = useRef<string | null>(null);
  const [selectionStale, setSelectionStale] = useState(false);
  const [continuedSelection, setContinuedSelection] = useState<{ scope: string; petId: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const pendingCreate = useRef<{ fingerprint: string; key: string } | null>(null);
  const active = status === 'authenticated' && activeScope !== null && activeScope === session?.cacheScope;
  const continuedPetId = continuedPetForScope(continuedSelection,status,session?.cacheScope);
  const key = useMemo(() => ['owner', session?.cacheScope, 'pets'] as const, [session?.cacheScope]);
  const query = useQuery({ queryKey: key, enabled: active && status === 'authenticated' && session !== null, queryFn: async ({ signal }) => {
    const items = await api.list(session!.opaqueCredential, signal);
    if (selectionRef.current && !items.some((item) => item.petId === selectionRef.current)) { selectionRef.current=null; setSelected(null); setSelectionStale(true); }
    else if (!selectionRef.current && items.length === 1) { selectionRef.current=items[0].petId; setSelected(items[0].petId); setSelectionStale(false); }
    return items;
  } });
  const pets = useMemo(() => query.data ?? [], [query.data]);
  const selectedPetId = pets.some((item) => item.petId === storedSelection) ? storedSelection : pets.length === 1 ? pets[0].petId : null;
  const select = useCallback((petId:string) => { selectionRef.current=petId; setSelected(petId); setSelectionStale(false); }, []);
  const start = useCallback(() => { selectionRef.current=null; setSelected(null); setSelectionStale(false); setContinuedSelection(null); pendingCreate.current = null; setCreateError(false); setActiveScope(session?.cacheScope ?? null); }, [session?.cacheScope]);
  const cancel = useCallback(() => { selectionRef.current=null; setSelected(null); setSelectionStale(false); setContinuedSelection(null); pendingCreate.current = null; setCreateError(false); setActiveScope(null); }, []);
  const create = useCallback(async (input: { name: string; species: PetSpecies }) => {
    if (!session || creating) return;
    const fingerprint = JSON.stringify({ name: input.name.trim(), species: input.species });
    if (pendingCreate.current?.fingerprint !== fingerprint) pendingCreate.current = { fingerprint, key: randomKey() };
    setCreating(true); setCreateError(false);
    try {
      const created = await api.create(session.opaqueCredential, input, pendingCreate.current.key);
      queryClient.setQueryData<Pet[]>(key, (current = []) => [...current, created].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.petId.localeCompare(b.petId)));
      selectionRef.current=created.petId; setSelected(created.petId); setSelectionStale(false); pendingCreate.current = null;
    } catch { setCreateError(true); throw new Error('PET_CREATE_FAILED'); }
    finally { setCreating(false); }
  }, [api, creating, key, queryClient, session]);
  const continueSelection = useCallback(() => { if (selectedPetId && session?.cacheScope) { setContinuedSelection({scope:session.cacheScope,petId:selectedPetId}); setActiveScope(null); } }, [selectedPetId, session]);
  const value = useMemo(() => ({ active, continuedPetId, pets, selectedPetId, selectionStale, loading: query.isLoading, error: query.isError, creating, createError, start, cancel, select, retry: () => { void query.refetch(); }, create, continueSelection }), [active, cancel, continueSelection, continuedPetId, create, createError, creating, pets, query, select, selectedPetId, selectionStale, start]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePetJourney() { const value = useContext(Context); if (!value) throw new Error('usePetJourney must be used within PetJourneyProvider'); return value; }
