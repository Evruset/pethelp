import {createHash,randomUUID} from 'node:crypto';
import type {OcrExtraction,OcrSource} from './ocr-provider';
export type ByteContext={jobId:string;attemptId:string;versionId:string;sha256:string;byteLength:number;source:OcrSource};
export type VerifiedByteInput=Readonly<ByteContext & {bytes:Buffer}>;
export type ExecutionReceipt=Readonly<ByteContext & {invocationId:string;startedAt:Date;finishedAt:Date;adapterIdentity:string;adapterVersion?:string;evidenceClass:'ACTUAL_BYTE_INPUT'|'SIMULATED_METADATA_ONLY';origin:'TEST_CONSUMER'|'SIMULATED_PROVIDER';fullConsumption:boolean;consumedLength:number;consumedSha256:string|null;extractionIdentity:string}>;
export type OcrExecution={extraction:OcrExtraction};
const receipts=new WeakMap<object,ExecutionReceipt>();
export const extractionHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class ByteEvidenceError extends Error {constructor(){super('OCR_BYTE_EVIDENCE_INVALID');}}
function seal(input:VerifiedByteInput,extraction:OcrExtraction,data:Omit<ExecutionReceipt,keyof ByteContext|'extractionIdentity'>):OcrExecution{
 const result=Object.freeze({extraction:Object.freeze({...extraction})});
 receipts.set(result,Object.freeze({jobId:input.jobId,attemptId:input.attemptId,versionId:input.versionId,sha256:input.sha256,byteLength:input.byteLength,source:Object.freeze({...input.source}),...data,extractionIdentity:extractionHash(result.extraction)}));return result;
}
export function trustedExecutionReceipt(value:unknown):ExecutionReceipt{
 if(!value||typeof value!=='object'||!receipts.has(value))throw new ByteEvidenceError();return receipts.get(value)!;
}
/** Simulation deliberately ignores bytes; its receipt can never qualify as actual input. */
export async function simulatedByteExecution(input:VerifiedByteInput,signal:AbortSignal,extract:()=>Promise<OcrExtraction>):Promise<OcrExecution>{
 const startedAt=new Date(),extraction=await extract();if(signal.aborted)throw new ByteEvidenceError();
 return seal(input,extraction,{invocationId:randomUUID(),startedAt,finishedAt:new Date(),adapterIdentity:'SIMULATED_OCR',evidenceClass:'SIMULATED_METADATA_ONLY',origin:'SIMULATED_PROVIDER',fullConsumption:false,consumedLength:0,consumedSha256:null});
}
/** Test transport only. No production actual OCR adapter is registered or provided. */
export abstract class TestOnlyByteOcrAdapter {
 protected async consume(input:VerifiedByteInput,signal:AbortSignal,consumer:(chunks:AsyncIterable<Buffer>)=>Promise<{extraction:OcrExtraction;consumedLength:number;consumedSha256:string}>):Promise<OcrExecution>{
  if(process.env.NODE_ENV!=='test'||process.env.W4B03A02_ACCEPTANCE!=='true')throw new ByteEvidenceError();
  const startedAt=new Date(),retainedHash=createHash('sha256').update(input.bytes).digest('hex');let delivered=0,complete=false;
  if(retainedHash!==input.sha256||input.bytes.length!==input.byteLength||signal.aborted)throw new ByteEvidenceError();
  async function* chunks(){for(let offset=0;offset<input.bytes.length;offset+=65536){if(signal.aborted)throw new ByteEvidenceError();const chunk=Buffer.from(input.bytes.subarray(offset,offset+65536)),before=createHash('sha256').update(chunk).digest('hex');yield chunk;if(signal.aborted||createHash('sha256').update(chunk).digest('hex')!==before)throw new ByteEvidenceError();delivered+=chunk.length;}complete=true;}
  const consumed=await consumer(chunks());
  if(signal.aborted||!complete||delivered!==input.byteLength||consumed.consumedLength!==input.byteLength||consumed.consumedSha256!==input.sha256||createHash('sha256').update(input.bytes).digest('hex')!==retainedHash)throw new ByteEvidenceError();
  return seal(input,consumed.extraction,{invocationId:randomUUID(),startedAt,finishedAt:new Date(),adapterIdentity:'TEST_BYTE_CONSUMER',adapterVersion:'1',evidenceClass:'ACTUAL_BYTE_INPUT',origin:'TEST_CONSUMER',fullConsumption:true,consumedLength:consumed.consumedLength,consumedSha256:consumed.consumedSha256});
 }
 abstract extractVerified(input:VerifiedByteInput,signal:AbortSignal):Promise<OcrExecution>;
}
