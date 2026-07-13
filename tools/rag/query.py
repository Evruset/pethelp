#!/usr/bin/env python3
from __future__ import annotations
import argparse,re,sqlite3
from pathlib import Path
def query(s):
 terms=[x for x in re.findall(r'[\w.-]+',s.lower(),flags=re.UNICODE) if len(x)>1][:12]
 if not terms: raise ValueError('No searchable terms')
 return ' OR '.join('"'+x.replace('"','')+'"' for x in terms)
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('query'); ap.add_argument('--db',required=True); ap.add_argument('--top',type=int,default=5); ap.add_argument('--max-chars',type=int,default=6000); a=ap.parse_args(); db=Path(a.db)
 if not db.exists(): print(f'RAG index not found: {db}\nRun ./scripts/rag-index.sh first.'); raise SystemExit(2)
 con=sqlite3.connect(db); rows=con.execute('SELECT path,heading,content,start_line,end_line,bm25(chunks) FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks) LIMIT ?',(query(a.query),max(1,min(a.top,10)))).fetchall(); con.close()
 if not rows: print('No relevant documentation chunks found.'); raise SystemExit(1)
 used=0
 for i,(p,h,c,s,e,score) in enumerate(rows,1):
  block=f'## {i}. {p}:{s}-{e}'+(f' — {h}' if h else '')+f'\n\n{c.strip()}\n'; remain=a.max_chars-used
  if remain<=0: break
  if len(block)>remain: block=block[:remain].rstrip()+'\n…\n'
  print(block); used+=len(block)
if __name__=='__main__': main()
