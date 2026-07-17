import { NextResponse } from 'next/server';
import { readInventory, writeInventory } from '@/lib/excelUtils';
import { format } from 'date-fns';

export async function POST(request) {
  try {
    const { action, items, operator = '系统操作' } = await request.json();
    const inventory = readInventory();
    const nowTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const errors = [];

    items.forEach((incItem) => {
      // 通过名称或编号匹配现有元件
      const existingIdx = inventory.findIndex(
        (i) => (i.编号 && i.编号 === incItem.编号) || (i.名称 === incItem.名称 && i.封装 === incItem.封装)
      );

      if (action === 'inbound') {
        if (existingIdx >= 0) {
          inventory[existingIdx].数量 = Number(inventory[existingIdx].数量) + Number(incItem.数量);
          inventory[existingIdx].修改时间 = nowTime;
          inventory[existingIdx].修改人 = operator;
        } else {
          inventory.push({
            名称: incItem.名称 || '未知',
            封装: incItem.封装 || '',
            数量: Number(incItem.数量) || 0,
            编号: incItem.编号 || '',
            一级分类: incItem.一级分类 || '默认',
            二级分类: incItem.二级分类 || '默认',
            修改时间: nowTime,
            修改人: operator,
          });
        }
      } else if (action === 'outbound') {
        if (existingIdx >= 0) {
          const outQty = Number(incItem.数量);
          if (inventory[existingIdx].数量 >= outQty) {
            inventory[existingIdx].数量 -= outQty;
            inventory[existingIdx].修改时间 = nowTime;
            inventory[existingIdx].修改人 = operator;
          } else {
            errors.push(`${incItem.名称} 库存不足 (需求:${outQty}, 当前:${inventory[existingIdx].数量})`);
          }
        } else {
          errors.push(`未找到元件: ${incItem.名称} (${incItem.编号})`);
        }
      }
    });

    if (errors.length > 0 && action === 'outbound') {
      return NextResponse.json({ success: false, message: '出库校验失败', errors }, { status: 400 });
    }

    writeInventory(inventory);
    return NextResponse.json({ success: true, message: `${action === 'inbound' ? '入库' : '出库'}成功` });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}