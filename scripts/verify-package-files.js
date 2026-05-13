#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import process from 'process';
import url from 'url';

const pkgPath = path.resolve(url.fileURLToPath(new URL('.', import.meta.url)), '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const pkgDir = path.dirname(pkgPath);

function collectPaths(node, jsonPath, out) {
  if (typeof node === 'string') {
    out.push({ jsonPath, file: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectPaths(item, `${jsonPath}[${i}]`, out));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectPaths(value, `${jsonPath}.${key}`, out);
    }
  }
}

const refs = [];
for (const field of ['main', 'types', 'typings', 'exports']) {
  if (pkg[field] !== undefined) collectPaths(pkg[field], field, refs);
}

const missing = refs.filter(({ file }) => !fs.existsSync(path.join(pkgDir, file)));

if (missing.length > 0) {
  console.error('package.json references files that do not exist after build:');
  for (const { jsonPath, file } of missing) {
    console.error(`  ${jsonPath}: ${file}`);
  }
  process.exit(1);
}

console.log(`Verified ${refs.length} package.json file reference(s).`);
