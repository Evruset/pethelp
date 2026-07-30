#!/usr/bin/env node

process.stderr.write([
  'LEGACY_ENTRYPOINT_DEPRECATED',
  'This diagnostic owned an independent Compose and unscoped mutating fixture lifecycle.',
  'Replacement: ./start-vethelp.sh status or ./start-vethelp.sh smoke',
  '',
].join('\n'));
process.exit(64);
