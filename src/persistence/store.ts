import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PersistedRetailerState } from '../domain/retailer';

/**
 * Atomic JSON state store: writes go to a temp file then rename() over the
 * target, so a crash mid-write never leaves a corrupt/partial state file.
 */
export class JsonStateStore {
  private readonly filePath: string;
  private cache: Record<string, PersistedRetailerState> = {};
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private tmpCounter = 0;

  constructor(dataDir: string, fileName = 'state.json') {
    this.filePath = path.join(dataDir, fileName);
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.cache = JSON.parse(raw) as Record<string, PersistedRetailerState>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.cache = {};
    }
    this.loaded = true;
  }

  get(retailerId: string): PersistedRetailerState | undefined {
    this.assertLoaded();
    return this.cache[retailerId];
  }

  getAll(): PersistedRetailerState[] {
    this.assertLoaded();
    return Object.values(this.cache);
  }

  async set(state: PersistedRetailerState): Promise<void> {
    this.assertLoaded();
    this.cache[state.retailerId] = state;
    const snapshot = { ...this.cache };
    const write = this.writeQueue.then(() => this.persist(snapshot));
    this.writeQueue = write.catch(() => undefined);
    await write;
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error('JsonStateStore.load() must be called before use');
  }

  private async persist(snapshot: Record<string, PersistedRetailerState>): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}-${this.tmpCounter++}`;
    await fs.writeFile(tmpPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.filePath);
  }
}
