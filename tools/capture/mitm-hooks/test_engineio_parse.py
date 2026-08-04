import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from engineio_parse import parse_frame

def test_event_with_ack_in_array():
    # engine '4' + socket '2' + JSON ["handler.process", {..}, ackId]
    raw = '42' + json.dumps(['handler.process', {'type': 'hero', 'action': 'getAttrs'}, 12])
    pkt = parse_frame(raw)
    assert pkt.kind == 'event', pkt
    assert pkt.name == 'handler.process'
    assert pkt.ack_id == 12
    assert pkt.data['type'] == 'hero'

def test_event_id_prefix_form():
    # v2 encoder: '2<id>["event", data]' (id prefix, not in array)
    raw = '4' + '2' + '7' + json.dumps(['Notify', {'a': 1}])
    pkt = parse_frame(raw)
    assert pkt.kind == 'event' and pkt.ack_id == 7 and pkt.data['a'] == 1

def test_ack_response():
    raw = '4' + '3' + json.dumps([12, {'ret': 0, 'data': '{}'}])
    pkt = parse_frame(raw)
    assert pkt.kind == 'ack' and pkt.ack_id == 12
    assert pkt.data == {'ret': 0, 'data': '{}'}

def test_ping_pong_ignored():
    assert parse_frame('2') is None      # engine ping
    assert parse_frame('3') is None      # engine pong
    assert parse_frame('40') is None     # socket connect

def test_namespace_event():
    raw = '4' + '2' + '5' + '/admin,' + json.dumps(['x', 1])
    pkt = parse_frame(raw)
    assert pkt.kind == 'event' and pkt.ack_id == 5 and pkt.namespace == '/admin'
