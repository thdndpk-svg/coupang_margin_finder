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

const PORT = process.env.PORT || 3001;
const DOME_ENDPOINT = 'https://www.domeggook.com/ssl/api/';
const ALLOWED_ORIGINS = [
  'https://thdndpk-svg.github.io',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://127.0.0.1:5173'
];

// Simple in-memory rate limiter (1분간 IP당 120회 제한)
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 120;

  let record = rateLimitMap.get(ip);
  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 1 };
  } else {
    record.count++;
  }
  rateLimitMap.set(ip, record);
  return record.count <= maxRequests;
}

function makeHttpsRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    // 로그 시 aid 마스킹
    const maskedUrl = targetUrl.replace(/aid=[^&]+/, 'aid=KEY_HIDDEN');
    console.log(`[LOCAL_PROXY Upstream Request] ${maskedUrl}`);

    const req = https.get(targetUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', err => reject(err));
    // Upstream Timeout 12초
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('UPSTREAM_TIMEOUT'));
    });
  });
}

const server = http.createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'RATE_LIMIT_EXCEEDED', message: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.' }));
    return;
  }

  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://thdndpk-svg.github.io');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
      proxyType: 'LOCAL_PROXY',
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

  // 2. getItemView v4.6 단건 상품 상세 Proxy (Whitelist Mode Check)
  const itemViewMatch = pathname.match(/^\/api\/domeme\/items\/([0-9]+)$/);
  if (itemViewMatch) {
    const itemNo = itemViewMatch[1];
    // 클라이언트가 보낸 aid 무시 & 서버 환경변수 aid만 주입
    const targetUrl = `${DOME_ENDPOINT}?ver=4.6&mode=getItemView&aid=${encodeURIComponent(apiKey)}&om=json&no=${itemNo}`;

    try {
      const upstream = await makeHttpsRequest(targetUrl);
      if (upstream.status !== 200) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'UPSTREAM_ERROR', message: `도매꾹 HTTP ${upstream.status}` }));
        return;
      }

      let parsedBody;
      try {
        parsedBody = JSON.parse(upstream.body);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'PARSE_ERROR', message: '도매꾹 응답 JSON 파싱 실패' }));
        return;
      }

      const dg = parsedBody.domeggook || parsedBody;
      if (parsedBody.errors || (dg.code && String(dg.code) !== '200')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'AUTH_ERROR',
          message: parsedBody.errors?.message || dg.message || '도매꾹 API 인증실패',
          raw: parsedBody
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsedBody));
    } catch (err) {
      const errStatus = err.message === 'UPSTREAM_TIMEOUT' ? 'TIMEOUT' : 'UPSTREAM_ERROR';
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: errStatus, message: err.message }));
    }
    return;
  }

  // 3. getItemList v4.1 상품 목록 검색 Proxy (market=supply 필수 & sz <= 200 제한)
  if (pathname === '/api/domeme/items') {
    const kw = query.kw || '텀블러';
    const szRaw = Number(query.sz || 10);
    const sz = Math.min(Math.max(1, isNaN(szRaw) ? 10 : szRaw), 200); // sz 최대 200 제한

    // market=supply 파라미터 강제
    const targetUrl = `${DOME_ENDPOINT}?ver=4.1&mode=getItemList&market=supply&aid=${encodeURIComponent(apiKey)}&om=json&kw=${encodeURIComponent(kw)}&sz=${sz}`;

    try {
      const upstream = await makeHttpsRequest(targetUrl);
      if (upstream.status !== 200) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'UPSTREAM_ERROR', message: `도매꾹 HTTP ${upstream.status}` }));
        return;
      }

      let parsedBody;
      try {
        parsedBody = JSON.parse(upstream.body);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'PARSE_ERROR', message: '도매꾹 응답 JSON 파싱 실패' }));
        return;
      }

      const dg = parsedBody.domeggook || parsedBody;
      if (parsedBody.errors || (dg.code && String(dg.code) !== '200')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'AUTH_ERROR',
          message: parsedBody.errors?.message || dg.message || '도매꾹 API 인증실패',
          raw: parsedBody
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsedBody));
    } catch (err) {
      const errStatus = err.message === 'UPSTREAM_TIMEOUT' ? 'TIMEOUT' : 'UPSTREAM_ERROR';
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: errStatus, message: err.message }));
    }
    return;
  }

  // Whitelist 외 임의 mode 요청 차단
  res.writeHead(403, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'FORBIDDEN_MODE', message: '허용되지 않은 API mode 입니다 (getItemList, getItemView 만 허용).' }));
});

server.listen(PORT, () => {
  console.log(`[LOCAL_PROXY Server] Listening on http://localhost:${PORT} (market=supply enforced, log masked, sz<=200)`);
});
