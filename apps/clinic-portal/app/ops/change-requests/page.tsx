import {redirect} from 'next/navigation';
import {ChangeRequestWorkspace} from '@/components/ops/ChangeRequestWorkspace';
import {ChangeRequestBackendError,getChangeRequests} from '@/lib/api/booking-change-requests';
import {canAccessBookingChangeRequests,getClinicSession} from '@/lib/auth/clinic-session';
import {getEffectiveSession,hasCapability} from '@/lib/auth/effective-session';
export const dynamic='force-dynamic';
export default async function Page(){const session=await getClinicSession();if(!session||!canAccessBookingChangeRequests(session))redirect('/forbidden');let effective;try{effective=await getEffectiveSession(session);}catch{return <ChangeRequestWorkspace initial={null} initialError="SESSION_UNAVAILABLE"/>;}if(!hasCapability(effective,'booking.change-request.read'))redirect('/forbidden');try{return <ChangeRequestWorkspace initial={await getChangeRequests(session)} initialError={null}/>;}catch(error){if(error instanceof ChangeRequestBackendError&&error.status===403)redirect('/forbidden');return <ChangeRequestWorkspace initial={null} initialError="BACKEND_UNAVAILABLE"/>;}}
