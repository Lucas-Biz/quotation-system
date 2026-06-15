// import-data.js
// 把旧网站导出的 localStorage 数据导入 Supabase

const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://xidxgflkngdayceejwdj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Rhp5UWYMCboUocsKwCofcQ_TU-Yt9pV';

// 读取旧数据文件
const filePath = 'C:/Users/交貨/Desktop/新文字文件.txt';
let fileContent;

try {
    fileContent = fs.readFileSync(filePath, 'utf8');
} catch(e) {
    console.error('无法读取文件:', e.message);
    process.exit(1);
}

// 解析 JSON
let allData;
try {
    allData = JSON.parse(fileContent);
} catch(e) {
    console.error('JSON 解析失败:', e.message);
    process.exit(1);
}

console.log('✅ 文件读取成功，数据大小:', (fileContent.length / 1024).toFixed(2), 'KB');

// 提取 cw_* 开头的数据
const storeData = {};
const keys = ['products', 'quotations', 'refQuotations', 'settings', 'colWidths', 'costRecords', 'latestCosts', 'avgCosts'];

for (const key of keys) {
    const fullKey = 'cw_' + key;
    if (allData[fullKey] !== undefined) {
        try {
            storeData[key] = JSON.parse(allData[fullKey]);
            console.log(`✅ 找到 ${fullKey}:`, typeof storeData[key] === 'object' ? 'object' : 'string');
        } catch(e) {
            storeData[key] = allData[fullKey];
        }
    }
}

storeData._updated = new Date().toISOString();
storeData._source = 'imported_from_old_site';

console.log('准备导入的数据 keys:', Object.keys(storeData));

// 生成 device_id（用旧网站的 userAgent 或随机生成）
const deviceId = 'cw_imported_' + Date.now().toString(36);

// 调用 Supabase REST API 插入数据
const postData = JSON.stringify({
    device_id: deviceId,
    data: storeData,
    updated_at: new Date().toISOString()
});

const options = {
    hostname: 'xidxgflkngdayceejwdj.supabase.co',
    path: '/rest/v1/store_data',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
    }
};

console.log('正在导入数据到 Supabase...');

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => { responseData += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ 数据导入成功！');
            console.log('设备 ID:', deviceId);
            console.log('请在 Supabase Dashboard 的 Table Editor 中查看 store_data 表');
            console.log('新网站打开后会自动从这个 device_id 拉取数据');
        } else {
            console.log('❌ 导入失败，HTTP 状态:', res.statusCode);
            console.log('响应:', responseData);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ 请求失败:', e.message);
});

req.write(postData);
req.end();
