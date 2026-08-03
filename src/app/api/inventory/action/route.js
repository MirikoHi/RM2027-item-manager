import { NextResponse } from 'next/server';
import { readInventory, writeInventory } from '@/lib/excelUtils';
import { format } from 'date-fns';

// 与下方实际变更处理一致的匹配规则：编号完全一致，或（名称+封装）同时一致
function findExistingIndex(inventory, item) {
  return inventory.findIndex(
    (i) => (i.编号 && i.编号 === item.编号) || (i.名称 === item.名称 && i.封装 === item.封装)
  );
}

// 构建导入预览：逐条匹配当前库存，计算数量变更（只读，不写入库存）
// 同一型号多行时按顺序模拟，与下方实际变更处理保持一致
function buildPreview(action, items, inventory) {
  const sim = new Map(); // 库存下标 -> 模拟后的当前数量
  return items.map((it) => {
    const qty = Number(it.数量) || 0;
    const idx = findExistingIndex(inventory, it);
    let currentQty = idx >= 0 ? Number(inventory[idx].数量) || 0 : 0;
    if (idx >= 0 && sim.has(idx)) currentQty = sim.get(idx);

    if (action === 'inbound') {
      const status = idx >= 0 ? 'ok' : 'new';
      const afterQty = currentQty + qty;
      if (idx >= 0) sim.set(idx, afterQty);
      return { ...it, status, currentQty, afterQty, checked: true, disabled: false };
    }

    // outbound
    if (idx < 0) {
      return { ...it, status: 'notfound', currentQty: 0, afterQty: null, checked: false, disabled: true };
    }
    if (currentQty < qty) {
      return { ...it, status: 'insufficient', currentQty, afterQty: null, checked: false, disabled: true };
    }
    const afterQty = currentQty - qty;
    sim.set(idx, afterQty);
    return { ...it, status: 'ok', currentQty, afterQty, checked: true, disabled: false };
  });
}

export async function POST(request) {
  try {
    const { action, items, operator = '系统操作', preview = false } = await request.json();
    const inventory = readInventory();

    // 预览模式：只计算并返回数量变更，不写入库存
    if (preview) {
      const previewItems = buildPreview(action, items, inventory);
      return NextResponse.json({ success: true, data: previewItems });
    }

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