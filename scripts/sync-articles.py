#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
官网文章自动同步脚本
────────────────────────────────────────────
作用：扫描「内容输出」目录，挑出每个主题里的成品对外文章，解析后更新到官网
      （articles/data.js + articles/content/*.js）。

识别逻辑：
  1. 排除工作资料/素材类主题（skill 设计、方法论、行业预判工作方案、素材库等）
  2. 每个主题里按成稿优先级挑一篇：
     发布版 > 最终收口版 > 定稿 > 正式版 > 最终输出版 > 优化稿/精简版 > 公众号正文 > 其它成稿
     同优先级取版本号(vN)最高；排除初稿/框架/标题备选/提取/拆解/说明/方法论等
  3. 智能正文起点：遇到「正文：」「## 公众号文章」「推荐标题：」等标记，从其后取正文；
     标题优先取「推荐标题」「标题1/标题一」「备选标题」第一条，否则用第一个 # 一级标题
  4. 分类受控（MECE）：只允许 ALLOWED_CATS 里的 4 个分类，避免标签增生、重叠。
     新增文章请在 CAT_RULES 里映射到这 4 类之一；不要随意新增分类。
     如确需调整分类体系，先收敛 ALLOWED_CATS，再同步更新 CAT_RULES。

用法：
  python3 scripts/sync-articles.py --incremental  # 增量（定时任务用）：只追加上次水位线之后的新文章
  python3 scripts/sync-articles.py --write        # 全量重建（首次/重置）
  python3 scripts/sync-articles.py --preview      # 仅预览，不写文件

增量逻辑：
  读取现有 articles/data.js 里最大的 date 作为水位线，只解析「成稿修改日期 > 水位线」的主题，
  追加合并进现有文章列表（按 id 去重），不全量重扫、不动旧文章。
"""
import os, re, json, sys, hashlib
from datetime import datetime

SRC = os.environ.get("SYNC_SRC", "/Users/zain/.hermes/hermes任务/内容输出")
SITE = os.environ.get("SYNC_SITE", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── 排除的主题（工作资料/素材/重复）──
EXCLUDE_TOPICS = [
    'AI产品商业教练IP', 'APAG写作系统', 'skill学习', '商业模式事前验尸',
    '行业机会预判', '路径校准器文章', '内容拆解', '个人写作风格库', '官网',
    '同样写一人公司为什么他的阅读量是我的5倍',
]
# ── 成稿优先级（越靠前越优先）──
PRIORITY = ['发布版', '最终收口版', '定稿', '正式版', '最终输出版', '优化稿', '精简版', '公众号正文', '公众号文章']
# ── 排除的辅助材料文件词 ──
BAD = ['初稿', '框架', '标题备选', '标题优化', '提取', '拆解', '说明', '方法论', '准备稿',
       '学习笔记', '工作方案', '重做方案', '审计', '缺口', '记录', '补充', '改稿方向',
       '升级建议', '步骤表', '整合方案', '交叉验证', '结构化提取', '根目录版本']

# ── 已知分类（优先复用，不写死）──
#   原则：保持 MECE。新文章能归入已知分类就复用，不要制造意思相近的新标签；
#   只有当文章确实不属于任何已知分类时，才在 CAT_RULES 里映射一个新的、清晰互斥的分类，
#   并把它补进 KNOWN_CATS。脚本会在每次运行时提示「本次出现的新分类」，便于你审阅。
#   现有分类含义：
#     一人公司认知 ：一人公司的本质、阶段、心态、组织形态、人生方向
#     AI 实战      ：用 AI 做事的方法、风险、真实路径、AI Native 产品
#     商业验证     ：产品/服务/商业模式/价值观的验证
#     获客增长     ：找客户、内容、流量、第一单、阅读量
KNOWN_CATS = ['一人公司认知', 'AI 实战', '商业验证', '获客增长']
DEFAULT_CAT = '一人公司认知'

# ── 分类映射：源路径含关键词 → 分类（优先用 KNOWN_CATS；确有需要可写新分类）──
CAT_RULES = [
    ('为什么我的内容阅读量', '获客增长'),
    ('真正的一人公司不是先离开', '一人公司认知'),
    ('别急着做公域', '获客增长'),
    ('AI最大风险', 'AI 实战'),
    ('有审美为什么更难落地', '商业验证'),
    ('一页HTML入口产品', 'AI 实战'),
    ('AI给了我100个答案', 'AI 实战'),
    ('未来组织形态', '一人公司认知'),
    ('早期成功指标', '一人公司认知'),
    ('AI毁掉一人公司', 'AI 实战'),
    ('AI一人公司真实路径', 'AI 实战'),
    ('不割韭菜', '商业验证'),
    ('人生复利', '一人公司认知'),
    ('看见不一样的人', '一人公司认知'),
    ('第一单前10个里程碑', '获客增长'),
]

# 正文起点标记
BODY_MARKERS = ['正文：', '正文:', '## 公众号文章', '# 公众号文章', '## 正文', '# 正文']
# 标题来源标记
TITLE_HINT = re.compile(r'^(推荐标题|标题\s*1|标题一|备选标题|标题)[：:]\s*(.*)$')
DEK_SKIP = re.compile(r'^(封面副标题|副标题|题图|配图|导语提示)[：:]?')


def cat_of(path):
    for k, v in CAT_RULES:
        if k in path:
            return v
    return DEFAULT_CAT


def is_topic_excluded(topic):
    return any(k in topic for k in EXCLUDE_TOPICS)


def pick_file(topic_dir):
    files = []
    for root, _, fs in os.walk(topic_dir):
        for f in fs:
            if f.endswith('.md'):
                files.append(os.path.join(root, f))
    if not files:
        return None
    good = [f for f in files if not any(b in os.path.basename(f) for b in BAD)]
    if not good:
        good = files

    def score(f):
        b = os.path.basename(f)
        vm = re.search(r'v(\d+)', b)
        ver = int(vm.group(1)) if vm else 0
        for i, p in enumerate(PRIORITY):
            if p in b:
                return (100 - i, ver, os.path.getmtime(f))
        return (0, ver, os.path.getmtime(f))

    good.sort(key=score, reverse=True)
    return good[0]


def extract_title_and_body(lines):
    """返回 (title, body_lines)。智能跳过标题备选区、找正文起点。"""
    # 1) 找正文起点（正文：/## 公众号文章/--- 分隔后等）
    body_start = 0
    for i, ln in enumerate(lines):
        s = ln.strip()
        if any(s == mk or s.startswith(mk) for mk in BODY_MARKERS):
            body_start = i + 1
            break
    body = lines[body_start:] if body_start else lines[:]

    title = ''
    head = lines[:40]
    # 2) 最优先：显式「推荐标题」（最能代表作者定稿意图）
    for i, ln in enumerate(head):
        s = ln.strip()
        m = re.match(r'^推荐标题[：:]\s*(.+)$', s)
        if m and m.group(1).strip():
            title = m.group(1).strip(); break
        if re.match(r'^推荐标题[：:]?\s*$', s):
            for nxt in head[i + 1:i + 5]:
                ns = nxt.strip()
                if ns and not re.match(r'^(正文|备选)', ns):
                    title = ns; break
        if title:
            break

    # 3) 其次：正文区里第一个「真 # 标题」（排除元标题/小节编号/版本说明）
    META_TITLE = re.compile(r'^(公众号文章|APAG|备选标题|标题\s*\d|推荐标题|正文|\d+[｜|])')
    if not title:
        for ln in body:
            m = re.match(r'^#\s+(.*)', ln)
            if m:
                cand = m.group(1).strip()
                if not META_TITLE.match(cand):
                    title = cand
                    break

    # 4) 再次：「标题1/备选标题」第一条
    if not title:
        for ln in head:
            m = TITLE_HINT.match(ln.strip())
            if m and m.group(2).strip():
                title = m.group(2).strip()
                break
        if not title:
            for i, ln in enumerate(head):
                if re.match(r'^(标题备选|备选标题)[：:]?\s*$', ln.strip()):
                    for nxt in head[i + 1:i + 8]:
                        ns = nxt.strip()
                        mm = re.match(r'^(?:\d+[.、)]\s*|标题\s*\d+[：:]\s*)?[《"]?(.+?)[》"]?\s*$', ns)
                        if ns and mm and ns not in ('正文：', '正文:'):
                            title = mm.group(1).strip(); break
                if title:
                    break

    # 4) 兜底：全文第一个 # 标题（清掉版本说明/工作流前缀）
    if not title:
        for ln in lines:
            m = re.match(r'^#\s+(.*)', ln)
            if m:
                title = re.sub(r'（v\d+[^）]*）|\(v\d+[^)]*\)', '', m.group(1)).strip()
                title = re.sub(r'^(APAG\s*公众号文章输出|公众号文章与朋友圈短文)[：:]?\s*', '', title).strip()
                break

    # 5) 标题清洗
    title = re.sub(r'（v\d+[^）]*）|\(v\d+[^)]*\)', '', title).strip()
    title = title.strip('《》"" ')
    return title, body


def md_inline(s):
    s = re.sub(r'`([^`]*)`', r'\1', s)
    s = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', s)
    return s.strip()


def parse_body(body_lines):
    blocks = []; dek = ''; sec_n = 0; para = []

    def flush():
        nonlocal para
        if para:
            t = ' '.join(para).strip()
            if t:
                blocks.append({'t': 'p', 'text': md_inline(t)})
            para = []

    skip_meta = True  # 跳过正文起点前可能残留的"备选标题"列表
    for raw in body_lines:
        line = raw.rstrip()
        if not line.strip():
            flush(); continue
        # 分隔线
        if re.match(r'^---+$', line.strip()):
            flush(); continue
        m1 = re.match(r'^#\s+(.*)', line)
        m2 = re.match(r'^##\s+(.*)', line)
        m3 = re.match(r'^###\s+(.*)', line)
        if m1:
            flush(); h = m1.group(1).strip()
            # 跳过元标题
            if re.match(r'^(公众号文章|APAG|备选标题)', h):
                continue
            sec_n += 1
            blocks.append({'t': 'section', 'n': str(sec_n).zfill(2), 'h': re.sub(r'^\d+[｜|]\s*', '', h)})
            continue
        if m2:
            h = m2.group(1).strip()
            if re.match(r'^(备选标题|标题|公众号)', h):
                continue
            flush(); sec_n += 1
            blocks.append({'t': 'section', 'n': str(sec_n).zfill(2), 'h': re.sub(r'^\d+[｜|]\s*', '', h)})
            continue
        if m3:
            flush(); blocks.append({'t': 'h3', 'text': m3.group(1).strip()}); continue
        if re.match(r'^[-*]\s+', line):
            flush(); item = md_inline(re.sub(r'^[-*]\s+', '', line))
            if blocks and blocks[-1].get('_ul'):
                blocks[-1]['items'].append(item)
            else:
                blocks.append({'t': 'ul', 'items': [item], '_ul': True})
            continue
        if re.match(r'^\d+[.、)]\s+', line):
            flush(); item = md_inline(re.sub(r'^\d+[.、)]\s+', '', line))
            if blocks and blocks[-1].get('_ol'):
                blocks[-1]['items'].append(item)
            else:
                blocks.append({'t': 'ol', 'items': [item], '_ol': True})
            continue
        if line.startswith('>'):
            flush(); blocks.append({'t': 'key', 'text': md_inline(line.lstrip('> ').strip())}); continue
        if re.match(r'^\*\*[^*]+\*\*$', line.strip()):
            flush(); blocks.append({'t': 'key', 'text': md_inline(line.strip())}); continue
        para.append(line.strip())
    flush()

    # dek：第一个非说明性 p（排除"标题N："等残留）
    DEK_BAD = re.compile(r'^(标题\s*\d|推荐标题|备选标题|封面|副标题)')
    for idx, b in enumerate(blocks):
        if (b['t'] == 'p' and not DEK_SKIP.match(b['text'])
                and not DEK_BAD.match(b['text']) and len(b['text']) > 8):
            dek = b['text']; blocks.pop(idx); break
    # 清理 + ol 连续 start
    c = 0
    for b in blocks:
        b.pop('_ul', None); b.pop('_ol', None)
        if b['t'] in ('section', 'h3'):
            c = 0
        elif b['t'] == 'ol':
            if len(b['items']) == 1:
                c += 1; b['start'] = c
            else:
                b['start'] = 1; c = 0
    return dek, blocks


def build(since=None):
    """解析文章。since 为 'YYYY-MM-DD' 时，只处理成稿修改日期 > since 的主题（增量）。"""
    arts = []
    for topic in sorted(os.listdir(SRC)):
        tdir = os.path.join(SRC, topic)
        if not os.path.isdir(tdir) or is_topic_excluded(topic):
            continue
        path = pick_file(tdir)
        if not path:
            continue
        date = datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d')
        if since and date <= since:
            continue  # 增量模式：跳过水位线及更早的主题
        lines = open(path, encoding='utf-8').read().split('\n')
        title, body = extract_title_and_body(lines)
        dek, blocks = parse_body(body)
        if not title or len(blocks) < 2:
            continue  # 内容太少，跳过
        sid = 'pub-' + hashlib.md5(topic.encode('utf-8')).hexdigest()[:8]
        arts.append({'id': sid, 'date': date, 'cat': cat_of(path),
                     'glyph': 'ARTICLE', 'title': title, 'dek': dek, 'blocks': blocks, '_src': path})
    arts.sort(key=lambda r: r['date'], reverse=True)
    return arts


def read_existing_meta():
    """读取现有 articles/data.js 里的文章 meta 列表（用于增量合并）。"""
    p = os.path.join(SITE, 'articles', 'data.js')
    if not os.path.exists(p):
        return []
    txt = open(p, encoding='utf-8').read()
    m = re.search(r'window\.ARTICLES\s*=\s*(\[[\s\S]*?\]);', txt)
    if not m:
        return []
    try:
        return json.loads(m.group(1))
    except Exception:
        return []


def write_site(arts, append_meta=None):
    """写 content/*.js，并写 data.js。append_meta 给定时为增量：把新文章 meta 合并进旧列表。"""
    cdir = os.path.join(SITE, 'articles', 'content')
    os.makedirs(cdir, exist_ok=True)
    for a in arts:
        content = {'id': a['id'], 'title': a['title'], 'dek': a['dek'], 'meta': [], 'blocks': a['blocks']}
        js = ("window.__ARTICLES_CONTENT__=window.__ARTICLES_CONTENT__||{};\n"
              "window.__ARTICLES_CONTENT__[" + json.dumps(a['id']) + "]="
              + json.dumps(content, ensure_ascii=False) + ";\n")
        open(os.path.join(cdir, a['id'] + '.js'), 'w', encoding='utf-8').write(js)
    new_meta = [{'id': a['id'], 'date': a['date'], 'cat': a['cat'], 'glyph': a['glyph'], 'title': a['title']} for a in arts]
    if append_meta is not None:
        # 增量合并：旧列表 + 新文章，按 id 去重（新覆盖旧），按 date 倒序
        by_id = {m['id']: m for m in append_meta}
        for m in new_meta:
            by_id[m['id']] = m
        meta = sorted(by_id.values(), key=lambda r: r['date'], reverse=True)
    else:
        meta = new_meta
    header = ("/*\n  文章数据源（由 scripts/sync-articles.py 自动生成，请勿手改）\n"
              "  来源：" + SRC + "\n"
              "  生成时间：" + datetime.now().strftime('%Y-%m-%d %H:%M') + "\n*/\n")
    datajs = header + "window.ARTICLES = " + json.dumps(meta, ensure_ascii=False, indent=2) + ";\n"
    open(os.path.join(SITE, 'articles', 'data.js'), 'w', encoding='utf-8').write(datajs)
    return meta


