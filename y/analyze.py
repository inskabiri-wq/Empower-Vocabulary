import json
import re

with open('datasets.json', 'r', encoding='utf-8') as f:
    empower = json.load(f)
with open('gateway_dataset.json', 'r', encoding='utf-8') as f:
    gateway = json.load(f)

past_tense_map = {
    'go': ['went'], 'come': ['came'], 'see': ['saw'], 'write': ['wrote'], 
    'take': ['took'], 'make': ['made'], 'give': ['gave'], 'find': ['found'],
    'know': ['knew'], 'think': ['thought'], 'say': ['said'], 'get': ['got'],
    'have': ['had'], 'do': ['did'], 'be': ['was', 'were'], 'break': ['broke'],
    'begin': ['began'], 'understand': ['understood'], 'remember': ['remembered'],
    'leave': ['left'], 'tell': ['told'], 'show': ['showed'], 'ask': ['asked'],
    'speak': ['spoke'], 'try': ['tried'], 'run': ['ran'], 'keep': ['kept'],
    'stand': ['stood'], 'sit': ['sat'], 'open': ['opened'], 'close': ['closed'],
    'buy': ['bought'], 'sell': ['sold'], 'meet': ['met'], 'spend': ['spent'],
    'bring': ['brought'], 'teach': ['taught'], 'watch': ['watched'], 'listen': ['listened'],
    'read': ['read'], 'move': ['moved'], 'feel': ['felt'], 'hear': ['heard'],
    'lose': ['lost'], 'win': ['won'], 'choose': ['chose'], 'mean': ['meant'],
    'pay': ['paid'], 'eat': ['ate'], 'drink': ['drank'], 'sleep': ['slept'],
    'wake': ['woke'], 'grow': ['grew'], 'sing': ['sang'], 'dance': ['danced'],
    'laugh': ['laughed'], 'smile': ['smiled'], 'die': ['died'], 'kill': ['killed'],
    'hurt': ['hurt'], 'save': ['saved'], 'help': ['helped'], 'fight': ['fought'],
    'worry': ['worried'], 'hope': ['hoped'], 'fear': ['feared'], 'follow': ['followed'],
    'lead': ['led'], 'explain': ['explained'], 'describe': ['described'], 'build': ['built'],
    'draw': ['drew'], 'cry': ['cried'], 'learn': ['learned'], 'change': ['changed'],
    'turn': ['turned'], 'continue': ['continued'], 'pass': ['passed'], 'play': ['played'],
    'walk': ['walked'], 'work': ['worked'], 'talk': ['talked'], 'wait': ['waited'],
    'call': ['called'], 'answer': ['answered'], 'become': ['became'], 'seem': ['seemed'],
    'appear': ['appeared'], 'sound': ['sounded'], 'look': ['looked'], 'start': ['started'],
    'stop': ['stopped'], 'reach': ['reached'], 'return': ['returned'], 'arrive': ['arrived'],
    'mention': ['mentioned'], 'offer': ['offered'], 'point': ['pointed'], 'prepare': ['prepared'],
    'push': ['pushed'], 'suggest': ['suggested'], 'suppose': ['supposed'], 'use': ['used'],
    'want': ['wanted'], 'wear': ['wore'], 'refuse': ['refused'], 'steal': ['stole'],
    'cut': ['cut'], 'spread': ['spread'], 'let': ['let'], 'order': ['ordered'],
}

found = []

for dataset_name, dataset in [('empower', empower), ('gateway', gateway)]:
    for level in dataset:
        if isinstance(dataset[level], list):
            for entry in dataset[level]:
                if not entry.get('word') or not entry.get('ex') or entry.get('pos') != 'verb':
                    continue
                word = entry['word'].lower().strip()
                example = entry['ex']
                if word in past_tense_map:
                    for past_form in past_tense_map[word]:
                        regex = re.compile(r'\b' + re.escape(past_form) + r'\b', re.IGNORECASE)
                        match = regex.search(example)
                        if match:
                            base_regex = re.compile(r'\b' + re.escape(word) + r'\b', re.IGNORECASE)
                            if not base_regex.search(example):
                                found.append({'source': dataset_name, 'word': entry['word'], 'pastForm': match.group(0), 'example': example, 'level': entry.get('level', 'Unknown')})
                                break

level_order = ['A1', 'A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C2']
found.sort(key=lambda x: (level_order.index(x['level']) if x['level'] in level_order else 999, x['word']))

print("="*80)
print("WORDS WITH PAST TENSE IN EXAMPLE SENTENCES")
print("="*80)
print()
current_level = None
for result in found:
    if result['level'] != current_level:
        current_level = result['level']
        print(f"\nLEVEL: {current_level}\n")
    print(f"Word: {result['word']}")
    print(f"  Form in example: {result['pastForm']}")
    print(f"  Example: {result['example']}")
    print(f"  Source: {result['source']}")
    print()
print(f"\nTOTAL: {len(found)}")
