# 把伺服器版的網頁合併成一個「單機試玩版」檔案（不需要伺服器，直接雙擊開啟）
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
def inline(m):
    js = (root / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
html = html.replace('<div id="app"></div>', '<div id="app"></div>\n<script>window.PK_OFFLINE=true;</script>')
html = html.replace('<title>牌神擂台</title>', '<title>牌神擂台（單機試玩版）</title>')
import base64
bgm = {}
for f in sorted(root.glob('bgm*.mp3')):
    bgm[f.name] = 'data:audio/mpeg;base64,' + base64.b64encode(f.read_bytes()).decode()
import json
html = html.replace('<script>window.PK_OFFLINE=true;</script>', '<script>window.PK_OFFLINE=true;window.PK_BGM_DATA=' + json.dumps(bgm) + ';</script>')
out = pathlib.Path(__file__).parent.parent / '牌神擂台_單機試玩版.html'
out.write_text(html, encoding='utf-8')
print('完成：', out, len(html), 'bytes')
