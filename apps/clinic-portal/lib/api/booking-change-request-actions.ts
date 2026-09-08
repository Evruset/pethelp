export type ChangeRequestCommand='start'|'complete'|'reject'|'cancel';
export function allowedChangeRequestCommands(status:string,canProcess:boolean):ChangeRequestCommand[]{if(!canProcess)return[];if(status==='OPEN')return['start','cancel'];if(status==='PROCESSING')return['complete','reject','cancel'];return[];}
export function canApplyChangeRequest(type:string,status:string,replacementSlotId:string,canProcess:boolean):boolean{return canProcess&&status==='PROCESSING'&&(type==='CANCEL'||(type==='RESCHEDULE'&&replacementSlotId.length>0));}
export function commandFingerprint(requestId:string,command:string,version:number,replacementSlotId:string):string{return `${requestId}:${command}:${version}:${replacementSlotId}`;}
export function stableCommandKey(keys:Map<string,string>,fingerprint:string,create:()=>string):string{const existing=keys.get(fingerprint);if(existing)return existing;const key=create();keys.set(fingerprint,key);return key;}
export function isDefinitiveCommandResponse(status:number):boolean{return status>=400&&status<500;}
