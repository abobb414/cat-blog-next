import { NextRequest, NextResponse } from 'next/server';
import { r2Upload } from '@/lib/cloudflare';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '未检测到上传文件' }, { status: 400 });
    }

    const filename = `${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const url = await r2Upload(filename, arrayBuffer, file.type);

    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
