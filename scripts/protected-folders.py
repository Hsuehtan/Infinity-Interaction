"""Compatibility entry point for the source-protection gate retired by the user."""

import json
import sys

if len(sys.argv) > 1:
    raise SystemExit(
        'Source protection was retired on 2026-10-07; no arguments are supported. '
        'The historical baseline will not be recorded or overwritten.'
    )

print(json.dumps({
    'status': 'retired',
    'effectiveDate': '2026-10-07',
    'directories': ['MVPdemo', 'UXdemo', 'OpenFMV'],
    'classification': 'P3',
    'integrityChecked': False,
    'reason': 'User revoked read-only protection for historical demo/reference projects.',
    'historicalBaseline': 'tasks/reports/protected-folders.json',
}))
