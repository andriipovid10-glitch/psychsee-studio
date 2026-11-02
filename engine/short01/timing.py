"""short01 timing: ASR words (asr/vo.asr.json) -> timing.json with named cues (word start, seconds, + LEAD)."""
import json, re
LEAD, TAIL = .15, 1.2
W = json.load(open('asr/vo.asr.json'))['words']
norm = lambda w: re.sub(r"[^a-z0-9%']", '', w.lower())
CUES = {'vis': 'visualizing', 'dream': 'dream', 'reason': 'reason', 'dont': "don't", 'students': 'students', 'grade': 'a', 'studied': 'studied',
        'less': 'less', 'scored': 'scored', 'worse': 'worse', 'when': 'when', 'win': 'win', 'relaxes': 'relaxes', 'already': 'already',
        'energy': 'energy', 'drops': 'drops', 'but': 'but', 'fake': 'fake', 'study': 'study', 'imagined': 'imagined', 'finger': 'finger',
        'pct': '35%', 'stronger': 'stronger', 'no': 'no', 'weights': 'weights', 'difference': 'difference', 'work': 'work', 'trophy': 'trophy',
        'stop': 'stop', 'finish': 'finish', 'reps': 'reps', 'brain': 'brain', 'practice': 'practice', 'follow': 'follow', 'mind': 'mind', 'back': 'back'}
cues = {}
for k, w in CUES.items():
    hit = next(x for x in W if norm(x['text']) == w)
    cues[k] = round(hit['start_ms'] / 1000 + LEAD, 3)
cues['end'] = round(W[-1]['end_ms'] / 1000 + LEAD, 3)
json.dump({'duration': round(cues['end'] + TAIL, 3), 'offset': 0, 'lead': LEAD, 'cues': cues,
           'words': [{'w': x['text'], 's': round(x['start_ms'] / 1000 + LEAD, 3), 'e': round(x['end_ms'] / 1000 + LEAD, 3)} for x in W]},
          open('timing.json', 'w'), indent=1)
print(cues, cues['end'] + TAIL)
