import * as cheerio from 'cheerio';
// import fs from 'fs';

/**
 * 统一的内部模型映射
 */
function mapToInternalModel(name, footprint, cate1) {
  return {
    名称: name || '',
    封装: footprint || '',
    一级分类: cate1 || ''
  };
}

/**
 * 策略 1：接口优先 (增强版防拦截 + 精确匹配)
 */
async function fetchViaAPI(code) {
  const url = `https://overseas.szlcsc.com/overseas/search/more/channel?from=${encodeURIComponent(code)}`;
  
  // 核心：全方位伪装成浏览器正常请求
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://so.szlcsc.com/',
      'Origin': 'https://so.szlcsc.com',
    }
  });

  // 读取原始文本流，而不是直接解析 JSON（为了捕获被拦截的页面结构）
  const rawText = await res.text();

  if (!res.ok) {
    console.error(`[LCSC API] HTTP 错误 ${res.status}:`, rawText.substring(0, 200));
    throw new Error(`网络拦截，状态码 HTTP ${res.status}`);
  }
  
  let json;
  try {
    json = JSON.parse(rawText);
  } catch (error) {
    console.error(`[LCSC API] 返回的不是JSON (可能遇到了滑动验证码):`, rawText.substring(0, 200));
    throw new Error('被防火墙拦截，未返回 JSON');
  }
  
  if (json.code !== 200) {
    console.error(`[LCSC API] 业务逻辑错误: code=${json.code}, msg=${json.msg}`);
    throw new Error(`API返回异常状态: ${json.msg || json.code}`);
  }

  let matchedResult = null;
  let fallbackResult = null;
  const targetCode = code.trim().toUpperCase();

  // 遍历动态的数字 Key (如 "1944": [...])
  for (const key in json.result) {
    const itemArray = json.result[key];
    if (Array.isArray(itemArray) && itemArray.length > 0) {
      if (!fallbackResult) fallbackResult = itemArray[0];
      const exactMatch = itemArray.find(item => 
        item.productCode && item.productCode.toUpperCase() === targetCode
      );
      if (exactMatch) {
        matchedResult = exactMatch;
        break;
      }
    }
  }

  const finalResult = matchedResult || fallbackResult;

  if (!finalResult) throw new Error('API未找到对应的元件记录');

  const name = finalResult.productCodeManufacturer || finalResult.productDesc || '';
  const footprint = finalResult.selfStandard || finalResult.encapsulationModel || '';
  const cate1 = finalResult.catalog1 || finalResult.lcCatalogName || '';

  return mapToInternalModel(name, footprint, cate1);
}


/**
 * 策略 2：HTML 解析兜底
 */
async function fetchViaHTML(code) {
  const searchUrl = `https://so.szlcsc.com/global.html?k=${encodeURIComponent(code)}`;

  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });

  if (!res.ok) throw new Error('HTML页面请求失败');

  const html = await res.text();

  const $ = cheerio.load(html);

  // 1. 提取商品名称(原厂型号)
  // 锁定第一个搜索结果卡片
  const firstCard = $('div[data-index="0"]');

  // 1. 提取商品名称(原厂型号)
  let name = firstCard.find('a[data-spm="n"] span').first().text().trim();

  console.log(`[LCSC Remote] HTML: ${name}`);
  
  if (!name) {
    name = $('h1').first().text().trim(); // 详情页兜底
  }
  
  if (!name) throw new Error('HTML解析未提取到有效元件名称');

  // 2. 提取封装、类目等信息 (限定在第一个卡片内查找)
  const footprint = firstCard.find('dt:contains("封装")').first().siblings('dd').text().trim();
  const category = firstCard.find('dt:contains("类目")').first().siblings('dd').text().trim();

  return mapToInternalModel(name, footprint, category);
}

/**
 * 暴露给外部的 Remote 服务入口：双层策略调度
 */
export async function fetchComponentFromLCSC(code) {
  try {
    // 优先尝试 API 策略
    console.log(`[LCSC Remote] 尝试通过 API 获取: ${code}`);
    return await fetchViaAPI(code);
  } catch (apiError) {
    console.warn(`[LCSC Remote] API 获取失败，降级至 HTML 解析兜底:`, apiError.message);
    try {
      // API 失败，执行 HTML 兜底策略
      return await fetchViaHTML(code);
    } catch (htmlError) {
      console.error(`[LCSC Remote] HTML 解析也失败了:`, htmlError.message);
      throw new Error(`无法从立创商城获取编号 ${code} 的数据`);
    }
  }
}