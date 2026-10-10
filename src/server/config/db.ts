import mongoose from 'mongoose';
import { config } from './env.ts';

let isConnected = false;

export async function connectDB(uri?: string): Promise<typeof mongoose | null> {
  const mongoUri = uri || config.mongodbUri;

  if (mongoose.connection.readyState >= 1) {
    isConnected = true;
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    isConnected = false;
    console.error(`[MongoDB] Connection error: ${(error as Error).message}`);
    // Do not crash the entire process immediately so the health endpoint can report connection status
    return null;
  }
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected');
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getDbState(): { state: string; isConnected: boolean; host?: string; name?: string } {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const stateIndex = mongoose.connection.readyState;
  return {
    state: states[stateIndex] || 'unknown',
    isConnected: stateIndex === 1,
    host: mongoose.connection.host || undefined,
    name: mongoose.connection.name || undefined,
  };
}
