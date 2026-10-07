import { NextResponse } from 'next/server';
import { sharedDocumentDownload } from '@/lib/api/shared-medical-bff';
export async function GET(_request:Request,{params}:{params:Promise<{appointmentId:string;type:string;resourceId:string}>}){
  const value=await params;
  if(value.type!=='DOCUMENT')return NextResponse.json({code:'MEDICAL_SHARE_NOT_FOUND'},{status:404,headers:{'Cache-Control':'private, no-store'}});
  return sharedDocumentDownload(value.appointmentId,value.resourceId);
}
