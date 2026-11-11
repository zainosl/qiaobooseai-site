#!/usr/bin/env python3
"""Export the published roadshow and its local assets as one offline HTML file."""
from pathlib import Path
from urllib.parse import urlsplit,urljoin
import argparse,base64,mimetypes,re
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'latest-event/voyage.html'
def export(target):
    source=SOURCE.read_text()
    def local(url):
        path=urlsplit(url).path
        p=(ROOT/path.lstrip('/') if path.startswith('/') else SOURCE.parent/path).resolve()
        if not p.is_relative_to(ROOT):raise ValueError('Resource outside site: '+url)
        return p
    def style(m):
        tag=m[0];href=re.search(r'href="([^"]+)"',tag)
        if 'rel="stylesheet"' not in tag or not href:return tag
        return '<style>'+local(href[1]).read_text()+'</style>'
    source=re.sub(r'<link\b[^>]*>',style,source)
    source=re.sub(r'<script\b[^>]*src="([^"]+)"[^>]*>\s*</script>',lambda m:'<script>'+local(m[1]).read_text()+'</script>',source)
    def resource(m):
        attr,url=m[1],m[2]
        if url.startswith('voyage-assets/'):
            p=local(url);mime=mimetypes.guess_type(str(p))[0] or 'application/octet-stream'
            return attr+'="data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()+'"'
        if attr=='href' and not url.startswith(('#','data:','https:','http:','mailto:','tel:')):
            return attr+'="'+urljoin('https://qiaoboose.com/latest-event/voyage.html',url)+'"'
        return m[0]
    source=re.sub(r'\b(src|href)="([^"]+)"',resource,source)
    target=Path(target);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(source)
    print(f'Offline HTML: {target} ({target.stat().st_size:,} bytes)')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output');export(parser.parse_args().output)
