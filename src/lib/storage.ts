import { supa } from './supabase';

const bucketEnv = process.env.SUPABASE_BUCKET;

if (!bucketEnv) {
  throw new Error('SUPABASE_BUCKET env not configured');
}

const bucket = bucketEnv;

export async function putFile(buffer: Buffer, key: string, mime: string) {
  const { error } = await supa.storage.from(bucket).upload(key, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (error) {
    throw error;
  }
}

export async function getFile(key: string) {
  const { data, error } = await supa.storage.from(bucket).download(key);
  if (error || !data) {
    throw error ?? new Error('Missing data');
  }
  return data;
}

export function publicKeyPath(id: string, filename: string) {
  return `${id}/${filename}`;
}

