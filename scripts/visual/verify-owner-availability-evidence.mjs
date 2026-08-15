import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const evidence=join(root,'docs/testing/evidence/s11-owner-availability');
const manifest=JSON.parse(await readFile(join(evidence,'manifest.json'),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=await readFile(join(root,manifest.source));
if(digest(source)!==manifest.sourceSha256)throw new Error('Availability evidence source hash mismatch');
if(manifest.physicalDevice!==false||manifest.cases?.length!==3)throw new Error('Availability evidence metadata mismatch');
for(const item of manifest.cases){const bytes=await readFile(join(evidence,item.file));if(digest(bytes)!==item.sha256)throw new Error(`${item.file} hash mismatch`);if(bytes.toString('hex',1,4)!=='504e47')throw new Error(`${item.file} is not PNG`);if(bytes.readUInt32BE(16)!==item.width||bytes.readUInt32BE(20)!==item.height)throw new Error(`${item.file} dimensions mismatch`);}
const names=manifest.cases.map(item=>item.name).sort().join(',');
if(names!=='compact-content,standard-selected,wide-empty')throw new Error('Availability evidence state matrix mismatch');
console.log('Owner availability visual evidence verified: 3/3');
