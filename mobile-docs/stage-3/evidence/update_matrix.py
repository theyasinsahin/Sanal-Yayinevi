# Applies the verification-pass results (matrix_results.json) to feature_parity_matrix.md.
# Columns: | ID | Feature | API | Flutter location | Implementation | Verification | Evidence | Limitations |
# Usage: python3 update_matrix.py matrix_results.json
import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, '..', 'feature_parity_matrix.md')
R = json.load(open(sys.argv[1]))  # {feature: [status, evidence, limitation or null]}

def cells_of(line):
    return [c.strip() for c in re.split(r'(?<!\\)\|', line)[1:-1]]

out, seen = [], set()
for line in open(P).read().split('\n'):
    if line.startswith('| F-'):
        # F-MSG-08 had an unescaped pipe that shifted its columns.
        line = line.replace('sendMessage(BOOK|QUOTE)', 'sendMessage(BOOK\\|QUOTE)')
        cells = cells_of(line)
        fid = cells[0]
        seen.add(fid)
        if fid in R and cells[4] == 'IMPLEMENTED':
            status, evidence, limitation = R[fid]
            cells[5] = status
            cells[6] = (cells[6] + '; ' if cells[6] not in ('', '—') else '') + evidence
            if limitation is not None:
                cells[7] = limitation
        line = '| ' + ' | '.join(cells) + ' |'
    out.append(line)
missing = [k for k in R if k not in seen]
if missing:
    sys.exit('unknown ids: %s' % missing)
text = '\n'.join(out)
open(P, 'w').write(text)
counts = collections.Counter()
for line in text.split('\n'):
    if line.startswith('| F-'):
        c = cells_of(line)
        counts[(c[4], c[5])] += 1
for k, v in sorted(counts.items()):
    print(v, k)
