#!/usr/bin/env python3
"""Notify IndexNow only after the public key and every submitted page are deployed."""
import json,urllib.request,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
key=(root/'scripts/discovery/indexnow-key-name.txt').read_text().strip()
base='https://qiaoboose.com'
keyurl=base+'/'+key+'.txt'
assert urllib.request.urlopen(keyurl,timeout=30).read().decode().strip()==key,'Public verification key mismatch'
manifest=json.loads((root/'scripts/discovery/manifest.json').read_text())
payload={'host':'qiaoboose.com','key':key,'keyLocation':keyurl,'urlList':[base+p for p in manifest['pages']]}
request=urllib.request.Request('https://api.indexnow.org/indexnow',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json; charset=utf-8'},method='POST')
with urllib.request.urlopen(request,timeout=45) as r:
 print(json.dumps({'status':r.status,'submittedURLs':len(payload['urlList']),'note':'Submission acknowledgement is not indexing confirmation.'}))
