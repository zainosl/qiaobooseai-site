#!/usr/bin/env python3
"""Build crawlable additions from existing public content; never rewrite article sources."""
import html, json, re, hashlib
from pathlib import Path
from urllib.parse import urljoin
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://qiaoboose.com'
DATE = '2026-11-13'
E = html.escape
guides = json.loads((ROOT/'scripts/discovery/guides.json').read_text())
meta = json.loads(re.search(r'window\.ARTICLES\s*=\s*(\[.*\]);', (ROOT/'articles/data.js').read_text(), re.S)[1])
person = {'@type':'Person','@id':SITE+'/guides/about/#person','name':'乔不不斯','url':SITE+'/guides/about/','description':'围绕一人公司与个人事业起步，提供能力资产、商业方向与首单验证共创。'}
generated = []

def inline(s):
    s=E(s,quote=True)
    s=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',s)
    return re.sub(r'(^|[^*])\*([^*]+)\*(?!\*)',r'\1<em>\2</em>',s)

def blocks(items):
    out=[]
    for b in items:
        t=b['t']
        if t=='html': out.append('<div class="wechat-article">'+b['html']+'</div>')
        elif t=='section': out.append('<div class="art-section" id="sec-'+re.sub(r'[^\w-]','',str(b['n']))+'"><span class="num">'+E(str(b['n']))+'</span><h2>'+E(re.sub(r'^\d+[｜|]\s*','',b['h']))+'</h2></div>')
        elif t in ('p','h3'):out.append(f'<{t}>'+inline(b['text'])+f'</{t}>')
        elif t=='key':out.append('<div class="art-key">'+inline(b['text'])+'</div>')
        elif t in ('ul','ol'):
            start=f' start="{int(b["start"])}"' if t=='ol' and b.get('start') else ''
            out.append(f'<{t}{start}>'+''.join('<li>'+inline(v)+'</li>' for v in b['items'])+f'</{t}>')
        else:raise ValueError('Unknown content block '+t)
    # Original assets are relative to the root article.html, not the new reading directory.
    return re.sub(r'(href|src)=["\']([^"\']+)["\']',lambda m:m[1]+'="'+E(urljoin(SITE+'/',html.unescape(m[2])),quote=True)+'"' if not m[2].startswith('#') else m[0], '\n'.join(out))

def page(path,title,summary,body,kind='Article',date=DATE,extra=None):
    url=SITE+path
    header=(ROOT/'components/site-header.html').read_text().replace('{{base}}','/')
    if '/guides/' in path:header=header.replace('data-section="guides"','data-section="guides" aria-current="page"')
    elif '/read/' in path:header=header.replace('data-section="articles"','data-section="articles" aria-current="page"')
    obj={'@type':kind,'@id':url+'#page','url':url,'name':title,'description':summary,'inLanguage':'zh-CN'}
    if kind=='Article':obj.update(headline=title,author={'@id':person['@id']},mainEntityOfPage=url)
    if date and path.startswith('/guides/'):obj.update(datePublished=DATE,dateModified=DATE)
    if extra:obj.update(extra)
    graph={'@context':'https://schema.org','@graph':[person,obj,{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'首页','item':SITE+'/'},{'@type':'ListItem','position':2,'name':title,'item':url}]}]}
    data=json.dumps(graph,ensure_ascii=False).replace('<','\\u003c')
    document=f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/campaign-icon.svg"><title>{E(title)} · 乔不不斯</title><meta name="description" content="{E(summary,quote=True)}">
