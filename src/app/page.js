'use client';

import { useState, useEffect, useCallback} from 'react';
import { Search, Plus, Upload, Download, RefreshCcw, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function InventoryDashboard() {
  const [data, setData] = useState([]);
  const [searchKey, setSearchKey] = useState('名称');
  const [searchWord, setSearchWord] = useState('');
  const [loading, setLoading] = useState(true);

  // 控制单条入库弹窗的状态
  const [showModal, setShowModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    名称: '',
    封装: '',
    数量: 1,
    编号: '',
    一级分类: '',
    二级分类: ''
  });

  // 获取数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("加载失败", err);
    } finally {
      setLoading(false);
    }
  }, []); // 依赖项为空，表示只在初始化时创建一次

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 查询/模糊查询过滤
  const filteredData = data.filter((item) =>
    String(item[searchKey] || '').toLowerCase().includes(searchWord.toLowerCase())
  );

  // 统一提交出入库数据到API
  const submitAction = async (action, items) => {
    const res = await fetch('/api/inventory/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, items, operator: '当前用户' }),
    });
    const result = await res.json();
    if (result.success) {
      alert(`${action === 'inbound' ? '入库' : '出库'}成功！`);
      fetchData();
    } else {
      alert(`失败:\n${result.errors ? result.errors.join('\n') : result.message}`);
    }
  };

  // Excel解析：入库文件映射
  const handleInboundExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws);
      
      const mappedItems = rawData.map(row => ({
        名称: row['商品型号'] || row['名称'],
        封装: row['封装规格'] || row['封装'],
        数量: row['购买数量'] || row['数量'],
        编号: row['商品编号'] || row['物料编码'] || row['编号'],
        一级分类: row['商品分类']?.split('/')[0] || '未分类',
        二级分类: row['商品分类']?.split('/')[1] || '',
      })).filter(i => i.名称 && i.数量);

      if(mappedItems.length > 0 && confirm(`识别到 ${mappedItems.length} 条入库记录，确认提交？`)) {
        submitAction('inbound', mappedItems);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; 
  };

  // Excel解析：出库(BOM)映射
  const handleOutboundExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(ws);

      const mappedItems = rawData.map(row => ({
        名称: row['Device'] || row['Name'] || row['名称'],
        数量: row['Quantity'] || row['数量'],
        编号: row['Supplier Part'] || row['Manufacturer Part'] || row['编号'],
        封装: row['Footprint'] || row['封装']
      })).filter(i => i.名称 && i.数量);

      if(mappedItems.length > 0 && confirm(`识别到 ${mappedItems.length} 条出库BOM需求，确认检查并出库？`)) {
        submitAction('outbound', mappedItems);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // 提交单条入库表单
  const handleManualSubmit = () => {
    if (!manualForm.名称.trim()) {
      alert('元件名称不能为空');
      return;
    }
    if (manualForm.数量 <= 0) {
      alert('数量必须大于0');
      return;
    }

    submitAction('inbound', [{ ...manualForm }]);
    
    // 提交后关闭弹窗并清空表单
    setShowModal(false);
    setManualForm({名称: '', 封装: '', 数量: 1, 编号: '', 一级分类: '', 二级分类: ''});
  };

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-6 relative">
      <header className="flex justify-between items-end pb-4 border-b border-[#30363d]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">苍穹硬件组物料库</h1>
          <p className="text-[#8b949e]">基于 Next.js 打造的本地 Excel 资产管理</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="btn btn-default"><RefreshCcw size={16} /> 刷新</button>
        </div>
      </header>

      <div className="panel p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="input-dark w-32"
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
          >
            {['名称', '编号', '封装', '一级分类', '二级分类'].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" size={16} />
            <input 
              type="text" 
              className="input-dark w-full pl-9" 
              placeholder="模糊搜索..." 
              value={searchWord}
              onChange={(e) => setSearchWord(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <input type="file" accept=".xlsx,.xls" id="inboundFile" className="hidden" onChange={handleInboundExcel} />
          <input type="file" accept=".xlsx,.xls,.csv" id="outboundFile" className="hidden" onChange={handleOutboundExcel} />

          {/* 触发弹窗的按钮 */}
          <button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus size={16}/>单条入库</button>
          
          <label htmlFor="inboundFile" className="btn btn-default cursor-pointer">
            <Download size={16} className="text-[#58a6ff]"/> 购物车入库 (Excel)
          </label>
          
          <label htmlFor="outboundFile" className="btn btn-default cursor-pointer">
            <Upload size={16} className="text-[#ff7b72]"/> BOM出库 (Excel)
          </label>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                {['名称', '封装', '数量', '编号', '分类', '修改时间', '修改人'].map(th => (
                  <th key={th} className="table-header">{th}</th>
                ))}
                <th className="table-header w-24">操作</th>
              </tr>
            </thead>
            <tbody className="bg-[#0d1117] divide-y divide-[#30363d]">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8 text-[#8b949e]">加载中...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-[#8b949e]">未找到匹配的物料</td></tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#161b22] transition-colors">
                    <td className="table-cell font-medium text-white">{item.名称}</td>
                    <td className="table-cell">{item.封装 || '-'}</td>
                    <td className="table-cell font-mono">
                      <span className={`px-2 py-1 rounded text-xs ${item.数量 < 10 ? 'bg-[#da3633] text-white' : 'bg-[#238636] text-white'}`}>
                        {item.数量}
                      </span>
                    </td>
                    <td className="table-cell text-[#8b949e]">{item.编号 || '-'}</td>
                    <td className="table-cell text-xs text-[#8b949e]">
                      {item.一级分类} {item.二级分类 ? `> ${item.二级分类}` : ''}
                    </td>
                    <td className="table-cell text-xs text-[#8b949e]">{item.修改时间 || '-'}</td>
                    <td className="table-cell text-[#8b949e]">{item.修改人 || '-'}</td>
                    <td className="table-cell">
                      <button 
                        onClick={() => {
                          const qty = prompt(`出库 ${item.名称} 的数量:`);
                          if(qty && !isNaN(qty) && Number(qty) > 0) submitAction('outbound', [{...item, 数量: Number(qty)}]);
                        }} 
                        className="text-[#ff7b72] hover:text-white hover:underline text-xs"
                      >
                        单项出库
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 单条入库弹窗 (Modal) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="panel w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">单条物料入库</h2>
              <button onClick={() => setShowModal(false)} className="text-[#8b949e] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#8b949e] mb-1">名称 (必填)</label>
                <input 
                  type="text" 
                  className="input-dark w-full" 
                  placeholder="例如: 10k电阻" 
                  value={manualForm.名称}
                  onChange={(e) => setManualForm({...manualForm, 名称: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-1">封装</label>
                  <input 
                    type="text" 
                    className="input-dark w-full" 
                    placeholder="例如: 0603" 
                    value={manualForm.封装}
                    onChange={(e) => setManualForm({...manualForm, 封装: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-1">数量 (必填)</label>
                  <input 
                    type="number" 
                    min="1"
                    className="input-dark w-full" 
                    value={manualForm.数量}
                    onChange={(e) => setManualForm({...manualForm, 数量: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8b949e] mb-1">编号</label>
                <input 
                  type="text" 
                  className="input-dark w-full" 
                  placeholder="供应商/原厂料号" 
                  value={manualForm.编号}
                  onChange={(e) => setManualForm({...manualForm, 编号: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-1">一级分类</label>
                  <input 
                    type="text" 
                    className="input-dark w-full" 
                    placeholder="例如: 电阻" 
                    value={manualForm.一级分类}
                    onChange={(e) => setManualForm({...manualForm, 一级分类: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8b949e] mb-1">二级分类</label>
                  <input 
                    type="text" 
                    className="input-dark w-full" 
                    placeholder="例如: 贴片电阻" 
                    value={manualForm.二级分类}
                    onChange={(e) => setManualForm({...manualForm, 二级分类: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button className="btn btn-default" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleManualSubmit}>确认入库</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}