import { sharedMedicalRead } from '@/lib/api/shared-medical-bff';
export async function GET(_request:Request,{params}:{params:Promise<{appointmentId:string}>}){return sharedMedicalRead((await params).appointmentId);}
