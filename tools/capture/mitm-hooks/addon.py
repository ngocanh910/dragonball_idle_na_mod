"""mitmproxy addon: log HTTP + Socket.IO frames to flows.jsonl and
trigger a phone screenshot per exchange.

Run:  mitmdump -s tools/capture/mitm-hooks/addon.py \
          -p 8081 --set session=my-session
Writes: captures/<session>/flows.jsonl  (exchange/notify lines)
Pokes:  http://127.0.0.1:8790/snap?seq=<n>  → adb-snapshot.mjs
"""
import json, os, time, urllib.request
from mitmproxy import http, websocket

SESSION = os.environ.get('CAP_SESSION', time.strftime('%Y%m%d-%H%M%S'))
BASE = os.path.join('captures', SESSION)
os.makedirs(os.path.join(BASE, 'shots'), exist_ok=True)
os.makedirs(os.path.join(BASE, 'ui'), exist_ok=True)
PATH = os.path.join(BASE, 'flows.jsonl')
SNAP_URL = 'http://127.0.0.1:8790/snap'
FLAG = os.path.join('captures', '.capture-on')
_seq = [0]
_conn_state = {}   # conn id -> { pending: {ack_id: {type, action, req}} }

def _enabled():
    # Recording toggle: only log frames + snap when captures/.capture-on exists.
    return os.path.exists(FLAG)

def _write(obj):
    with open(PATH, 'a') as f:
        f.write(json.dumps(obj) + '\n')

def _snap(seq):
    try:
        urllib.request.urlopen(f'{SNAP_URL}?seq={seq}', timeout=2).read()
    except Exception:
        pass  # adb snapshotter not running — capture still proceeds

def _log_exchange(state, res_body=None):
    if not _enabled():
        state['pending'] = {}   # dropped while off — don't let stale acks leak on re-enable
        return
    pend = state.pop('pending', {})
    # ack responses carry ack_id; simplest: attach to last pending
    for ack, rec in pend.items():
        if res_body is not None and rec.get('_acked'):
            continue
        rec['_acked'] = True
        seq = _seq[0] + 1; _seq[0] = seq
        _write({'conn': state['id'], 'seq': seq, 'ts': int(time.time() * 1000),
                'kind': 'exchange', 'type': rec['type'], 'action': rec['action'],
                'req': rec['req'], 'res': res_body})
        _snap(seq)
        return
    # ack with no pending event — still log it as an exchange
    rec = {}
    seq = _seq[0] + 1; _seq[0] = seq
    _write({'conn': state['id'], 'seq': seq, 'ts': int(time.time() * 1000),
            'kind': 'exchange', 'type': rec.get('type'), 'action': rec.get('action'),
            'req': rec.get('req'), 'res': res_body})
    _snap(seq)

def _handle_socket(conn_id, pkt):
    from engineio_parse import parse_frame
    p = parse_frame(pkt)
    if p is None:
        return
    st = _conn_state.setdefault(conn_id, {'id': conn_id, 'pending': {}})
    if p.kind == 'event' and p.name == 'handler.process':
        payload = p.data
        st['pending'][p.ack_id] = {'type': payload.get('type') if isinstance(payload, dict) else None,
                                   'action': payload.get('action') if isinstance(payload, dict) else None,
                                   'req': payload}
    elif p.kind == 'ack':
        _log_exchange(st, res_body=p.data)

def websocket_message(flow: http.HTTPFlow):
    for m in flow.websocket.messages:
        try:
            text = m.content.decode('utf-8', 'replace')
        except Exception:
            continue
        _handle_socket(flow.metadata.get('websocket_conn_id', id(flow)), text)
