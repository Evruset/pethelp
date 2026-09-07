import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const dir=join(root,'docs/testing/evidence/s14-owner-booking-decision');
const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
for(const [source,expected] of Object.entries(manifest.sources??{})){if(digest(await readFile(join(root,source)))!==expected)throw new Error(`${source} source hash mismatch`);}
if(manifest.physicalDevice!==false||manifest.cases?.length!==7||!manifest.renderer?.startsWith('RN_WEB_EVIDENCE_RENDERER'))throw new Error('S14 Owner evidence metadata mismatch');
if(manifest.references?.length!==2)throw new Error('S14 Owner V50 reference matrix mismatch');
for(const item of [...manifest.cases,...manifest.references]){const bytes=await readFile(join(dir,item.file));if(digest(bytes)!==item.sha256||bytes.toString('hex',1,4)!=='504e47'||bytes.readUInt32BE(16)!==item.width||bytes.readUInt32BE(20)!==item.height)throw new Error(`${item.file} evidence mismatch`);}
if(manifest.cases.map(item=>item.name).sort().join()!=='compact-expired,compact-near-expiry,compact-pending,compact-rejected,compact-stale-payload,tablet-confirmed,tablet-network-retry')throw new Error('S14 Owner state matrix mismatch');
console.log('Owner booking decision visual evidence verified: 7/7');
