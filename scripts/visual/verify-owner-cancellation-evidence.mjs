import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const dir=join(root,'docs/testing/evidence/s16-owner-cancellation');
const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
if(digest(await readFile(join(root,manifest.source)))!==manifest.sourceSha256)throw new Error('S16 Owner source hash mismatch');
if(manifest.physicalDevice!==false||manifest.cases?.length!==5)throw new Error('S16 Owner evidence metadata mismatch');
for(const item of manifest.cases){const bytes=await readFile(join(dir,item.file));if(digest(bytes)!==item.sha256||bytes.toString('hex',1,4)!=='504e47'||bytes.readUInt32BE(16)!==item.width||bytes.readUInt32BE(20)!==item.height)throw new Error(`${item.file} evidence mismatch`);}
const expected='compact-cancellable-pending,compact-cancelled,compact-confirmation,compact-submitting,wide-stale-conflict';
if(manifest.cases.map(item=>item.name).sort().join()!==expected)throw new Error('S16 Owner state matrix mismatch');
console.log('Owner cancellation visual evidence verified: 5/5');
