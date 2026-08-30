import http from 'http';
import https from 'https';
import url from 'url';
import fs from 'fs';
import path from 'path';

// .env 파일 로드 (키가 존재할 경우 읽음)
let apiKey = process.env.DOME_API_KEY || '';
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DOME_API_KEY\s*=\s*["']?([^"'\s\r\n]+)["']?/);
    if (match && match[1]) {
      apiKey = match[1];
    }
  }
} catch (e) {
  // ignore
}

const PORT = 3001;
const DOME_ENDPOINT = 'https://www.domeggook.com/ssl/api/';

function makeHttpsRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    https.get(targetUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // 1. Proxy 상태 점검 엔드포인트
  if (pathname === '/api/domeme/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: apiKey ? 'PROXY_READY' : 'PROXY_NOT_CONFIGURED',
      hasKey: Boolean(apiKey)
    }));
    return;
  }

  // API Key 미설정 시 차단
  if (!apiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'AUTH_ERROR',
      message: 'API Key가 서버 환경변수(.env)에 설정되어 있지 않습니다.'
    }));
    return;
  }

  // 2. getItemView v4.6 단건 상품 상세 Proxy
  const itemViewMatch = pathname.match(/^\/api\/domeme\/items\/([0-9]+)$/);
  if (itemViewMatch) {
    const itemNo = itemViewMatch[1];
    const targetUrl = `${DOME_ENDPOINT}?ver=4.6&mode=getItemView&aid=${encodeURIComponent(apiKey)}&om=json&no=${itemNo}`;

    try {
      const response = await makeHttpsRequest(targetUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(response.body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'API_ERROR', message: err.message }));
    }
    return;
  }

  // 3. getItemList v4.1 상품 목록 검색 Proxy
  if (pathname === '/api/domeme/items') {
    const kw = query.kw || '텀블러';
    const sz = query.sz || '10';
    const targetUrl = `${DOME_ENDPOINT}?ver=4.1&mode=getItemList&aid=${encodeURIComponent(apiKey)}&om=json&kw=${encodeURIComponent(kw)}&sz=${sz}`;

    try {
      const response = await makeHttpsRequest(targetUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(response.body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'API_ERROR', message: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'NOT_FOUND', message: '요청 경로가 올바르지 않습니다.' }));
});

server.listen(PORT, () => {
  console.log(`[REAL API Proxy Server] Listening on http://localhost:${PORT}`);
});
