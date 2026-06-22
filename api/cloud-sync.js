/**
 * Vercel Serverless Function - 云端同步代理
 * 服务器端调用 GitHub Gist API，Token 存在环境变量中（用户看不到）
 * 
 * GET  /api/cloud-sync?action=pull  -> 从 Gist 拉取数据
 * POST /api/cloud-sync?action=push  -> 推送数据到 Gist
 */

const GH_TOKEN = process.env.GH_TOKEN;
const GIST_DESC = 'cw-qt-cloud-v2';

export default async function handler(req, res) {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!GH_TOKEN) {
        return res.status(500).json({ error: '服务器未配置 GH_TOKEN，请在 Vercel 后台设置环境变量' });
    }

    const { action } = req.query || {};

    try {
        if (action === 'pull') {
            return await handlePull(res);
        } else if (action === 'push') {
            return await handlePush(req, res);
        } else {
            return res.status(400).json({ error: 'action 必须是 pull 或 push' });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

// 从 Gist 拉取数据
async function handlePull(res) {
    const gistId = await findGistId();
    if (!gistId) {
        return res.status(200).json({ data: null, gistId: null });
    }

    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
            'Authorization': `token ${GH_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'cw-quotation-system'
        }
    });

    if (!resp.ok) {
        throw new Error(`GitHub API 错误: ${resp.status} ${resp.statusText}`);
    }

    const gist = await resp.json();
    const content = gist.files['data.json'] ? gist.files['data.json'].content : '{}';

    return res.status(200).json({ data: JSON.parse(content), gistId });
}

// 推送数据到 Gist
async function handlePush(req, res) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { data, gistId: clientGistId } = body;

    if (!data) {
        return res.status(400).json({ error: '缺少 data 字段' });
    }

    let gistId = clientGistId || await findGistId();

    if (!gistId) {
        // 创建新 Gist
        const resp = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${GH_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'cw-quotation-system'
            },
            body: JSON.stringify({
                description: GIST_DESC,
                public: false,
                files: {
                    'data.json': { content: JSON.stringify(data, null, 2) }
                }
            })
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`创建 Gist 失败: ${resp.status} ${errText}`);
        }

        const newGist = await resp.json();
        gistId = newGist.id;
    } else {
        // 更新现有 Gist
        const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${GH_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'cw-quotation-system'
            },
            body: JSON.stringify({
                files: {
                    'data.json': { content: JSON.stringify(data, null, 2) }
                }
            })
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`更新 Gist 失败: ${resp.status} ${errText}`);
        }
    }

    return res.status(200).json({ success: true, gistId });
}

// 查找 Gist ID（按 description 匹配）
async function findGistId() {
    const resp = await fetch(`https://api.github.com/gists?per_page=100`, {
        headers: {
            'Authorization': `token ${GH_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'cw-quotation-system'
        }
    });

    if (!resp.ok) {
        throw new Error(`查找 Gist 失败: ${resp.status} ${resp.statusText}`);
    }

    const gists = await resp.json();
    const found = gists.find(g => g.description === GIST_DESC);
    return found ? found.id : null;
}
