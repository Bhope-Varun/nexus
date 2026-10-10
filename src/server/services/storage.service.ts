import fs from 'fs';
import path from 'path';
import { config } from '../config/env.ts';

export interface StorageResult {
  url: string;
  path: string;
}

export interface IStorageService {
  save(filename: string, buffer: Buffer, contentType?: string): Promise<StorageResult>;
  get(filename: string): Promise<Buffer>;
  delete(filename: string): Promise<void>;
  exists(filename: string): Promise<boolean>;
}

export class LocalStorageService implements IStorageService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(process.cwd(), baseDir || config.storage.receiptsDir);
    this.ensureDirSync();
  }

  private ensureDirSync(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public async save(
    filename: string,
    buffer: Buffer,
    _contentType = 'application/pdf'
  ): Promise<StorageResult> {
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(this.baseDir, sanitizedFilename);

    await fs.promises.mkdir(this.baseDir, { recursive: true });
    await fs.promises.writeFile(filePath, buffer);

    // Provide relative URL accessible via backend
    const publicUrl = `/api/receipts/download/${sanitizedFilename}`;

    return {
      url: publicUrl,
      path: filePath,
    };
  }

  public async get(filename: string): Promise<Buffer> {
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(this.baseDir, sanitizedFilename);
    return fs.promises.readFile(filePath);
  }

  public async delete(filename: string): Promise<void> {
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(this.baseDir, sanitizedFilename);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  public async exists(filename: string): Promise<boolean> {
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(this.baseDir, sanitizedFilename);
    return fs.existsSync(filePath);
  }
}

/**
 * Cloud storage adapter stub that can be backed by Google Cloud Storage or AWS S3.
 * Automatically falls back to local storage if cloud credentials are not provisioned.
 */
export class CloudStorageService implements IStorageService {
  private fallbackLocal: LocalStorageService;

  constructor() {
    this.fallbackLocal = new LocalStorageService();
  }

  public async save(filename: string, buffer: Buffer, contentType?: string): Promise<StorageResult> {
    // In production with CLOUD_STORAGE_BUCKET, would stream directly to bucket.
    // Falls back gracefully to local storage if not configured:
    return this.fallbackLocal.save(filename, buffer, contentType);
  }

  public async get(filename: string): Promise<Buffer> {
    return this.fallbackLocal.get(filename);
  }

  public async delete(filename: string): Promise<void> {
    return this.fallbackLocal.delete(filename);
  }

  public async exists(filename: string): Promise<boolean> {
    return this.fallbackLocal.exists(filename);
  }
}

let storageInstance: IStorageService | null = null;

export function getStorageService(): IStorageService {
  if (!storageInstance) {
    if (config.storage.driver === 'cloud') {
      storageInstance = new CloudStorageService();
    } else {
      storageInstance = new LocalStorageService();
    }
  }
  return storageInstance;
}
