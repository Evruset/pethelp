#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKSUM_ALGORITHM = 'SHA-256(path\\0content\\0, sorted requiredFiles)';
const REQUIRED_FILE_PATTERN = /["'(]((?:\.{0,2}\/)?[A-Za-z0-9_./-]+\.(?:css|gif|html|ico|jpe?g|js|json|png|svg|ttf|webp|woff2?))(?:[?#][^"')\s]*)?["')]/gi;

function unique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] ?? null;
}

function metaContent(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attribute(match[0], 'name') === name) return attribute(match[0], 'content');
  }
  return null;
}

function valuesFor(source, expressions) {
  const values = [];
  for (const expression of expressions) {
    for (const match of source.matchAll(expression)) values.push(match[1]);
  }
  return unique(values);
}

function requiredFileError(relativePath) {
  const error = new Error(`Required prototype file is missing: ${relativePath}`);
  error.code = 'REQUIRED_FILE_MISSING';
  return error;
}

async function readRequiredFile(absolutePath, prototypeRoot) {
  try {
    return await readFile(absolutePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw requiredFileError(path.relative(prototypeRoot, absolutePath));
    }
    throw error;
  }
}

async function readLinkedSources(html, entryPath, prototypeRoot, tagName, attributeName) {
  const expression = new RegExp(`<${tagName}\\b[^>]*\\b${attributeName}=["']([^"']+)["'][^>]*>`, 'gi');
  const root = path.dirname(entryPath);
  const linked = unique([...html.matchAll(expression)].map((match) => match[1]));
  const sources = [];

  for (const relativePath of linked) {
    if (/^(?:https?:|data:|\/\/)/i.test(relativePath)) continue;
    const resolvedPath = path.resolve(root, relativePath);
    const source = await readRequiredFile(resolvedPath, prototypeRoot);
    sources.push({ path: relativePath, absolutePath: resolvedPath, source: source.toString('utf8') });
  }

  return sources;
}

