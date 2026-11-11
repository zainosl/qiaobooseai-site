#!/usr/bin/env python3
"""Render one shared, accessible header into every public page (no runtime fetch)."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parent.parent
PAGES = {'index.html':'home','products.html':'products','diagnosis.html':'products','closed-loop-diagnosis.html':'products','first-order-sprint.html':'products','consultation.html':'products','calibrator.html':'products','potential-customer-channels.html':'products','capability-diagnosis-case.html':'products','articles.html':'articles','article.html':'articles','latest-event/index.html':'events','latest-event/voyage.html':'events','resources/index.html':'resources'}
for name, section in PAGES.items():
    path = ROOT/name; source = path.read_text(); base = '../' * (len(Path(name).parts)-1)
    header = (ROOT/'components/site-header.html').read_text().replace('{{base}}',base).replace(f'data-section="{section}"', f'data-section="{section}" aria-current="page"')
    source = re.sub(r'<header\b[^>]*(?:id="q-site-header"|class="(?:site-nav|campaign-nav|topbar site-header)")[^>]*>.*?</header>\n*', lambda m:header, source, count=1, flags=re.S) if re.search(r'<header\b[^>]*(?:id="q-site-header"|class="(?:site-nav|campaign-nav|topbar site-header)")',source) else re.sub(r'(<body\b[^>]*>)',lambda m:m[1]+header,source,count=1)
    if 'q-has-header' not in source:
        source = re.sub(r'<body([^>]*)>',lambda m:'<body'+(m[1].replace('class="','class="q-has-header ',1) if 'class="' in m[1] else m[1]+' class="q-has-header"')+'>',source,count=1)
    if 'site-header.css' not in source: source=source.replace('</head>',f'<link rel="stylesheet" href="{base}site-header.css?v=20261111b">\n</head>')
    if 'site-header.js' not in source: source=source.replace('</body>',f'<script src="{base}site-header.js?v=20261111b"></script></body>')
    if 'src="'+base+'theme-controller.js' not in source: source=source.replace('</head>',f'<script src="{base}theme-controller.js?v=20261111b"></script></head>')
    path.write_text(source)
print(f'Updated {len(PAGES)} public page headers.')
