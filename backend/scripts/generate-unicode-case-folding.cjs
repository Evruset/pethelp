const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const UNICODE_VERSION = '17.0.0';
const source = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/CaseFolding.txt`;
const destination = path.resolve(__dirname, '../src/booking-core/unicode-case-folding-17.generated.ts');

https.get(source, (response) => {
  if (response.statusCode !== 200) throw new Error(`Unicode source returned ${response.statusCode}`);
  let text = '';
  response.setEncoding('utf8');
  response.on('data', (chunk) => { text += chunk; });
  response.on('end', () => {
    const entries = [];
    for (const line of text.split(/\r?\n/)) {
      const match = /^([0-9A-F]+);\s*([CFT]);\s*([0-9A-F ]+);/.exec(line);
      if (!match || match[2] === 'T') continue;
      entries.push([Number.parseInt(match[1], 16), match[3].trim().split(/\s+/).map((value) => Number.parseInt(value, 16))]);
    }
    const body = [
      '/* Generated from Unicode 17.0.0 CaseFolding.txt; do not edit manually. */',
      `export const UNICODE_CASE_FOLDING_VERSION = '${UNICODE_VERSION}' as const;`,
      `export const UNICODE_CASE_FOLDING = new Map<number, readonly number[]>(${JSON.stringify(entries)});`,
      '',
    ].join('\n');
    fs.writeFileSync(destination, body, 'utf8');
  });
}).on('error', (error) => { throw error; });