<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="{url}">
<meta property="og:title" content="{E(title,quote=True)}"><meta property="og:description" content="{E(summary,quote=True)}"><meta property="og:url" content="{url}"><meta property="og:type" content="{'article' if kind=='Article' else 'website'}"><meta property="og:locale" content="zh_CN">
<link rel="stylesheet" href="/guides/tokens.css"><link rel="stylesheet" href="/guides/reading.css"><link rel="stylesheet" href="/site-header.css?v=20261111c"><script src="/theme-controller.js?v=20261111c"></script>
<script type="application/ld+json">{data}</script></head><body class="q-has-header"><a class="skip" href="#main">跳到正文</a>{header}
<main id="main" class="reading-wrap"><nav class="crumbs" aria-label="面包屑"><a href="/">首页</a> / <a href="/guides/">个人事业起步指南</a></nav>
<div class="eyebrow">QIAOBOOSE / SOLO BUSINESS</div><h1>{E(title)}</h1><p class="lead">{E(summary)}</p>
<div class="reading-meta">作者：<a href="/guides/about/">乔不不斯</a>{' · 日期：'+E(date) if date else ''}</div>
{body}
<footer class="reading-footer"><nav><a href="/guides/">起步指南</a><a href="/read/">完整文章目录</a><a href="/guides/about/">关于乔不不斯</a><a href="/guides/case-evidence/">公开案例说明</a><a href="/products.html">产品与服务</a></nav><p>AI Native 一人公司 · 乔不不斯 · <a href="https://beian.miit.gov.cn/" rel="nofollow">粤ICP备2026086998号</a></p></footer></main>
<script src="/site-header.js?v=20261111c"></script></body></html>'''
    file=ROOT/path.lstrip('/')/'index.html';file.parent.mkdir(parents=True,exist_ok=True);file.write_text(document)
    generated.append(path)

def layout(body,sidebar=''):
    return '<div class="reading-layout"><article class="reading-body">'+body+'</article><aside class="reading-side" aria-label="继续阅读">'+(sidebar or '<b>找到适合的下一步</b><a href="/guides/">按问题阅读指南</a><a href="/calibrator.html">先做免费路径自检</a><a href="/guides/case-evidence/">查看公开交付样张</a><a href="/guides/choose-support/">了解服务如何选择</a>')+'</aside></div>'

cards=''.join(f'<section class="guide-card"><span class="guide-number">0{i+1} / 起步问题</span><h2><a href="/guides/{g["slug"]}/">{E(g["title"])}</a></h2><p>{E(g["summary"])}</p></section>' for i,g in enumerate(guides))
page('/guides/','一人公司与个人事业起步指南','从能力、需求、客户、AI 协作到服务选择。先判断当前卡点，再完成一轮真实验证。', '<article class="reading-body"><h2>五个起步问题</h2><div class="guide-grid">'+cards+'</div></article><section class="next-step"><h2>先看真实材料，再判断是否适合自己</h2><p><a href="/guides/about/">了解乔不不斯</a> · <a href="/guides/case-evidence/">查看公开案例与证据边界</a> · <a href="/read/">阅读完整文章</a></p></section>',kind='CollectionPage')
for g in guides:
    body=''.join(f'<section id="step-{i+1}"><h2>{E(h)}</h2>{s}</section>' for i,(h,s) in enumerate(g['sections']))
    body+='<section><h2>依据与延伸阅读</h2><p>本指南依据乔不不斯官网已有公开文章与服务说明整理。以下链接保留完整论述与适用条件。</p><ul>'+''.join(f'<li><a href="{u}">{E(t)}</a></li>' for u,t in g['sources'])+'</ul></section>'
    sidebar='<b>本页阅读路径</b>'+''.join(f'<a href="#step-{i+1}">{i+1}. {E(h)}</a>' for i,(h,_) in enumerate(g['sections']))+'<hr><a href="/guides/">查看其他起步问题</a><a href="/guides/about/">关于作者与服务</a>'
    page('/guides/'+g['slug']+'/',g['title'],g['summary'],layout(body,sidebar))

about='''<section><h2>我主要帮助谁</h2><p>我是乔不不斯，围绕 AI Native 一人公司与个人事业起步持续实践和写作。目前的服务主要面向已有专业经验、能力材料或业务方向，希望进一步验证个人商业路径的人。</p><p>我们一起处理的问题包括：哪些能力可以独立提供价值、它们适合解决谁的什么问题、如何形成一个小产品，以及怎样通过真实沟通和购买反馈决定下一步。</p></section>
<section><h2>可以从哪里了解我</h2><p><a href="/">官网首页</a>记录了我的职业与转型经历，包括 AI 产品及商业化工作背景、离开职场后的能力拆解和个人业务验证。这些属于本人公开自述。</p><p><a href="/read/">公开文章目录</a>提供完整方法与实践过程。你可以直接阅读论证，再判断是否与自己的处境相关。<a href="/capability-diagnosis-case.html">脱敏案例样张</a>则展示了能力资产与方向评审的交付结构。</p><p>职业阶段的业务成绩、个人业务收入和客户获得的结果是不同口径，应分别判断。本站不将个人经历当作每位客户都能复制的收益承诺。</p></section>
<section><h2>现有服务与分工</h2><ul><li><a href="/diagnosis.html">能力资产与商业方向共创</a>：从真实经历与材料出发，校准能力和可验证方向。</li><li><a href="/first-order-sprint.html">0–1 首单验证共创</a>：围绕已有方向，推进小产品、潜在客户接触、报价和证据复盘。</li><li><a href="/consultation.html">一人公司单次咨询</a>：围绕眼前的独立问题，讨论判断与下一步。</li></ul><p>你提供真实材料、亲自完成关键行动并作出最终选择；AI 协助整理、起草与沉淀；我参与框架、判断和校准。具体费用、范围及安排以对应服务页和合作前确认为准。</p></section>
<section><h2>哪些需求需要先核对是否匹配</h2><p>如果你期待代运营、代获客、代成交或固定收益保证，现有共创服务不适合直接按这些期待购买。首单验证服务也不以重研发软件项目或已经稳定成交后的规模化增长为主要范围。</p><p>还没有具体问题时，可先使用<a href="/calibrator.html">路径校准器</a>、<a href="/potential-customer-channels.html">渠道库</a>和<a href="/resources/">公开起步资料</a>。有真实材料与卡点后，再判断是否需要付费帮助。</p></section>
<section><h2>如何联系</h2><p>微信：<strong>qiaoboose01</strong>。通过本指南来访，可以备注“官网指南”，并说明正在做什么、已经采取过哪些行动，以及最想判断的一个问题。</p><p>这些页面提供公开介绍与阅读入口。站点会按来源和页面汇总访问请求，用于了解哪些内容有帮助；新增统计不使用追踪 Cookie，也不在统计记录中保存 IP、完整来源网址或客户沟通内容。</p></section>'''
page('/guides/about/','乔不不斯是谁？一人公司与个人事业共创服务说明','了解乔不不斯的公开经历、服务对象、能力资产与首单验证共创的分工、适用边界和联系入口。',layout(about),kind='AboutPage',extra={'mainEntity':{'@id':person['@id']}})
case='''<section><h2>一个已公开的能力资产共创案例</h2><p>官网已公开的<a href="/capability-diagnosis-case.html">能力资产商业化诊断：脱敏案例样张</a>，展示了一位拥有项目经验、文章材料及 AI 对话记录的用户，如何从“材料很多、方向难选”走向能力取证、方向比较与验证计划。</p><p>这里仅解释既有公开样张，没有补充客户身份、未公开原件、评价或收入信息。</p></section>
<section><h2>起点、过程与交付分别是什么</h2><ol><li><strong>起点：</strong>经验和判断分散，一介绍自己就变成抽象优势；多个方向都有道理，难以决定先验证哪一个。</li><li><strong>取证与校准：</strong>从真实行为材料提取重复模式，结合真人访谈，确认能力命名、边界和需要处理的短板。</li><li><strong>方向比较：</strong>把候选方向放到用户需求、已有供给、竞品及个人约束中比较，收敛可验证的切口。</li><li><strong>交付：</strong>能力资产地图、商业切口评审页与 14 天验证计划，并保留后续更新的工作流。</li></ol></section>
<section><h2>这份案例支持哪些判断</h2><p>你可以用它检查：服务是否从真实材料出发、能力结论有没有依据、不同方向怎样被比较，以及下一步行动是否足够具体。样张展示了交付结构，便于你判断这类支持是否有助于当前问题。</p><p>样张中的“专家经验产品蓝图诊断”是被保留的优先验证方向；14 天安排是验证计划。不能把计划直接表述成已完成的市场验证，也不能据此推定客户已经成交或获得多少收入。</p></section>
<section><h2>如何用这份样张评估自己的需求</h2><ul><li>你是否已有可供分析的项目、文章、对话或交付材料？</li><li>你更缺能力证据、方向比较，还是接触客户与报价的行动？</li><li>一份交付物应帮助你做出哪个具体决定？</li></ul><p>如果主要卡在能力与方向，查看<a href="/diagnosis.html">能力资产与商业方向共创</a>；如果方向已经明确，查看<a href="/first-order-sprint.html">首单验证共创</a>，核对是否进入了合适阶段。</p></section>'''
page('/guides/case-evidence/','能力资产共创案例：从经验材料到商业验证计划','对官网已有脱敏案例的阅读说明：起点、取证过程、能力资产地图、方向评审与验证计划，以及这些材料能证明什么。',layout(case))

source_hashes={}
for m in meta:
    src=ROOT/'articles/content'/f'{m["id"]}.js';s=src.read_text()
    start=re.search(r'window\.__ARTICLES_CONTENT__\[[^\]]+\]\s*=\s*',s).end()
    content=json.JSONDecoder().raw_decode(s[start:])[0]
    source_hashes[str(src.relative_to(ROOT))]=hashlib.sha256(src.read_bytes()).hexdigest()
    summary=re.sub('<[^>]+>','',html.unescape(content.get('dek',''))).replace('*','').strip() or m['title']
    body=blocks(content['blocks'])
    body+='<section class="next-step"><h2>把阅读接到自己的下一步</h2><p><a href="/guides/">按当前问题查看起步指南</a> · <a href="/calibrator.html">体验路径校准器</a> · <a href="/resources/">领取起步资料</a></p></section>'
    page('/read/'+m['id']+'/',m['title'],summary,layout(body),date=m.get('date'))
page('/read/','乔不不斯文章目录：一人公司、商业验证与 AI 实战','完整阅读乔不不斯关于个人事业、一人公司、商业验证、获客增长与 AI 协作的公开文章。','<ul class="archive-list">'+''.join(f'<li><small>{E(m["date"])} · {E(m["cat"])}</small><a href="/read/{m["id"]}/">{E(m["title"])}</a></li>' for m in meta)+'</ul>',kind='CollectionPage',date=None)

existing=['/','/products.html','/diagnosis.html','/closed-loop-diagnosis.html','/first-order-sprint.html','/consultation.html','/calibrator.html','/potential-customer-channels.html','/capability-diagnosis-case.html','/articles.html','/latest-event/','/latest-event/voyage.html','/resources/']
ns='http://www.sitemaps.org/schemas/sitemap/0.9'
ET.register_namespace('',ns);xml=ET.Element('{'+ns+'}urlset')
for path in existing+generated:
    entry=ET.SubElement(xml,'{'+ns+'}url');ET.SubElement(entry,'{'+ns+'}loc').text=SITE+path
(ROOT/'sitemap.xml').write_bytes(ET.tostring(xml,encoding='utf-8',xml_declaration=True))
(ROOT/'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /crm-api/\nDisallow: /todo-api/\nDisallow: /server/\nDisallow: /scripts/\nDisallow: /output/\n\nSitemap: '+SITE+'/sitemap.xml\n')
manifest={'sourceHashes':source_hashes,'pages':existing+generated,'generated':generated,'articleIds':[m['id'] for m in meta]}
(ROOT/'scripts/discovery/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'Built {len(generated)} pages; sitemap has {len(existing+generated)} URLs; {len(meta)} unchanged article sources.')
