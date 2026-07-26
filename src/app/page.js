'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Upload, Download, RefreshCcw, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function InventoryDashboard() {
  const [data, setData] = useState([]);
  const [searchKey, setSearchKey] = useState('名称');
  const [searchWord, setSearchWord] = useState('');
  const [loading, setLoading] = useState(true);

  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

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

  // 使用 useCallback 包装，避免 useEffect 依赖警告
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (error) {
      console.error("加载数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!(manualForm.名称.trim() || manualForm.编号.trim())) {
      alert('元件名称或编号不能为空');
      return;
    }
    if (manualForm.数量 <= 0) {
      alert('数量必须大于0');
      return;
    }

    submitAction('inbound', [{ ...manualForm }]);
    
    setShowModal(false);
    setManualForm({名称: '', 封装: '', 数量: 1, 编号: '', 一级分类: '', 二级分类: ''});
  };

  // 联网获取立创数据
  const handleFetchRemoteData = async () => {
    if (!manualForm.编号) {
      alert('请先输入物料编号 (如 C10000)');
      return;
    }
    
    setIsFetchingRemote(true);
    try {
      const res = await fetch(`/api/lcsc?code=${encodeURIComponent(manualForm.编号)}`);
      const json = await res.json();
      
      if (json.success && json.data) {
        setManualForm(prev => ({
          ...prev,
          名称: json.data.名称 || prev.名称,
          封装: json.data.封装 || prev.封装,
          一级分类: json.data.一级分类 || prev.一级分类,
          二级分类: json.data.二级分类 || prev.二级分类
        }));
      } else {
        alert(json.message || '获取失败，请手动填写');
      }
    } catch (error) {
      alert('网络请求失败');
    } finally {
      setIsFetchingRemote(false);
    }
  };

  return (
    // 响应式：p-4 适配手机，md:p-8 适配桌面
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6 relative">
      
      {/* 头部区域 响应式：手机端纵向排列，桌面端横向排列 */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-[#30363d]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">苍穹硬件组物料库</h1>
          <p className="text-sm md:text-base text-[#8b949e]">基于 Next.js 的本地资产管理</p>
        </div>
        <div className="flex w-full md:w-auto">
          <button onClick={fetchData} className="btn btn-default md:w-auto">
            <RefreshCcw size={16} /> 刷新
          </button>
        </div>
      </header>

      {/* 操作控制面板 响应式：复杂折叠 */}
      <div className="panel p-4 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        {/* 查询功能区 */}
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <select 
            className="input-dark w-full sm:w-32"
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
          >
            {['名称', '编号', '封装', '一级分类', '二级分类'].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <div className="relative flex-1 sm:w-64">
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

        {/* 按钮操作区 响应式：手机端换行铺满 */}
        <div className="flex flex-row sm:flex-row gap-3 w-full lg:w-auto justify-center">
          <input type="file" accept=".xlsx,.xls" id="inboundFile" className="hidden" onChange={handleInboundExcel} />
          <input type="file" accept=".xlsx,.xls,.csv" id="outboundFile" className="hidden" onChange={handleOutboundExcel} />

          <button onClick={() => setShowModal(true)} className="btn btn-primary w-full sm:w-auto flex">
            <Plus size={16}/>单条入库
          </button>
          
          <label htmlFor="inboundFile" className="btn btn-default cursor-pointer w-full sm:w-auto flex text-center">
            <Download size={16} className="text-[#58a6ff] mx-auto sm:mx-0"/> <span className="sm:inline hidden">购物车入库</span><span className="sm:hidden">购物车入库</span>
          </label>
          
          <label htmlFor="outboundFile" className="btn btn-default cursor-pointer w-full sm:w-auto flex text-center">
            <Upload size={16} className="text-[#ff7b72] mx-auto sm:mx-0"/> <span className="sm:inline hidden">BOM出库</span><span className="sm:hidden">BOM出库</span>
          </label>
        </div>
      </div>

      {/* 数据表格 响应式：横向滑动不受影响 */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr>
                {['名称', '封装', '数量', '编号', '分类', '修改时间', '修改人'].map(th => (
                  <th key={th} className="table-header">{th}</th>
                ))}
                <th className="table-header w-24 sticky right-0 bg-[#161b22] shadow-[-4px_0_10px_rgba(0,0,0,0.1)]">操作</th>
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
                    <td className="table-cell text-xs text-[#8b949e] whitespace-nowrap">{item.修改时间 || '-'}</td>
                    <td className="table-cell text-[#8b949e]">{item.修改人 || '-'}</td>
                    <td className="table-cell sticky right-0 bg-inherit md:bg-transparent shadow-[-4px_0_10px_rgba(0,0,0,0.1)] md:shadow-none">
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
        // 响应式：p-4 保证在小屏幕上有外边距不会贴死屏幕边缘
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">单条物料入库</h2>
              <button onClick={() => setShowModal(false)} className="text-[#8b949e] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {/* 调整后的表单输入流 */}
            <div className="space-y-4">
              
              {/* 【需求修改】：编号移到了最上面，并整合了立创联网获取功能 */}
              <div>
                <label className="block text-sm font-medium text-[#8b949e] mb-1">
                  编号 (支持立创编号)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="input-dark w-full" 
                    placeholder="如: C1591" 
                    value={manualForm.编号}
                    onChange={(e) => setManualForm({...manualForm, 编号: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={handleFetchRemoteData}
                    disabled={isFetchingRemote || !manualForm.编号}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors whitespace-nowrap
                      ${isFetchingRemote || !manualForm.编号 
                        ? 'bg-[#21262d] border-[#30363d] text-[#8b949e] cursor-not-allowed' 
                        : 'bg-[#1f6feb] border-[#388bfd] text-white hover:bg-[#388bfd]'
                      }`}
                  >
                    {isFetchingRemote ? '获取中...' : '联网获取'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8b949e] mb-1">名称</label>
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