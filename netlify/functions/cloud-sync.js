/**
 * Netlify Function - 云端同步代理
 * 服务器端调用 GitHub Gist API，Token 存在环境变量中（用户看不到）
 * 
 * GET  ?action=pull  -> 从 Gist 拉取数据
 * POST ?action=push  -> 推送数据到 Gist
 */

const GH_TOKEN = process.env.GH_TOKEN;
const GIST_DESC = 'cw-qt-cloud-v2';

exports.handler = async (event, context) => {
    // CORS 头
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!GH_TOKEN) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: '服务器未配置 GH_TOKEN，请在 Netlify 后台设置环境变量' })
        };
    }

    const params = new URLSearchParams(event.queryStringParameters || {});
    const action = params.get('action') || 'pull';

    try {
        if (action === 'pull') {
            return await handlePull(headers);
        } else if (action === 'push') {
            return await handlePush(event, headers);
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'action 必须是 pull 或 push' })
            };
        }
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};

// 从 Gist 拉取数据
async function handlePull(headers) {
    // 1. 查找 Gist ID
    const gistId = await findGistId();
    if (!gistId) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ data: null, gistId: null })
        };
    }

    // 2. 拉取 Gist 内容
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

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: JSON.parse(content), gistId })
    };
}

// 推送数据到 Gist
async function handlePush(event, headers) {
    const body = JSON.parse(event.body || '{}');
    const { data, gistId: clientGistId } = body;

    if (!data) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: '缺少 data 字段' })
        };
    }

    // 1. 查找或创建 Gist
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

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, gistId })
    };
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
