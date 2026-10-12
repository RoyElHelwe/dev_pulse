// Compiles the Solidity contracts in contracts/ with solc-js into contracts/build/contracts.json
// (ABI + bytecode per contract), read by src/chain at runtime. Run before `nest build` / `nest start`.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'contracts');
const require = createRequire(import.meta.url);

const sources = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.sol'))
    .map((f) => [f, { content: readFileSync(join(dir, f), 'utf8') }]),
);

// "@openzeppelin/contracts/..." imports come from node_modules.
function findImports(path) {
  try {
    return { contents: readFileSync(require.resolve(path), 'utf8') };
  } catch {
    return { error: `Not found: ${path}` };
  }
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // Cancun runs on Anvil and on Avalanche's C-Chain alike.
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
// Warnings from inside OpenZeppelin are its maintainers' business; show ours and every error.
for (const e of output.errors ?? [])
  if (e.severity === 'error' || !e.sourceLocation?.file.startsWith('@openzeppelin/'))
    console.error(e.formattedMessage);
if (errors.length > 0) process.exit(1);

const contracts = {};
for (const file of Object.keys(sources)) {
  for (const [name, c] of Object.entries(output.contracts[file]))
    contracts[name] = { abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` };
}
mkdirSync(join(dir, 'build'), { recursive: true });
writeFileSync(
  join(dir, 'build', 'contracts.json'),
  JSON.stringify({ compiler: solc.version(), contracts }),
);
console.log(`Compiled ${Object.keys(contracts).join(', ')} with solc ${solc.version()}`);
