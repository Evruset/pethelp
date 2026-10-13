import { BadRequestException } from '@nestjs/common';
import { constants, type ReadStream } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
export type StoredPetDocument={storage_key:string|null;file_name:string|null;mime_type:string|null;file_size_bytes:number|null};
export type PetDocumentDownload={stream:ReadStream;safeFileName:string;mimeType:string;fileSizeBytes:number};
const root=()=>path.resolve(process.env.PET_DOCUMENT_STORAGE_DIR??path.resolve(process.cwd(),'.storage','pet-documents'));
const contained=(base:string,file:string)=>{const relative=path.relative(base,file);return Boolean(relative)&&relative!=='..'&&!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative);};
export function petDocumentStoragePath(key:string){
  const base=root(),resolved=path.resolve(base,key);
  if(!contained(base,resolved))throw new BadRequestException({code:'INVALID_PET_DOCUMENT_STORAGE_KEY',message:'Invalid document storage key.'});
  return resolved;
}
export function safePetDocumentName(value:string){return Buffer.from(path.basename(value.replace(/\\/g,'/')).replace(/[\x00-\x1f\x7f"]/g,'').trim().slice(0,180),'utf8').toString('utf8')||'pet-document';}
export function petDocumentDisposition(name:string,kind:'inline'|'attachment'){
  const safe=safePetDocumentName(name),ascii=safe.replace(/[^\x20-\x7e]/g,'_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/['()*]/g,value=>`%${value.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
export async function openStoredPetDocument(document:StoredPetDocument):Promise<PetDocumentDownload>{
  if(!document.storage_key||!document.mime_type||!Number.isSafeInteger(document.file_size_bytes)||Number(document.file_size_bytes)<=0||document.mime_type.length>127||!/^[-a-z0-9!#$&^_.+]+\/[-a-z0-9!#$&^_.+]+$/i.test(document.mime_type))throw new Error('PET_DOCUMENT_UNAVAILABLE');
  const file=petDocumentStoragePath(document.storage_key);
  let handle:Awaited<ReturnType<typeof open>>|undefined;
  try{
    const [canonicalRoot,canonicalFile]=await Promise.all([realpath(root()),realpath(file)]);
    if(!contained(canonicalRoot,canonicalFile))throw new Error('PET_DOCUMENT_UNAVAILABLE');
    handle=await open(canonicalFile,constants.O_RDONLY|constants.O_NOFOLLOW);
    const info=await handle.stat();
    if(!info.isFile()||info.size!==Number(document.file_size_bytes))throw new Error('PET_DOCUMENT_UNAVAILABLE');
    const stream=handle.createReadStream({autoClose:true});handle=undefined;
    return {stream,safeFileName:safePetDocumentName(document.file_name??'pet-document'),mimeType:document.mime_type,fileSizeBytes:info.size};
  }catch{await handle?.close().catch(()=>undefined);throw new Error('PET_DOCUMENT_UNAVAILABLE');}
}
