#!/usr/bin/env python3
"""Verify crawlability, internal links, source fidelity, metadata and generated pages."""
import hashlib, html, json, re, subprocess
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent.parent
manifest=json.loads((ROOT/'scripts/discovery/manifest.json').read_text())
class Doc(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.ids=set();self.h1=0;self.canonical=[];self.jsonld=[];self.injson=False
    def handle_starttag(self,t,a):
        d=dict(a)
        if 'id' in d:self.ids.add(d['id'])
        if t=='h1':self.h1+=1
        if t=='link' and d.get('rel')=='canonical':self.canonical.append(d.get('href'))
        if t in ('a','img','script','link'):
            v=d.get('href') or d.get('src')
            if v:self.links.append(v)
        if t=='script' and d.get('type')=='application/ld+json':self.injson=True
    def handle_endtag(self,t):
        if t=='script':self.injson=False
    def handle_data(self,d):
        if self.injson:self.jsonld.append(json.loads(d))
errors=[];checked=0
for path in manifest['generated']:
    file=ROOT/path.strip('/')/'index.html';s=file.read_text();d=Doc();d.feed(s)
    if d.h1!=1:errors.append(f'{path}: expected one h1')
    if d.canonical!=['https://qiaoboose.com'+path]:errors.append(f'{path}: canonical mismatch')
    if len(d.jsonld)!=1:errors.append(f'{path}: missing JSON-LD')
    if 'noindex' in s:errors.append(f'{path}: unexpectedly noindex')
    for link in d.links:
        u=urlparse(link)
        if u.scheme and u.scheme not in ('http','https'):continue
        if u.netloc and u.netloc!='qiaoboose.com':continue
        if u.fragment and not u.path:
            if u.fragment not in d.ids:errors.append(f'{path}: missing fragment {link}')
            continue
        target=(ROOT/unquote(u.path).lstrip('/')) if u.path.startswith('/') else file.parent/unquote(u.path)
        if not target.exists():errors.append(f'{path}: missing target {link}')
    checked+=1
for file,wanted in manifest['sourceHashes'].items():
    if hashlib.sha256((ROOT/file).read_bytes()).hexdigest()!=wanted:errors.append('source changed '+file)
    # Comparing to committed source ensures a regenerated manifest cannot hide edits.
    original=subprocess.check_output(['git','show','HEAD:'+file],cwd=ROOT)
    if original!=(ROOT/file).read_bytes():errors.append('original article modified '+file)
root=ET.parse(ROOT/'sitemap.xml').getroot();urls=[n.text for n in root.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
expected=['https://qiaoboose.com'+p for p in manifest['pages']]
if len(urls)!=len(set(urls)) or set(urls)!=set(expected):errors.append('sitemap inconsistent')
if any(x in ' '.join(urls) for x in ('crm.html','todo.html','article.html?','/scripts/')):errors.append('nonpublic/duplicate URL included')
for path in manifest['pages']:
    file=ROOT/(path.lstrip('/')+'index.html' if path.endswith('/') else path.lstrip('/'))
    if not file.exists():errors.append('sitemap missing file '+path)
if errors:raise SystemExit('\n'.join(errors))
print(json.dumps({'generatedPages':checked,'sitemapURLs':len(urls),'articleSourcesUnchanged':len(manifest['sourceHashes']),'internalLinks':'pass','metadata':'pass'},ensure_ascii=False))
