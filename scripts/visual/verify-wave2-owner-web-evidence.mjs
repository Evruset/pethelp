import { createHash } from 'node:crypto';import { readFile } from 'node:fs/promises';import { join,resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..'),dir=join(root,'docs/testing/evidence/wave2-owner-web'),manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8')),hash=value=>createHash('sha256').update(value).digest('hex');
if(manifest.renderer!=='OWNER_WEB_NEXT_PRODUCTION_BUILD'||manifest.physicalDevice!==false||manifest.cases?.length!==15||manifest.references?.length<1)throw new Error('WAVE2_EVIDENCE_METADATA_MISMATCH');
for(const [path,digest] of Object.entries(manifest.sources))if(hash(await readFile(join(root,path)))!==digest)throw new Error(`SOURCE_HASH_MISMATCH:${path}`);
for(const item of [...manifest.cases,...manifest.references]){const bytes=await readFile(join(dir,item.file)),width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(hash(bytes)!==item.sha256||bytes.toString('hex',1,4)!=='504e47'||width!==item.width||height<item.height)throw new Error(`CAPTURE_MISMATCH:${item.file}`)}
console.log('Wave 2 Owner Web visual evidence verified: 15/15 + current V50 reference');
