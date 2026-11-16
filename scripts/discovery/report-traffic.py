#!/usr/bin/env python3
"""Aggregate privacy-minimized nginx logs. Counts are requests, never unique users."""
import sys,json,collections,datetime
totals=collections.Counter();sources=collections.Counter();pages=collections.Counter();bots=collections.Counter();steps=collections.Counter();dates=collections.Counter()
page_dates=collections.Counter();downloads=collections.Counter();first_seen=None;last_seen=None
for line in sys.stdin:
    try:r=json.loads(line)
    except (ValueError,TypeError):continue
    stamp=r.get('time','')
    if stamp:
        first_seen=min(first_seen,stamp) if first_seen else stamp
        last_seen=max(last_seen,stamp) if last_seen else stamp
    totals['requests']+=1;dates[r.get('time','')[:10]]+=1
    if r.get('bot')=='verification':totals['verificationRequests']+=1;continue
    if r.get('bot')!='browser-or-other':bots[r.get('bot','unknown')]+=1;continue
    totals['browserOrOtherRequests']+=1
    if r.get('status')!='200':continue
    path=r.get('path','unknown')
    # nginx logs the internal index.html URI after directory resolution.
    if path.endswith('/index.html'):path=path[:-10]
    if not (path.endswith('/') or path.endswith('.html')):
        if path=='/guides/small-service-template/worksheet.txt':downloads[path]+=1
        totals['successfulNonPageRequests']+=1;continue
    sources[r.get('source','direct-or-other')]+=1
    page_dates[stamp[:10]]+=1
    totals['successfulPageRequests']+=1;pages[path]+=1
    if r.get('source')=='site-guides' and path in ['/diagnosis.html','/consultation.html','/first-order-sprint.html','/resources/','/calibrator.html']:steps[path]+=1
print(json.dumps({'schemaVersion':2,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dataFrom':first_seen,'dataThrough':last_seen,'metric':'HTTP requests; not visitors or confirmed consultations','dateCounts':dates,'pageRequestDateCounts':page_dates,'totals':totals,'sources':sources,'sourcesScope':'successful browser-or-other HTML page requests only; excludes assets, downloads and marked verification','templateDownloadRequests':downloads,'claimedCrawlerRequests':bots,'topPages':dict(pages.most_common(30)),'guideToServiceOrToolRequests':steps,'limits':['User agents and referrers may be absent or spoofed.','Unmarked manual tests and AI reading tests cannot be reliably separated from organic requests; do not report remaining requests as confirmed visitors.','Logs collected before the verification-marker fix may include simulated crawlers under claimed-*; do not count these as verified crawler visits.','Bots without a recognized user agent remain in browser-or-other.','A service page request or template download is not a lead or payment.','Confirm consultations manually using the 官网指南 contact note.']},ensure_ascii=False,indent=2))
