import { NextResponse } from 'next/server';
import { fetchComponentFromLCSC } from '@/lib/lcscRemote';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ success: false, message: '编号不能为空' }, { status: 400 });
  }

  try {
    const data = await fetchComponentFromLCSC(code);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}