#!/usr/bin/env python3
"""Verify the deployed page bytes and HTTP behavior, not just a deployment status."""
import concurrent.futures, hashlib, json, urllib.request, urllib.error
from pathlib import Path
root=Path(__file__).resolve().parents[2];base='https://qiaoboose.com'
m=json.loads((root/'scripts/discovery/manifest.json').read_text())
def get(path,ua='Qiaoboose-SEO-Check/1.0'):
    req=urllib.request.Request(base+path,headers={'User-Agent':ua})
    try:
        with urllib.request.urlopen(req,timeout=30) as r:return r.status,r.url,dict(r.headers),r.read()
    except urllib.error.HTTPError as e:return e.code,e.url,dict(e.headers),e.read()
def verify(path):
    status,url,headers,data=get(path)
    file=root/(path.lstrip('/')+'index.html' if path.endswith('/') else path.lstrip('/'))
    assert status==200,(path,status)
    assert hashlib.sha256(file.read_bytes()).digest()==hashlib.sha256(data).digest(),('deployed bytes differ',path)
    return {'path':path,'status':status,'sha256':hashlib.sha256(data).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:results=list(ex.map(verify,m['pages']))
for path,wanted in [('/robots.txt','User-agent:'),('/sitemap.xml','<urlset')]:
    status,_,headers,data=get(path);assert status==200 and wanted.encode() in data,(path,status)
    assert 'text/html' not in headers.get('Content-Type',''),('wrong media type',path)
    assert data==(root/path.lstrip('/')).read_bytes(),('config mismatch',path)
for id in m['articleIds']:
    status,url,_,data=get('/article.html?id='+id)
    assert status==200 and url==base+'/read/'+id+'/',('legacy redirect',id,url)
for path in ['/seo-nonexistent-20261113','/guides/not-a-page/','/scripts/discovery/manifest.json','/output/']:
    assert get(path)[0]==404,('expected real 404',path)
for path in ['/crm.html','/todo.html']:
    status,_,headers,_=get(path);assert status==200 and 'noindex' in headers.get('X-Robots-Tag',''),('tool indexing guard',path)
for ua in ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)','OAI-SearchBot/1.3; +https://openai.com/searchbot','Baiduspider']:
    status,_,_,data=get('/guides/',ua);assert status==200 and '一人公司与个人事业起步指南'.encode() in data,('crawler access',ua)
print(json.dumps({'pages':results,'robotAndSitemap':'pass','legacyRedirects':len(m['articleIds']),'real404':'pass','privateToolNoindex':'pass','crawlerUserAgentAccess':'pass (simulated requests; not proof of actual crawler visits)'},ensure_ascii=False,indent=2))
