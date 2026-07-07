// Cloudflare REST API helpers for D1 and R2

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID!;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!; // https://pub-xxx.r2.dev

export type D1Row = Record<string, string | number | boolean | null>;

interface CloudflareResponse<T> {
  success: boolean;
  errors?: unknown[];
  result?: Array<{ results?: T[] }>;
}

// ==================== D1 Query ====================
export async function d1Query(sql: string, params: unknown[] = []): Promise<D1Row[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const data = (await res.json()) as CloudflareResponse<D1Row>;
  if (!data.success) {
    throw new Error(`D1 Error: ${JSON.stringify(data.errors)}`);
  }
  return data.result?.[0]?.results || [];
}

// ==================== R2 Upload ====================
export async function r2Upload(filename: string, arrayBuffer: ArrayBuffer, contentType: string): Promise<string> {
  // 使用 Cloudflare API 上传到 R2
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/mimi-cat-photos/objects/${filename}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': contentType,
    },
    body: arrayBuffer,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`R2 Upload Error: ${JSON.stringify(data.errors)}`);
  }
  return `${R2_PUBLIC_URL}/${filename}`;
}

// ==================== R2 Delete ====================
export async function r2Delete(filename: string) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/mimi-cat-photos/objects/${filename}`;
  await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  });
}

// ==================== Generate ID ====================
export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
