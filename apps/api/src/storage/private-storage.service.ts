import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export type StoredPrivateFile = {
  key: string;
  absolutePath: string;
  size: number;
};

@Injectable()
export class PrivateStorageService {
  private readonly root: string;

  constructor() {
    this.root = resolve(process.env.DIGITAL_STORAGE_ROOT || join(process.cwd(), '.private-storage'));
  }

  async saveProductFile(
    productId: string,
    buffer: Buffer,
    extension: '.pdf' | '.epub',
  ): Promise<StoredPrivateFile> {
    const folder = join(this.root, 'products', productId);
    await mkdir(folder, { recursive: true });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const fileName = `${randomBytes(24).toString('hex')}${extension}`;
      const absolutePath = join(folder, fileName);
      try {
        await writeFile(absolutePath, buffer, { flag: 'wx', mode: 0o600 });
        const key = relative(this.root, absolutePath).split(sep).join('/');
        return { key, absolutePath, size: buffer.length };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST') throw error;
      }
    }

    throw new Error('Unable to allocate a private digital file name.');
  }

  async getFile(key: string): Promise<StoredPrivateFile | null> {
    const absolutePath = this.resolveKey(key);
    try {
      const info = await stat(absolutePath);
      if (!info.isFile()) return null;
      return { key, absolutePath, size: info.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async deleteFile(key: string | null | undefined): Promise<void> {
    if (!key) return;
    const absolutePath = this.resolveKey(key);
    try {
      await unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private resolveKey(key: string): string {
    if (!key || isAbsolute(key) || key.includes('\0')) {
      throw new Error('Invalid private storage key.');
    }

    const normalized = key.split('/').join(sep);
    const absolutePath = resolve(this.root, normalized);
    const rootPrefix = this.root.endsWith(sep) ? this.root : `${this.root}${sep}`;
    if (absolutePath !== this.root && !absolutePath.startsWith(rootPrefix)) {
      throw new Error('Private storage key escaped its root.');
    }
    return absolutePath;
  }
}
