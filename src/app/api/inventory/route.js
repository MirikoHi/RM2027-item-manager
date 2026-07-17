import { NextResponse } from 'next/server';
import { readInventory, writeInventory } from '@/lib/excelUtils';

// 接口：获取物料列表
export async function GET() {
  try {
    const data = readInventory();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 接口：直接覆盖修改整个 Excel
export async function PUT(request) {
  try {
    const { data } = await request.json();
    writeInventory(data);
    return NextResponse.json({ success: true, message: '物料库已更新' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}