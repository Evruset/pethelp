import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ?? 'postgres://vethelp:vethelp@localhost:5432/vethelp';
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const directory = resolve(process.cwd(), 'migrations');
    const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    for (const name of names) {
      await client.query(await readFile(resolve(directory, name), 'utf8'));
      console.log(`Applied ${name}`);
    }
  } finally {
    await client.end();
  }
}

void main();
