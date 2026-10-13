import { mkdtemp,writeFile,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStoredPetDocument,petDocumentDisposition,petDocumentStoragePath,safePetDocumentName } from './pet-document-storage';
describe('Shared trusted document storage primitive',()=>{
  let directory:string;let external:string;const previous=process.env.PET_DOCUMENT_STORAGE_DIR;
  beforeEach(async()=>{directory=await mkdtemp(path.join(tmpdir(),'pethelp-storage-test-'));process.env.PET_DOCUMENT_STORAGE_DIR=directory;await writeFile(path.join(directory,'file.pdf'),Buffer.from('private bytes'));});
  afterEach(async()=>{if(previous===undefined)delete process.env.PET_DOCUMENT_STORAGE_DIR;else process.env.PET_DOCUMENT_STORAGE_DIR=previous;await rm(directory,{recursive:true,force:true});if(external)await rm(external,{recursive:true,force:true});});
  const metadata=()=>({storage_key:'file.pdf',file_name:'history.pdf',mime_type:'application/pdf',file_size_bytes:13});
  it('opens verified descriptor and returns bytes without path/key',async()=>{const download=await openStoredPetDocument(metadata());const chunks=[];for await(const chunk of download.stream)chunks.push(chunk);expect(Buffer.concat(chunks).toString()).toBe('private bytes');expect(Object.keys(download).sort()).toEqual(['stream','safeFileName','mimeType','fileSizeBytes'].sort());});
  it('rejects missing, traversal, outside symlink and size mismatch without path errors',async()=>{
    expect(()=>petDocumentStoragePath('../outside')).toThrow();
    external=await mkdtemp(path.join(tmpdir(),'pethelp-external-test-'));await writeFile(path.join(external,'file.pdf'),'private bytes');await symlink(external,path.join(directory,'outside'));
    for(const document of [{...metadata(),storage_key:'missing.pdf'},{...metadata(),storage_key:'outside/file.pdf'},{...metadata(),file_size_bytes:1},{...metadata(),mime_type:'application/pdf\r\nInjected: yes'}])await expect(openStoredPetDocument(document)).rejects.toThrow('PET_DOCUMENT_UNAVAILABLE');
  });
  it('sanitizes actual controls, path segments and Unicode disposition',()=>{
    expect(safePetDocumentName('..\\directory\\report\r\n".pdf')).toBe('report.pdf');
    const header=petDocumentDisposition('История\r\n".pdf','attachment');expect(header).not.toMatch(/[\r\n]/);expect(header).toContain("filename*=UTF-8''");expect(header).not.toContain('История');
  });
});
