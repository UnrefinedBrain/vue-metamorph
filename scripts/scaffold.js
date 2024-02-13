#!/usr/bin/env node
/* eslint-disable no-console */
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import process from 'process';
import url from 'url';

const templateDir = path.resolve(url.fileURLToPath(new URL('.', import.meta.url)), '../template');

const name = process.argv[2];

if (!name || name === '') {
  console.error(chalk.red('Error: must supply a project name'));
  process.exit(1);
}

const targetDir = path.join(process.cwd(), name);

fs.mkdirSync(targetDir);
fs.copySync(templateDir, targetDir);
console.log(chalk.green(`Created vue-metamorph project at ${targetDir}`));
process.exit(0);
