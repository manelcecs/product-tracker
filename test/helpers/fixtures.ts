import { readFileSync } from 'node:fs';
import path from 'node:path';

export function loadFixture(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), 'test', 'fixtures', relativePath), 'utf-8');
}