function referencedFiles(source, sourcePath, prototypeRoot) {
  const references = [];
  const baseDirectory = path.dirname(sourcePath);

  for (const match of source.matchAll(REQUIRED_FILE_PATTERN)) {
    const reference = match[1].split(/[?#]/, 1)[0];
    if (!reference || /^(?:https?:|data:|\/\/)/i.test(reference)) continue;
    if (!reference.includes('/')) continue;
    const absolutePath = path.resolve(baseDirectory, reference);
    const relativePath = path.relative(prototypeRoot, absolutePath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) continue;
    references.push(relativePath);
  }

  return references;
}

async function collectAssetFiles(prototypeRoot) {
  const files = [];

  for (const directory of ['integrated_assets', 'vethelp_icon_refresh', 'vethelp_media']) {
    const absoluteDirectory = path.resolve(prototypeRoot, directory);
    let entries;
    try {
      entries = await readdir(absoluteDirectory, { recursive: true, withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') throw requiredFileError(directory);
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      files.push(path.relative(prototypeRoot, path.resolve(entry.parentPath, entry.name)));
    }
  }

  return files;
}

async function checksumRequiredFiles(prototypeRoot, requiredFiles) {
  const checksum = createHash('sha256');

  for (const relativePath of requiredFiles) {
    const content = await readRequiredFile(path.resolve(prototypeRoot, relativePath), prototypeRoot);
    checksum.update(relativePath);
    checksum.update('\0');
    checksum.update(content);
    checksum.update('\0');
  }

  return checksum.digest('hex');
}

export async function inventoryPrototype(entryPath) {
  const resolvedEntry = path.resolve(entryPath);
  const prototypeRoot = path.dirname(resolvedEntry);
  const html = (await readRequiredFile(resolvedEntry, prototypeRoot)).toString('utf8');
  const scripts = await readLinkedSources(html, resolvedEntry, prototypeRoot, 'script', 'src');
  const styles = await readLinkedSources(html, resolvedEntry, prototypeRoot, 'link', 'href');
  const executableSource = [html, ...scripts.map((item) => item.source)].join('\n');
  const styleSource = styles.map((item) => item.source).join('\n');

  const screenNodes = [...html.matchAll(/\bdata-page=["']([^"']+)["']/gi)].map((match) => match[1]);
  const screens = unique(screenNodes);
  const routes = valuesFor(html, [/\bdata-route-link=["']([^"']+)["']/gi]);
  const primaryNavAnchors = [...html.matchAll(/<a\b[^>]*>/gi)]
    .filter((match) => /\bclass=["'][^"']*\b(?:nav-link|profile-card)\b[^"']*["']/i.test(match[0]))
    .map((match) => attribute(match[0], 'data-route-link'))
    .filter(Boolean);
  const states = valuesFor(executableSource, [
    /\b(?:state|status)\s*:\s*["']([A-Za-z0-9_-]+)["']/g,
    /\.status\s*=\s*["']([A-Za-z0-9_-]+)["']/g,
    /\.status\s*={2,3}\s*["']([A-Za-z0-9_-]+)["']/g,
    /\bdata-(?:state|status|demo)=["']([^"']+)["']/gi,
  ]);
  const roles = valuesFor(executableSource, [
    /\bdata-(?:clinic-role|admin-role)=["']([^"']+)["']/gi,
    /\brole\s*:\s*["']([A-Za-z0-9_-]+)["']/g,
    /\.role\s*={1,3}\s*["']([A-Za-z0-9_-]+)["']/g,
  ]);
  const mediaQueries = unique(
    [...styleSource.matchAll(/@media\s*([^\{]+)/gi)].map((match) => match[1].replace(/\s+/g, ' ').trim()),
  );
  const requiredFiles = unique([
    path.basename(resolvedEntry),
    ...scripts.map((item) => path.relative(prototypeRoot, item.absolutePath)),
    ...styles.map((item) => path.relative(prototypeRoot, item.absolutePath)),
    ...referencedFiles(html, resolvedEntry, prototypeRoot),
    ...scripts.flatMap((item) => referencedFiles(item.source, item.absolutePath, prototypeRoot)),
    ...styles.flatMap((item) => referencedFiles(item.source, item.absolutePath, prototypeRoot)),
    ...await collectAssetFiles(prototypeRoot),
  ]);
  const sha256 = await checksumRequiredFiles(prototypeRoot, requiredFiles);
  const version = metaContent(html, 'vethelp-prototype-version');

  return {
    entry: path.relative(process.cwd(), resolvedEntry),
    sourcePath: path.relative(process.cwd(), prototypeRoot),
    version,
    revision: metaContent(html, 'vethelp-prototype-revision'),
    sourceClassification: /^v50(?:\b|-)/i.test(version ?? '') ? 'AUTHORITATIVE_V50' : 'UNSUPPORTED_TARGET',
    screens,
    screenNodes: screenNodes.length,
    duplicateScreenNodes: unique(screenNodes.filter((screen, index) => screenNodes.indexOf(screen) !== index)),
    routes,
    primaryNavAnchors,
    states,
    roles,
    responsive: {
      desktop: mediaQueries.some((query) => /min-width\s*:\s*(?:961|1121)px/i.test(query)),
      tablet: mediaQueries.some((query) => /min-width\s*:\s*(?:701|761|768)px/i.test(query) && /max-width/i.test(query)),
      mobile: mediaQueries.some((query) => /max-width\s*:\s*(?:420|430|480|520|580|640|650|700|720|760|767|768)px/i.test(query)),
      reducedMotion: mediaQueries.some((query) => /prefers-reduced-motion/i.test(query)),
      mediaQueries,
    },
    linkedFiles: {
      scripts: scripts.map((item) => item.path),
      styles: styles.map((item) => item.path),
    },
    requiredFiles,
    checksumAlgorithm: CHECKSUM_ALGORITHM,
    sha256,
  };
}

function isV50(inventory) {
  return inventory.entry === 'prototype-v50/index.html' && /^v50(?:\b|-)/i.test(inventory.version ?? '');
}

export function sourceManifest(inventory, generatedAt = new Date().toISOString()) {
  return {
    prototypeVersion: 'V50',
    sourcePath: inventory.sourcePath,
    entrypoint: path.basename(inventory.entry),
    sourceRevision: inventory.version,
    generatedAt,
    screenCount: inventory.screens.length,
    domScreenNodeCount: inventory.screenNodes,
    routeCount: inventory.routes.length,
    primaryNavigationCount: inventory.primaryNavAnchors.length,
    stateTokenCount: inventory.states.length,
    roles: inventory.roles,
    responsiveVariants: Object.entries(inventory.responsive)
      .filter(([key, value]) => key !== 'mediaQueries' && value)
      .map(([key]) => key),
    requiredFiles: inventory.requiredFiles,
    checksumAlgorithm: inventory.checksumAlgorithm,
    sha256: inventory.sha256,
  };
}

async function verifyManifest(inventory) {
  const manifestPath = path.resolve(path.dirname(inventory.entry), 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    error.code = error?.code === 'ENOENT' ? 'MANIFEST_MISSING' : 'MANIFEST_INVALID';
    throw error;
  }

  const expected = sourceManifest(inventory, manifest.generatedAt);
  if (!manifest.generatedAt || Number.isNaN(Date.parse(manifest.generatedAt)) || JSON.stringify(manifest) !== JSON.stringify(expected)) {
    const error = new Error('prototype-v50/manifest.json does not match extracted source evidence');
    error.code = 'MANIFEST_MISMATCH';
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--require-v51')) {
    console.error('code=UNSUPPORTED_TARGET_VERSION');
    console.error('message=Target V51 does not exist. Canonical target is V50.');
    process.exitCode = 2;
    return;
  }

  const requireV50 = args.includes('--require-v50');
  const verifySourceManifest = args.includes('--verify-manifest');
  const manifestJson = args.includes('--manifest-json');
  const json = args.includes('--json');
  const entry = args.find((arg) => !arg.startsWith('--')) ?? 'prototype-v50/index.html';

  let inventory;
  try {
    inventory = await inventoryPrototype(entry);
  } catch (error) {
    if (error?.code === 'REQUIRED_FILE_MISSING') {
      console.error(`code=${error.code}`);
      console.error(`message=${error.message}`);
      process.exitCode = 4;
      return;
    }
    throw error;
  }

  if (requireV50 && !isV50(inventory)) {
    console.error('code=TARGET_VERSION_MISMATCH');
    console.error(`message=Expected prototype-v50/index.html declaring V50; received ${inventory.entry} declaring ${inventory.version ?? 'no version'}.`);
    process.exitCode = 3;
    return;
  }

  if (verifySourceManifest) {
    try {
      await verifyManifest(inventory);
    } catch (error) {
      console.error(`code=${error.code ?? 'MANIFEST_INVALID'}`);
      console.error(`message=${error.message}`);
      process.exitCode = 5;
      return;
    }
  }

  if (manifestJson) {
    console.log(JSON.stringify(sourceManifest(inventory), null, 2));
  } else if (json) {
    console.log(JSON.stringify(inventory, null, 2));
  } else {
    console.log(`source=${inventory.entry}`);
    console.log(`version=${inventory.version ?? 'unknown'}`);
    console.log(`revision=${inventory.revision ?? 'unknown'}`);
    console.log(`classification=${inventory.sourceClassification}`);
    console.log(`screens=${inventory.screens.length}`);
    console.log(`screenNodes=${inventory.screenNodes}`);
    console.log(`duplicateScreenNodes=${inventory.duplicateScreenNodes.join(',') || 'none'}`);
    console.log(`routes=${inventory.routes.length}`);
    console.log(`primaryNavAnchors=${inventory.primaryNavAnchors.length}`);
    console.log(`states=${inventory.states.length}`);
    console.log(`roles=${inventory.roles.join(',') || 'none'}`);
    console.log(`responsive=${Object.entries(inventory.responsive).filter(([key, value]) => key !== 'mediaQueries' && value).map(([key]) => key).join(',')}`);
    console.log(`requiredFiles=${inventory.requiredFiles.length}`);
    console.log(`sha256=${inventory.sha256}`);
    if (verifySourceManifest) console.log('manifest=verified');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