def main():
    def cat_dist_msg(items):
        dist = {}
        for a in items:
            dist[a['cat']] = dist.get(a['cat'], 0) + 1
        print("分类分布：" + " | ".join(f"{k}:{v}" for k, v in dist.items()))
        new_cats = [k for k in dist if k not in KNOWN_CATS]
        if new_cats:
            print("ℹ 本次出现的新分类（请确认是否合理、是否与已有分类重复）：" + ", ".join(new_cats))
            print("  如确认保留，建议把它补进脚本的 KNOWN_CATS 列表。")

    # ── 增量模式：只处理上次水位线之后的新文章，追加合并 ──
    if '--incremental' in sys.argv:
        existing = read_existing_meta()
        since = max((m['date'] for m in existing), default=None)
        arts = build(since=since)
        if not arts:
            print(f"✅ 无新文章（水位线 {since or '无'}）。官网文章页保持不变，共 {len(existing)} 篇。")
            return
        meta = write_site(arts, append_meta=existing)
        print(f"✅ 增量同步：本次新增/更新 {len(arts)} 篇，官网现共 {len(meta)} 篇。")
        print("本次新增/更新：")
        for a in arts:
            print(f"   {a['date']} [{a['cat']}] {a['title'][:34]}")
        cat_dist_msg(arts)
        return

    arts = build()
    if '--preview' in sys.argv:
        for a in arts:
            types = {}
            for b in a['blocks']:
                types[b['t']] = types.get(b['t'], 0) + 1
            print(f"[{a['date']}] [{a['cat']}] {a['title'][:38]}")
            print(f"    {len(a['blocks'])} 块 {json.dumps(types, ensure_ascii=False)} | dek: {a['dek'][:36]}")
            print(f"    src: {os.path.relpath(a['_src'], SRC)}")
        print(f"\n共 {len(arts)} 篇")
        return
    if '--write' in sys.argv:
        # 全量重建（首次或需要重置时用）
        meta = write_site(arts, append_meta=None)
        print(f"✅ 全量同步 {len(meta)} 篇文章")
        for a in arts:
            print(f"   {a['date']} [{a['cat']}] {a['title'][:34]}")
        cat_dist_msg(arts)
        return
    print("用法: python3 scripts/sync-articles.py [--write | --incremental | --preview]")
    print("  --write       全量重建（首次/重置）")
    print("  --incremental 增量，只追加上次之后的新文章（定时任务用）")
    print("  --preview     仅预览，不写文件")


if __name__ == '__main__':
    main()
