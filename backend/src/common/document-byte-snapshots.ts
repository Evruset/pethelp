import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
export const SNAPSHOT_MAX_BYTES=10*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export type ByteSnapshot={versionId:string;storageObjectId:string;storageKey:string;sha256:string;byteLength:number};
const denied=()=>new Error('DOCUMENT_SNAPSHOT_UNAVAILABLE');
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
/** Trusted publisher filesystem only. OS-root/publisher can still mutate; every use rehashes. */
export async function protectedSnapshotRoot():Promise<string>{
 const value=process.env.PET_DOCUMENT_STORAGE_DIR;
 if(!value||!path.isAbsolute(value)||path.resolve(value)!==value)throw denied();
 await protectedAncestors(value,true);return value;
}
async function protectedAncestors(value:string,privateRoot=false){
 const parts=value.split(path.sep).filter(Boolean);let cursor=path.parse(value).root;
 for(const part of ['',...parts]){
  if(part)cursor=path.join(cursor,part);
  const s=await lstat(cursor),uid=process.getuid?.();
  if(s.isSymbolicLink()||!s.isDirectory()||(s.mode&0o022)!==0||(s.uid!==0&&s.uid!==uid))throw denied();
  if(privateRoot&&cursor===value&&((s.mode&0o077)!==0||s.uid!==uid))throw denied();
 }
}
async function readExact(file:string,length:number):Promise<Buffer>{
 let fd:Awaited<ReturnType<typeof open>>|undefined;
 try{
  fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);const before=await fd.stat();
  if(!before.isFile()||before.nlink!==1||before.uid!==process.getuid?.()||(before.mode&0o022)!==0||before.size!==length||length<1||length>SNAPSHOT_MAX_BYTES)throw denied();
  const output=Buffer.alloc(length);let offset=0;
  while(offset<length){const n=(await fd.read(output,offset,length-offset,offset)).bytesRead;if(!n)throw denied();offset+=n;}
  if((await fd.read(Buffer.alloc(1),0,1,length)).bytesRead)throw denied();
  const after=await fd.stat();if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs||before.ino!==after.ino||after.nlink!==1)throw denied();
  return output;
 }catch{throw denied();}finally{await fd?.close().catch(()=>undefined);}
}
export async function readVerifiedSnapshot(snapshot:Pick<ByteSnapshot,'storageObjectId'|'sha256'|'byteLength'>):Promise<Buffer>{
 try{
  if(!uuid.test(snapshot.storageObjectId)||! /^[0-9a-f]{64}$/.test(snapshot.sha256)||!Number.isSafeInteger(snapshot.byteLength))throw denied();
  const root=await protectedSnapshotRoot(),bytes=await readExact(path.join(root,snapshot.storageObjectId+'.blob'),snapshot.byteLength);
  if(hash(bytes)!==snapshot.sha256)throw denied();return bytes;
 }catch{throw denied();}
}
export async function publishByteSnapshot(input:Buffer,declaredLength?:number):Promise<ByteSnapshot>{
 // Bound before allocation, then copy before awaiting: caller cannot change publication bytes.
 if(!Buffer.isBuffer(input)||input.length<1||input.length>SNAPSHOT_MAX_BYTES||(declaredLength!==undefined&&declaredLength!==input.length))throw denied();
 const bytes=Buffer.from(input);
 let fd:Awaited<ReturnType<typeof open>>|undefined,dir:Awaited<ReturnType<typeof open>>|undefined;
 try{
  const root=await protectedSnapshotRoot(),storageObjectId=randomUUID(),versionId=randomUUID(),storageKey=storageObjectId+'.blob';
  fd=await open(path.join(root,storageKey),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  await fd.writeFile(bytes);await fd.sync();await fd.chmod(0o400);await fd.sync();await fd.close();fd=undefined;
  dir=await open(root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);await dir.sync();await dir.close();dir=undefined;
  const result={versionId,storageObjectId,storageKey,sha256:hash(bytes),byteLength:bytes.length};await readVerifiedSnapshot(result);return result;
 }catch{throw denied();}finally{await fd?.close().catch(()=>undefined);await dir?.close().catch(()=>undefined);}
 // On failure an unpublished private object may remain; no published evidence is deleted.
}
export async function readObservedLegacyBytes(key:string,length:number):Promise<Buffer>{
 try{
  const root=await protectedSnapshotRoot(),file=path.resolve(root,key),relative=path.relative(root,file);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw denied();
  await protectedAncestors(path.dirname(file));return await readExact(file,length);
 }catch{throw denied();}
}
/** Internal reconciliation inventory only; never a public route or an automatic purge. */
export async function snapshotObjectInventory(limit=1000):Promise<string[]>{
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw denied();
 const root=await protectedSnapshotRoot(),out:string[]=[];let scanned=0;
 const directory=await import('node:fs/promises').then(fs=>fs.opendir(root));
 try{for await(const entry of directory){scanned++;if(entry.isFile()&&entry.name.endsWith('.blob')&&uuid.test(entry.name.slice(0,-5)))out.push(entry.name.slice(0,-5));if(out.length===limit||scanned===1000)break;}}finally{await directory.close().catch(()=>undefined);}
 return out;
}
