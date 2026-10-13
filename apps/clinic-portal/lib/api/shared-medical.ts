export const MEDICAL_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type SharedRef={type:'RESULT'|'AMENDMENT'|'DOCUMENT';id:string};
export type SharedResource=SharedRef&({type:'RESULT';content:string;publishedAt:string}|{type:'AMENDMENT';content:string;publishedAt:string;version:number}|{type:'DOCUMENT';fileName:string|null;mimeType:string|null;createdAt:string});
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const invalid=()=>new Error('INVALID_SHARED_MEDICAL_RESPONSE');
const timestamp=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,19)===value.slice(0,19);
export function parseSharedList(value:unknown,appointmentId:string):SharedRef[]{
  if(!object(value)||!exact(value,['appointmentId','status','resources'])||value.appointmentId!==appointmentId||!MEDICAL_UUID.test(appointmentId)||!Array.isArray(value.resources)||!['SHARED','NOT_SHARED'].includes(String(value.status)))throw invalid();
  const refs=value.resources.map(item=>{if(!object(item)||!exact(item,['type','id'])||!['RESULT','AMENDMENT','DOCUMENT'].includes(String(item.type))||typeof item.id!=='string'||!MEDICAL_UUID.test(item.id))throw invalid();return {type:item.type as SharedRef['type'],id:item.id};});
  if(new Set(refs.map(ref=>`${ref.type}:${ref.id}`)).size!==refs.length||(value.status==='SHARED')!==Boolean(refs.length))throw invalid();return refs;
}
export function parseSharedResource(value:unknown,expected:SharedRef):SharedResource{
  if(!object(value)||value.type!==expected.type||value.id!==expected.id||!MEDICAL_UUID.test(expected.id))throw invalid();
  if(expected.type==='DOCUMENT'){
    if(!exact(value,['type','id','fileName','mimeType','createdAt'])||!timestamp(value.createdAt)||!(value.fileName===null||typeof value.fileName==='string')||!(value.mimeType===null||typeof value.mimeType==='string'))throw invalid();
  }else if(!exact(value,expected.type==='RESULT'?['type','id','content','publishedAt']:['type','id','content','publishedAt','version'])||typeof value.content!=='string'||!timestamp(value.publishedAt)||expected.type==='AMENDMENT'&&(!Number.isSafeInteger(value.version)||Number(value.version)<1))throw invalid();
  return value as SharedResource;
}
