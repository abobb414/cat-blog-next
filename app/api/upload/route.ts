import { NextRequest, NextResponse } from 'next/server';
import { r2Upload } from '@/lib/cloudflare';

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error';
}

/** 浏览器端压缩通常落在 100~600 KB；这里留足余量，兜住"压缩未生效直接传原图"的情况 */
const MAX_BYTES = 12 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
};

// ---------------------------------------------------------------------------
// 按文件头判断真实类型
// ---------------------------------------------------------------------------
// 不能信客户端传来的 file.type / 扩展名：把 a.txt 改名成 a.jpg，浏览器就会报
// image/jpeg。这里按魔数嗅探，并以嗅探结果作为落库类型。
// 注意：SVG 虽然是合法图片，但它是可执行脚本的 XML，放在公开 R2 桶里有 XSS 风险，直接拒收。
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const ascii = (offset: number, len: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + len));

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4).toLowerCase();
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif';
    if (brand.startsWith('heic') || brand.startsWith('heix') || brand.startsWith('mif1')) return 'image/heic';
  }
  return null;
}

/** 把原始文件名收敛成 R2 key 里安全的一段：只保留字母数字、下划线、连字符 */
function safeBaseName(name: string): string {
  const base = (name || '').replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(/[^\w-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || 'image';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '未检测到上传文件' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `图片超过 ${Math.round(MAX_BYTES / 1024 / 1024)} MB 上限，请先压缩后再上传` },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const head = new Uint8Array(arrayBuffer);

    // 先按魔数确认是图片，再决定存成什么类型
    const sniffed = sniffImageType(head);
    if (!sniffed) {
      const looksLikeSvg = /<svg|<\?xml/i.test(new TextDecoder().decode(head.subarray(0, 200)));
      return NextResponse.json(
        {
          error: looksLikeSvg
            ? '出于安全考虑不支持上传 SVG，请改用 JPG / PNG / WebP'
            : '文件内容不是有效的图片',
        },
        { status: 415 },
      );
    }

    const ext = EXT_BY_TYPE[sniffed] || 'bin';
    const filename = `${Date.now()}-${safeBaseName(file.name)}.${ext}`;
    const url = await r2Upload(filename, arrayBuffer, sniffed);

    return NextResponse.json({ url, size: file.size, type: sniffed });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
