#!/usr/bin/env python3
"""Aggregate privacy-minimized nginx logs. Counts are requests, never unique users."""
import sys,json,collections
totals=collections.Counter();sources=collections.Counter();pages=collections.Counter();bots=collections.Counter();steps=collections.Counter();dates=collections.Counter()
for line in sys.stdin:
    try:r=json.loads(line)
    except (ValueError,TypeError):continue
    totals['requests']+=1;dates[r.get('time','')[:10]]+=1
    if r.get('bot')!='browser-or-other':bots[r.get('bot','unknown')]+=1;continue
    totals['browserOrOtherRequests']+=1
    if r.get('status')!='200':continue
    sources[r.get('source','direct-or-other')]+=1;pages[r.get('path','unknown')]+=1
    if r.get('source')=='site-guides' and r.get('path') in ['/diagnosis.html','/consultation.html','/first-order-sprint.html','/resources/','/calibrator.html']:steps[r['path']]+=1
print(json.dumps({'metric':'HTTP requests; not visitors or confirmed consultations','dateCounts':dates,'totals':totals,'sources':sources,'claimedCrawlerRequests':bots,'topPages':dict(pages.most_common(30)),'guideToServiceOrToolRequests':steps,'limits':['User agents and referrers may be absent or spoofed.','Bots without a recognized user agent remain in browser-or-other.','A service page request is not a lead or payment.','Confirm consultations manually using the 官网指南 contact note.']},ensure_ascii=False,indent=2))
