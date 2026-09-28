// ============================================================================
// 上传前的浏览器端图片压缩
// ----------------------------------------------------------------------------
// 目标：手机直出照片动辄 4~12 MB，直接传 R2 既慢又占空间，页面加载也拖。
// 做法：createImageBitmap 解码（自动套用 EXIF 方向）→ canvas 缩放（必要时逐级
//       减半，避免一次性大幅下采样发糊）→ 编码 WebP（不支持时降级 JPEG）。
//
// 重要约束：
//   1. 只在浏览器里跑，不能被打包进 SSR 路径 —— 所有 DOM API 都写在函数体内。
//   2. 任何一步失败都必须**退回原文件**，绝不能因为压缩失败让用户传不了图。
//   3. 压缩后反而更大时（小图 / 已高压缩的图）同样退回原文件。
// ============================================================================

export type CompressPreset = 'post' | 'avatar';

export interface CompressResult {
  /** 准备上传的文件（压缩失败/无收益时为原文件） */
  file: File;
  /** 压缩前字节数 */
  originalSize: number;
  /** 压缩后字节数 */
  outputSize: number;
  /** 压缩后的实际像素尺寸 */
  width: number;
  height: number;
  /** 是否真的做了压缩 */
  compressed: boolean;
  /** 未压缩的原因，用于排查（UI 不必展示） */
  reason?: string;
}

interface PresetConfig {
  /** 最长边上限（px） */
  maxEdge: number;
  /** 编码质量 0~1 */
  quality: number;
  /** 大于 0 时强制输出该边长的正方形（居中裁切），用于头像 */
  square: number;
}

const PRESETS: Record<CompressPreset, PresetConfig> = {
  // 动态配图：展示宽度最大 672px（max-w-2xl），1600px 足够 2x 屏，且留了放大余地
  post: { maxEdge: 1600, quality: 0.82, square: 0 },
  // 头像：展示最大 160px，512px 够用且圆角裁切后不糊
  avatar: { maxEdge: 512, quality: 0.86, square: 512 },
};

/** 小于这个体积且尺寸合规的图直接放过，避免无意义的重编码 */
const SKIP_BELOW_BYTES = 220 * 1024;

// ---------------------------------------------------------------------------
// 能力探测
// ---------------------------------------------------------------------------

let webpCache: boolean | null = null;

function supportsWebp(): boolean {
  if (webpCache !== null) return webpCache;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpCache = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpCache = false;
  }
  return webpCache;
}

