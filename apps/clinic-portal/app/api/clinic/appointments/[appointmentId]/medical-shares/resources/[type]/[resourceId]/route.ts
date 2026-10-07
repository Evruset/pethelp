import { sharedMedicalRead } from '@/lib/api/shared-medical-bff';
import type { SharedRef } from '@/lib/api/shared-medical';
export async function GET(_request:Request,{params}:{params:Promise<{appointmentId:string;type:string;resourceId:string}>}){const value=await params;return sharedMedicalRead(value.appointmentId,{type:value.type as SharedRef['type'],id:value.resourceId});}
