"""Parse Socket.IO-over-WebSocket frames into typed packets.
Handles both ack-id-in-array (socket.io-client v1 style) and
ack-id-prefix (v2 encoder) encodings, plus namespaces.
Returns Packet(kind, name, data, ack_id, namespace) or None for
transport frames (ping/pong/connect) we do not need.
"""
import json
from dataclasses import dataclass
from typing import Optional

@dataclass
class Packet:
    kind: str              # 'event' | 'ack'
    name: Optional[str]    # event name (events only)
    data: object
    ack_id: Optional[int]
    namespace: str = '/'

def parse_frame(msg: str) -> Optional[Packet]:
    if not msg or not msg[0].isdigit():
        return None
    typ = int(msg[0])
    if typ != 4:           # only '4' message carries socket packets
        return None
    rest = msg[1:]
    if not rest or rest[0] not in '0123456':
        return None
    st = rest[0]           # socket.io packet type
    body = rest[1:]
    if st in '01456':      # connect/disconnect/error/binary — skip
        return None
    if st == '3':          # ACK: [ackId, data]
        arr = json.loads(body)
        return Packet('ack', None, arr[1] if len(arr) > 1 else None, arr[0])
    # st == '2' EVENT
    # v2 encoder prefixes the ack id before the payload: '2<id>[json]' or
    # '2<id>/<nsp>,<json>'. v1 keeps it inside the array — see below.
    ack_id = None
    if body and body[0].isdigit():
        j = 0
        while j < len(body) and body[j].isdigit():
            j += 1
        ack_id = int(body[:j])
        body = body[j:]
    # namespace prefix: '<id>/<nsp>,<json>' or '/<nsp>,<json>'
    nsp = '/'
    if body.startswith('/'):
        idx = body.index(',')
        nsp, body = body[:idx], body[idx + 1:]
    arr = json.loads(body)
    if not arr:
        return None
    if ack_id is None and isinstance(arr[0], int):
        # id-prefix-in-array form: [id, name, ...data]
        ack_id = arr[0]; name = arr[1]; data = arr[2] if len(arr) > 2 else None
        return Packet('event', name, data, ack_id, nsp)
    if ack_id is not None:
        # raw id-prefix form: [name, ...data]
        name = arr[0]
        data = arr[1:] if len(arr) > 2 else (arr[1] if len(arr) > 1 else None)
        return Packet('event', name, data, ack_id, nsp)
    name = arr[0]                        # v1 form: [name, ...data, ackId?]
    ack_id = arr[-1] if len(arr) > 1 and isinstance(arr[-1], int) else None
    data = arr[1] if len(arr) > 1 else None
    if ack_id is not None and len(arr) > 3:
        data = arr[1:-1]                 # multi-arg: [name, a, b, ackId]
    return Packet('event', name, data, ack_id, nsp)
