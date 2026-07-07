import { NextRequest, NextResponse } from 'next/server';
import { d1Query } from '@/lib/cloudflare';

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error';
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    const rows = await d1Query('SELECT password FROM admin WHERE id = 1');
    const stored = rows[0]?.password;

    if (password === stored) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: '暗号错误' }, { status: 401 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
