#!/usr/bin/env node
import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';

const [envFile, command, ...args] = process.argv.slice(2);
if (!envFile || !command) {
  console.error('Usage: with-env.mjs ENV_FILE COMMAND [ARGS...]');
  process.exit(2);
}

loadEnvFile(envFile);
const expandedArgs = args.map((arg) => arg.replace(/\{([A-Z][A-Z0-9_]*)\}/g, (_, name) => process.env[name] ?? ''));
const result = spawnSync(command, expandedArgs, { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
