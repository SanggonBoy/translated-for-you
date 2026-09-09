import os, json, socket, subprocess, sys, time, tempfile, threading, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

EXT_DIR = r'D:/New Downloads/quick-translate-ext'
TEST_DIR = os.path.join(EXT_DIR, 'test')
CONTENT_JS = open(os.path.join(EXT_DIR, 'content.js'), encoding='utf-8').read()
TRANSLATED = 'hello bro how are you today?'
TRANSLATED2 = 'hello this is a discord message'
TRANSLATED3 = 'please translate this one'
SEED_SLATE = 'halo ini pesan discord'
SEED_REACT = 'halo bro apa kabar hari ini?'
SEED_PLAIN = 'tolong terjemahkan ini'

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/': path = '/test_editor.html'
        fp = os.path.join(TEST_DIR, path.lstrip('/'))
        if os.path.isfile(fp):
            data = open(fp, 'rb').read()
            ctype = 'text/html' if fp.endswith('.html') else 'application/javascript'
            self.send_response(200); self.send_header('Content-Type', ctype); self.end_headers(); self.wfile.write(data)
        else:
            self.send_response(404); self.end_headers(); self.wfile.write(b'nope')
    def log_message(self, *a): pass

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

hport = free_port()
srv = HTTPServer(('127.0.0.1', hport), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

import websocket

prof = tempfile.mkdtemp(prefix='tfy_fix_')
DPORT = free_port()
cands = [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
         r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
         os.path.join(os.environ.get('LOCALAPPDATA',''), r'Google\Chrome\Application\chrome.exe')]
exe = next(c for c in cands if os.path.isfile(c))
proc = subprocess.Popen([exe, f'--remote-debugging-port={DPORT}', f'--user-data-dir={prof}',
    '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check', 'about:blank'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def http_json(path, method='GET'):
    req = urllib.request.Request(f'http://127.0.0.1:{DPORT}{path}', method=method)
    return json.load(urllib.request.urlopen(req, timeout=5))

t0 = time.time()
while time.time() - t0 < 20:
    try:
        http_json('/json/version'); break
    except Exception:
        time.sleep(0.4)
else:
    raise SystemExit('devtools never came up')

try:
    page = http_json(f'/json/new?http://127.0.0.1:{hport}/', 'PUT')
except Exception:
    page = http_json(f'/json/new?http://127.0.0.1:{hport}/')
time.sleep(2.0)

class CDX:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=20); self.i = 0
    def cmd(self, method, **params):
        self.i += 1; i = self.i
        self.ws.send(json.dumps({'id': i, 'method': method, 'params': params}))
        t0 = time.time()
        while time.time() - t0 < 25:
            m = json.loads(self.ws.recv())
            if m.get('id') == i: return m
        raise TimeoutError(method)
    def ev(self, expr, await_promise=False):
        r = self.cmd('Runtime.evaluate', expression=expr, returnByValue=True, awaitPromise=await_promise)
        res = r.get('result', {})
        if 'exceptionDetails' in res:
            print('JS ERR:', json.dumps(res['exceptionDetails'])[:400])
            return None
        return res.get('result', {}).get('value')
    def backspace(self):
        self.cmd('Input.dispatchKeyEvent', type='keyDown', key='Backspace', code='Backspace',
                 windowsVirtualKeyCode=8, nativeVirtualKeyCode=8)
        self.cmd('Input.dispatchKeyEvent', type='keyUp', key='Backspace', code='Backspace',
                 windowsVirtualKeyCode=8, nativeVirtualKeyCode=8)
    def type_text(self, text):
        self.cmd('Input.insertText', text=text)

px = CDX(page['webSocketDebuggerUrl'])
px.cmd('Page.bringToFront')
px.ev(CONTENT_JS)
print('content.js injected into test page')

results = []
def check(name, cond, detail=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + ((' | ' + str(detail)[:170]) if detail else ''))

t0 = time.time(); react_ok = False
while time.time() - t0 < 15:
    if px.ev('window.reactReady === true'): react_ok = True; break
    time.sleep(0.5)
print('react loaded from CDN:', react_ok)

if react_ok:
    seed = px.ev('(function(){var t=document.querySelector("#rt");t.focus();t.setSelectionRange(0,t.value.length);return t.value;})()')
    check('T1 react seed', seed == SEED_REACT, repr(seed))
    px.ev('replaceText(' + json.dumps(TRANSLATED) + ', "input")', await_promise=True)
    time.sleep(0.3)
    val = px.ev('document.querySelector("#rt").value')
    state = px.ev('document.querySelector("#rt-state").textContent')
    check('T1 react value replaced', val == TRANSLATED, repr(val))
    check('T1 react STATE in sync', state == 'STATE:' + TRANSLATED, repr(state))
    px.backspace(); time.sleep(0.2)
    v1 = px.ev('document.querySelector("#rt").value')
    check('T1 backspace works after translate', v1 == TRANSLATED[:-1], repr(v1))
    px.type_text(' OK'); time.sleep(0.2)
    v2 = px.ev('document.querySelector("#rt").value')
    s2 = px.ev('document.querySelector("#rt-state").textContent')
    check('T1 typing works + state sync', v2 == TRANSLATED[:-1] + ' OK' and s2 == 'STATE:' + v2, repr(v2))

# T2a: reproduce the OLD bug - execCommand behind the model's back
px.ev('(function(){window.slateBypass=true;slateSetState(' + json.dumps(SEED_SLATE) + ');'
      'var s=window.getSelection();var r=document.createRange();r.selectNodeContents(slateEl);'
      's.removeAllRanges();s.addRange(r);slateEl.focus();'
      'document.execCommand("insertText",false,' + json.dumps(TRANSLATED2) + ');'
      'window.slateBypass=false;return 1;})()')
time.sleep(0.3)
m_old = px.ev('slateModelText()')
d_old = px.ev('slateEl.innerText')
check('T2a OLD execCommand desyncs model (reproduces the bug)', m_old != d_old,
      'model=%r dom=%r' % (m_old, d_old))

# T2b: NEW code - beforeinput path
px.ev('slateSetState(' + json.dumps(SEED_SLATE) + ')')
px.ev('replaceText(' + json.dumps(TRANSLATED2) + ', "editable")', await_promise=True)
time.sleep(0.4)
m_new = px.ev('slateModelText()')
d_new = px.ev('slateEl.innerText')
check('T2b NEW model replaced via beforeinput', m_new == TRANSLATED2, repr(m_new))
check('T2b NEW dom matches model (no overlap)', d_new == m_new, repr(d_new))
px.backspace(); time.sleep(0.2)
m_bs = px.ev('slateModelText()')
check('T2b backspace works (model-driven)', m_bs == TRANSLATED2[:-1], repr(m_bs))
px.type_text('!'); time.sleep(0.2)
m_ty = px.ev('slateModelText()')
check('T2b typing works after translate', m_ty == TRANSLATED2[:-1] + '!', repr(m_ty))

# T2c: selection inside a rich editable
px.ev('(function(){slateSetState(' + json.dumps(SEED_SLATE) + ');'
      'var s=window.getSelection();var r=document.createRange();r.selectNodeContents(slateEl);'
      's.removeAllRanges();s.addRange(r);slateEl.focus();return 1;})()')
px.ev('replaceText(' + json.dumps(TRANSLATED3) + ', "editable-selection")', await_promise=True)
time.sleep(0.4)
m_sel = px.ev('slateModelText()')
check('T2c editable-selection via beforeinput', m_sel == TRANSLATED3, repr(m_sel))

# T3: plain contenteditable -> execCommand fallback
px.ev('(function(){var p=document.querySelector("#plain");p.innerText=' + json.dumps(SEED_PLAIN) + ';p.focus();return 1;})()')
px.ev('replaceText(' + json.dumps(TRANSLATED3) + ', "editable")', await_promise=True)
time.sleep(0.3)
d3 = px.ev('document.querySelector("#plain").innerText')
check('T3 plain editable via execCommand fallback', TRANSLATED3 in (d3 or ''), repr(d3))
px.backspace(); time.sleep(0.2)
d3b = px.ev('document.querySelector("#plain").innerText')
check('T3 backspace works after fallback', (d3b or '').startswith(TRANSLATED3[:-1]), repr(d3b))

try: proc.terminate()
except Exception: pass
srv.shutdown()
fails = [n for n, ok in results if not ok]
print()
print('SUMMARY: %d/%d passed' % (len(results) - len(fails), len(results)))
print('E2E RESULT:', 'PASS' if not fails else 'FAIL: ' + ', '.join(fails))
