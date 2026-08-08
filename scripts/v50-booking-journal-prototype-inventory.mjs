#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_STATES = [
  'reception-ready', 'admin-ready', 'veterinarian-limited', 'multi-role-ready',
  'pending-request', 'request-due-soon', 'request-overdue', 'confirmed-appointment',
  'alternative-selection', 'owner-decision-pending', 'reject-confirmation', 'manual-booking',
  'client-lookup', 'quick-client-create', 'operational-empty', 'no-staff', 'technical-error',
  'stale-retained', 'forbidden', 'slot-conflict', 'search-results', 'search-empty',
  'filters-active', 'week-view', 'mobile-agenda',
  'week-view-selected', 'week-alternative-selection', 'manual-booking-invalid',
  'mobile-pending-detail', 'mobile-manual-booking',
];
export const REQUIRED_ROLES = ['reception', 'admin', 'veterinarian', 'multi-role'];
export const REQUIRED_VIEWPORTS = [
  '1440x900', '1920x1080', '1024x768', '768x1024', '375x812', '412x915',
];
export const CHECKSUM_ALGORITHM = 'sha256(path\\0content\\0, sorted requiredFiles; manifest.json and generatedAt excluded)';

const EXTERNAL_REFERENCE = /(?:https?:)?\/\/[^\s"'<>\)]+/gi;
const STATIC_ASSET_EXTENSION = /\.(?:avif|css|gif|html?|ico|jpe?g|js|json|png|svg|webp|woff2?)(?:[?#].*)?$/i;

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function normalizeViewport(value) {
  if (typeof value === 'string') return value.toLowerCase().replace(/[×\s]/g, 'x');
  if (value && Number.isInteger(value.width) && Number.isInteger(value.height)) return `${value.width}x${value.height}`;
  return String(value);
}

function validationError(errors) {
  const error = new Error(errors.join('\n'));
  error.code = 'PROTOTYPE_INVENTORY_INVALID';
  error.failures = errors;
  return error;
}

async function readRequired(absolutePath, root, errors, label = path.relative(root, absolutePath)) {
  try {
    return await readFile(absolutePath);
  } catch (error) {
    errors.push(`missing local path: ${label}`);
    return null;
  }
}

function localReferences(source, sourceType) {
  let references = [];
  if (sourceType === 'html') {
    references = [...source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  } else if (sourceType === 'css') {
    references = [...source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((match) => match[1]);
  } else if (sourceType === 'js') {
    references = [
      ...[...source.matchAll(/\bnew\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)].map((match) => match[1]),
      ...[...source.matchAll(/["']((?:\.\.\/|\.\/|assets\/)[^"']+)["']/g)].map((match) => match[1]),
    ].filter((reference) => STATIC_ASSET_EXTENSION.test(reference));
  }
  return references.filter((reference) => reference && !/^(?:#|\?|data:|mailto:|tel:|javascript:|https?:|\/\/)/i.test(reference));
}

function resolveLocalReference(reference, sourcePath, root, errors) {
  const pathname = reference.split(/[?#]/, 1)[0];
  if (!pathname) return null;
  const absolutePath = path.resolve(path.dirname(sourcePath), pathname);
  const relativePath = path.relative(root, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    errors.push(`local path escapes prototype root: ${reference}`);
    return null;
  }
  return { absolutePath, relativePath };
}

function tagAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? null;
}

async function checksumFiles(root, requiredFiles, errors) {
  const hash = createHash('sha256');
  for (const relativePath of requiredFiles) {
    if (relativePath === 'manifest.json') {
      errors.push('manifest.json must not be included in requiredFiles (checksum would be recursive)');
      continue;
    }
    const content = await readRequired(path.resolve(root, relativePath), root, errors, relativePath);
    if (!content) continue;
    hash.update(relativePath);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function inventoryPrototype(rootPath, { verifyManifest = false } = {}) {
  const root = path.resolve(rootPath);
  const errors = [];
  const manifestPath = path.join(root, 'manifest.json');
  let manifest = null;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    errors.push(error?.code === 'ENOENT' ? 'manifest missing: manifest.json' : `manifest invalid JSON: ${error.message}`);
  }

  const entrypoint = manifest?.entrypoint ?? 'index.html';
  const entryPath = path.resolve(root, entrypoint);
  if (path.relative(root, entryPath).startsWith('..')) errors.push(`entrypoint escapes prototype root: ${entrypoint}`);
  const entryBuffer = await readRequired(entryPath, root, errors, entrypoint);
  const html = entryBuffer?.toString('utf8') ?? '';

  const linkedStyles = unique([...html.matchAll(/<link\b[^>]*>/gi)]
    .filter((match) => /\brel\s*=\s*["'][^"']*stylesheet/i.test(match[0]))
    .map((match) => tagAttribute(match[0], 'href')).filter(Boolean));
  const linkedScripts = unique([...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>/gi)]
    .map((match) => tagAttribute(match[0], 'src')).filter(Boolean));
  if (linkedStyles.length === 0) errors.push('entrypoint has no linked CSS');
  if (linkedScripts.length === 0) errors.push('entrypoint has no linked JavaScript');

  const sources = [{ relativePath: entrypoint, absolutePath: entryPath, source: html, sourceType: 'html' }];
  for (const reference of [...linkedStyles, ...linkedScripts]) {
    const resolved = resolveLocalReference(reference, entryPath, root, errors);
    if (!resolved) continue;
    const content = await readRequired(resolved.absolutePath, root, errors, resolved.relativePath);
    if (content) sources.push({ ...resolved, source: content.toString('utf8'), sourceType: linkedStyles.includes(reference) ? 'css' : 'js' });
  }

  const missingPaths = [];
  for (let index = 0; index < sources.length; index += 1) {
    const item = sources[index];
    for (const reference of localReferences(item.source, item.sourceType)) {
      const resolved = resolveLocalReference(reference, item.absolutePath, root, errors);
      if (!resolved || sources.some((source) => source.absolutePath === resolved.absolutePath)) continue;
      try {
        await access(resolved.absolutePath);
      } catch {
        missingPaths.push(resolved.relativePath);
      }
    }
  }
  for (const missingPath of unique(missingPaths)) errors.push(`missing local path: ${missingPath}`);

  const combinedSource = sources.map((item) => item.source).join('\n');
  const externalDependencies = unique(combinedSource.match(EXTERNAL_REFERENCE) ?? []);
  if (externalDependencies.length) errors.push(`external HTTP(S) dependencies: ${externalDependencies.join(', ')}`);
  if (/<iframe\b/i.test(html)) errors.push('unexpected iframe');
  const inlineHandlers = unique([...html.matchAll(/\s(on[a-z]+)\s*=/gi)].map((match) => match[1].toLowerCase()));
  if (inlineHandlers.length) errors.push(`inline event handlers: ${inlineHandlers.join(', ')}`);

  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = unique(ids.filter((id, index) => ids.indexOf(id) !== index));
  if (duplicateIds.length) errors.push(`duplicate IDs: ${duplicateIds.join(', ')}`);

  const landmarks = {
    header: /<header\b|\brole\s*=\s*["']banner["']/i.test(html),
    navigation: /<nav\b|\brole\s*=\s*["']navigation["']/i.test(html),
    main: /<main\b|\brole\s*=\s*["']main["']/i.test(html),
  };
  for (const [landmark, present] of Object.entries(landmarks)) if (!present) errors.push(`required landmark missing: ${landmark}`);

  const states = Array.isArray(manifest?.states) ? manifest.states : [];
  const roles = Array.isArray(manifest?.roles) ? manifest.roles : [];
  const viewports = Array.isArray(manifest?.viewports) ? manifest.viewports.map(normalizeViewport) : [];
  const missingStates = REQUIRED_STATES.filter((state) => !states.includes(state));
  const extraStates = states.filter((state) => !REQUIRED_STATES.includes(state));
  if (states.length !== REQUIRED_STATES.length || missingStates.length || extraStates.length) {
    errors.push(`state inventory mismatch: expected=${REQUIRED_STATES.length} actual=${states.length} missing=${missingStates.join(',') || 'none'} extra=${extraStates.join(',') || 'none'}`);
  }
  const missingRoles = REQUIRED_ROLES.filter((role) => !roles.includes(role));
  if (roles.length !== REQUIRED_ROLES.length || missingRoles.length) errors.push(`role inventory mismatch: expected=4 actual=${roles.length} missing=${missingRoles.join(',') || 'none'}`);
  const missingViewports = REQUIRED_VIEWPORTS.filter((viewport) => !viewports.includes(viewport));
  if (viewports.length !== REQUIRED_VIEWPORTS.length || missingViewports.length) errors.push(`viewport inventory mismatch: expected=6 actual=${viewports.length} missing=${missingViewports.join(',') || 'none'}`);

  const missingStateLabels = REQUIRED_STATES.filter((state) => !combinedSource.includes(state));
  if (missingStateLabels.length) errors.push(`required state labels missing from prototype source: ${missingStateLabels.join(', ')}`);
  const deterministicUrls = REQUIRED_STATES.map((state) => `index.html?state=${state}&role=${state === 'admin-ready' ? 'admin' : state === 'veterinarian-limited' ? 'veterinarian' : state === 'multi-role-ready' ? 'multi-role' : 'reception'}&date=2026-08-01`);

  const requiredFiles = Array.isArray(manifest?.requiredFiles) ? unique(manifest.requiredFiles) : [];
  if (!requiredFiles.includes(entrypoint)) errors.push(`requiredFiles does not include entrypoint: ${entrypoint}`);
  for (const reference of [...linkedStyles, ...linkedScripts]) {
    const resolved = resolveLocalReference(reference, entryPath, root, errors);
    if (resolved && !requiredFiles.includes(resolved.relativePath)) errors.push(`requiredFiles does not include linked file: ${resolved.relativePath}`);
  }
  const sha256 = await checksumFiles(root, requiredFiles, errors);

  if (verifyManifest && manifest) {
    if (manifest.prototypeId !== 'V50-CLINIC-MVP1-02') errors.push(`manifest prototypeId mismatch: ${manifest.prototypeId ?? 'missing'}`);
    if (manifest.externalDependencies?.length !== 0) errors.push('manifest externalDependencies must be empty');
    if (manifest.checksumAlgorithm !== CHECKSUM_ALGORITHM) errors.push('manifest checksumAlgorithm mismatch');
    if (manifest.sha256 !== sha256) errors.push(`manifest checksum mismatch: expected=${sha256} actual=${manifest.sha256 ?? 'missing'}`);
  }

  const inventory = {
    root: path.relative(process.cwd(), root), entrypoint,
    files: { css: linkedStyles.length, js: linkedScripts.length, required: requiredFiles.length, assets: requiredFiles.filter((file) => file.startsWith('assets/')).length },
    states, roles, viewports, deterministicUrls, missingLocalPaths: unique(missingPaths), externalDependencies,
    iframeCount: (html.match(/<iframe\b/gi) ?? []).length, inlineHandlers, duplicateIds, landmarks,
    requiredStateLabels: { expected: REQUIRED_STATES.length, missing: missingStateLabels },
    checksumAlgorithm: CHECKSUM_ALGORITHM, sha256, manifestVerified: verifyManifest && errors.length === 0,
  };
  if (errors.length) throw validationError(errors);
  return inventory;
}

async function main() {
  const args = process.argv.slice(2);
  const root = args.find((arg) => !arg.startsWith('--')) ?? 'prototype-v50/clinic-booking-journal';
  try {
    const inventory = await inventoryPrototype(root, { verifyManifest: args.includes('--verify-manifest') });
    if (args.includes('--json')) console.log(JSON.stringify(inventory, null, 2));
    else {
      console.log(`prototype=${inventory.root}`);
      console.log(`entrypoint=${inventory.entrypoint}`);
      console.log(`files=css:${inventory.files.css},js:${inventory.files.js},assets:${inventory.files.assets},required:${inventory.files.required}`);
      console.log(`states=${inventory.states.length}`);
      console.log(`roles=${inventory.roles.length}`);
      console.log(`viewports=${inventory.viewports.length}`);
      console.log(`missingLocalPaths=${inventory.missingLocalPaths.length}`);
      console.log(`externalDependencies=${inventory.externalDependencies.length}`);
      console.log(`duplicateIds=${inventory.duplicateIds.length}`);
      console.log(`sha256=${inventory.sha256}`);
      if (inventory.manifestVerified) console.log('manifest=verified');
    }
  } catch (error) {
    console.error(`code=${error.code ?? 'PROTOTYPE_INVENTORY_ERROR'}`);
    for (const failure of error.failures ?? [error.message]) console.error(`failure=${failure}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