// ---------------------------------------------------------------------------
// 解码
// ---------------------------------------------------------------------------

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  // createImageBitmap 对 image/* 默认按 EXIF 方向摆正，且比 <img> 快
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // 某些格式（如部分 HEIC 转码后的畸形 JPEG）会失败，走 <img> 兜底
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement('img');
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = url;
    });
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) throw new Error('图片尺寸无效');
    return { source: img, width, height, release: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 绘制：逐级减半下采样，比一次 drawImage 到目标尺寸清晰得多
// ---------------------------------------------------------------------------

function drawResized(decoded: Decoded, targetW: number, targetH: number, srcCrop?: {
  sx: number; sy: number; sw: number; sh: number;
}): HTMLCanvasElement | null {
  const crop = srcCrop ?? { sx: 0, sy: 0, sw: decoded.width, sh: decoded.height };

  // 先把源区域画到一张临时画布（裁切），再逐级减半到目标尺寸
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = crop.sw;
  srcCanvas.height = crop.sh;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return null;
  srcCtx.imageSmoothingEnabled = true;
  srcCtx.imageSmoothingQuality = 'high';
  srcCtx.drawImage(decoded.source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);

  let working: HTMLCanvasElement = srcCanvas;
  while (working.width > targetW * 2 && working.height > targetH * 2) {
    const next = document.createElement('canvas');
    next.width = Math.max(targetW, Math.floor(working.width / 2));
    next.height = Math.max(targetH, Math.floor(working.height / 2));
    const ctx = next.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(working, 0, 0, next.width, next.height);
    working = next;
  }

  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(working, 0, 0, targetW, targetH);
  return out;
}

// ---------------------------------------------------------------------------
// 编码
// ---------------------------------------------------------------------------

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

// ---------------------------------------------------------------------------
// 文件名
// ---------------------------------------------------------------------------

function safeBaseName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  // 只留字母数字、下划线、连字符和中日韩字符，其余折成连字符
  const cleaned = base
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || 'image';
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export async function compressImage(file: File, preset: CompressPreset = 'post'): Promise<CompressResult> {
  const config = PRESETS[preset];
  const fallback: CompressResult = {
    file,
    originalSize: file.size,
    outputSize: file.size,
    width: 0,
    height: 0,
    compressed: false,
  };

  if (!file.type.startsWith('image/')) {
    return { ...fallback, reason: '不是图片' };
  }
  // SVG / GIF（动图）重编码会丢性质，跳过
  if (/image\/(svg|gif)/.test(file.type)) {
    return { ...fallback, reason: '矢量图或动图，跳过压缩' };
  }
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return { ...fallback, reason: '非浏览器环境' };
  }

  let decoded: Decoded | null = null;
  try {
    decoded = await decode(file);
    const { width: srcW, height: srcH } = decoded;

    const useSquare = config.square > 0;

    // 计算目标尺寸
    let targetW: number;
    let targetH: number;
    let crop: { sx: number; sy: number; sw: number; sh: number } | undefined;

    if (useSquare) {
      const side = Math.min(srcW, srcH);
      crop = {
        sx: Math.round((srcW - side) / 2),
        sy: Math.round((srcH - side) / 2),
        sw: side,
        sh: side,
      };
      targetW = Math.min(config.square, side);
      targetH = targetW;
    } else {
      const scale = Math.min(1, config.maxEdge / Math.max(srcW, srcH));
      targetW = Math.max(1, Math.round(srcW * scale));
      targetH = Math.max(1, Math.round(srcH * scale));
    }

    const alreadySmallEnough = !useSquare && srcW <= config.maxEdge && srcH <= config.maxEdge;
    if (alreadySmallEnough && file.size <= SKIP_BELOW_BYTES) {
      return { ...fallback, width: srcW, height: srcH, reason: '尺寸与体积均已达标' };
    }
    // 头像走方形裁切时，原图已经是"小图 + 正方形 + 体积不大"也可跳过
    if (useSquare && srcW === srcH && srcW <= config.square && file.size <= SKIP_BELOW_BYTES) {
      return { ...fallback, width: srcW, height: srcH, reason: '尺寸与体积均已达标' };
    }

    const canvas = drawResized(decoded, targetW, targetH, crop);
    if (!canvas) return { ...fallback, reason: '无法创建画布' };

    const type = supportsWebp() ? 'image/webp' : 'image/jpeg';
    let blob = await encode(canvas, type, config.quality);

    // JPEG 兜底产物仍偏大时，再降一档质量重试一次
    if (blob && blob.size > file.size) {
      const retry = await encode(canvas, type, Math.max(0.6, config.quality - 0.12));
      if (retry && retry.size < blob.size) blob = retry;
    }

    if (!blob) return { ...fallback, width: srcW, height: srcH, reason: '编码失败' };
    if (blob.size >= file.size) {
      return { ...fallback, width: srcW, height: srcH, reason: '压缩后体积未降低' };
    }

    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    const compressedFile = new File([blob], `${safeBaseName(file.name)}.${ext}`, {
      type,
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      originalSize: file.size,
      outputSize: compressedFile.size,
      width: targetW,
      height: targetH,
      compressed: true,
    };
  } catch (err) {
    return { ...fallback, reason: err instanceof Error ? err.message : '压缩异常' };
  } finally {
    decoded?.release();
  }
}

// ---------------------------------------------------------------------------
// 展示辅助
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 例如 "2.4 MB → 186 KB（省 92%）" */
export function describeCompression(result: CompressResult): string {
  const saved = Math.max(0, Math.round((1 - result.outputSize / Math.max(1, result.originalSize)) * 100));
  return `${formatBytes(result.originalSize)} → ${formatBytes(result.outputSize)}（省 ${saved}%）`;
}
