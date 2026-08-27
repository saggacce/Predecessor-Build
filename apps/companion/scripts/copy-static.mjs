import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(packageRoot, 'dist', 'overlay');

await mkdir(target, { recursive: true });
await cp(join(packageRoot, 'src', 'overlay'), target, { recursive: true });
