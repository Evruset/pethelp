#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, re, sqlite3
from pathlib import Path
EXT={'.md','.mdx','.txt','.rst','.adoc','.yaml','.yml','.json','.toml'}
SKIP={'.git','.next','node_modules','dist','build','coverage','vendor','playwright-report','test-results','allure-results','logs','.cache','.venv','venv','Pods','DerivedData'}
TARGETS=['docs','README.md','README','.codex/knowledge']; MAX=1_000_000; SIZE=1400; OVER=180
def skip(p,root):
 rel=p.relative_to(root).as_posix(); parts=set(rel.split('/')); return any(x in parts or x in rel for x in SKIP) or rel.startswith('.codex/rag/') or rel.startswith('docs/ai/')
def files(root,targets):
 seen=set()
 for target in targets:
  p=(root/target).resolve()
  if not p.exists(): continue
  for f in ([p] if p.is_file() else p.rglob('*')):
   if not f.is_file() or f in seen or skip(f,root): continue
   if f.suffix.lower() not in EXT and f.name not in {'README','AGENTS.md'}: continue
   if f.stat().st_size>MAX: continue
   seen.add(f); yield f
def chunks(text):
 lines=text.splitlines(); start=0
 while start<len(lines):
  n=0; end=start
  while end<len(lines) and n<SIZE: n+=len(lines[end])+1; end+=1
  content='\n'.join(lines[start:end]).strip()
  heading=''
  for i in range(start,max(-1,start-80),-1):
   if re.match(r'^#{1,6}\s+',lines[i].strip()): heading=re.sub(r'^#{1,6}\s+','',lines[i].strip())[:200]; break
  if content: yield start+1,end,heading,content
  if end>=len(lines): break
  ov=0; nxt=end
  while nxt>start and ov<OVER: nxt-=1; ov+=len(lines[nxt])+1
  start=max(start+1,nxt)
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--root',required=True); ap.add_argument('--db',required=True); ap.add_argument('--target',action='append',dest='targets'); a=ap.parse_args()
 root=Path(a.root).resolve(); db=Path(a.db).resolve(); db.parent.mkdir(parents=True,exist_ok=True)
 con=sqlite3.connect(db); con.executescript("PRAGMA journal_mode=WAL; DROP TABLE IF EXISTS chunks; CREATE VIRTUAL TABLE chunks USING fts5(path UNINDEXED, heading, content, start_line UNINDEXED, end_line UNINDEXED, digest UNINDEXED, tokenize='unicode61 remove_diacritics 2');")
 fc=cc=0
 for f in files(root,a.targets or TARGETS):
  text=f.read_text(encoding='utf-8',errors='replace'); rel=f.relative_to(root).as_posix(); fc+=1
  for s,e,h,c in chunks(text): con.execute('INSERT INTO chunks VALUES (?,?,?,?,?,?)',(rel,h,c,s,e,hashlib.sha1(f'{rel}:{s}:{c}'.encode()).hexdigest())); cc+=1
 con.commit(); con.close(); print(f'Indexed {fc} files / {cc} chunks into {db}')
if __name__=='__main__': main()
