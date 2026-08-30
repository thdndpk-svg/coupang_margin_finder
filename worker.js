/**
 * Cloudflare Worker / Serverless HTTPS Production Proxy (worker.js)
 * 
 * [배포 방법]
 * 1. npx wrangler deploy worker.js --name domeme-margin-proxy
 * 2. npx wrangler secret put DOME_API_KEY
 * 3. 생성된 HTTPS URL (예: https://domeme-margin-proxy.subdomain.workers.dev)
 * 4. GitHub Actions Secret 또는 VITE_DOMEME_PROXY_URL 빌드 변수에 반영
 */

export default {
  async fetch(request, env, ctx) {
    const allowedOrigins = [
      'https://thdndpk-svg.github.io',
      'http://localhost:5173',
      'http://localhost:3001'
    ];

    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://thdndpk-svg.github.io',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const apiKey = env.DOME_API_KEY || '';

    // 1. Proxy 상태 점검
    if (pathname === '/api/domeme/status') {
      return new Response(JSON.stringify({
        proxyType: 'PROD_HTTPS_PROXY',
        status: apiKey ? 'PROXY_READY' : 'PROXY_NOT_CONFIGURED',
        hasKey: Boolean(apiKey)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        status: 'AUTH_ERROR',
        message: 'API Key가 Cloudflare Worker Secret(DOME_API_KEY)에 설정되지 않았습니다.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const DOME_ENDPOINT = 'https://www.domeggook.com/ssl/api/';
    let targetUrl = '';

    const itemViewMatch = pathname.match(/^\/api\/domeme\/items\/([0-9]+)$/);
    if (itemViewMatch) {
      const itemNo = itemViewMatch[1];
      targetUrl = `${DOME_ENDPOINT}?ver=4.6&mode=getItemView&aid=${encodeURIComponent(apiKey)}&om=json&no=${itemNo}`;
    } else if (pathname === '/api/domeme/items') {
      const kw = url.searchParams.get('kw') || '텀블러';
      const sz = url.searchParams.get('sz') || '10';
      targetUrl = `${DOME_ENDPOINT}?ver=4.1&mode=getItemList&aid=${encodeURIComponent(apiKey)}&om=json&kw=${encodeURIComponent(kw)}&sz=${sz}`;
    } else {
      return new Response(JSON.stringify({ status: 'NOT_FOUND', message: 'Invalid Endpoint' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const upstreamRes = await fetch(targetUrl);
      const dataText = await upstreamRes.text();

      let json;
      try {
        json = JSON.parse(dataText);
      } catch (e) {
        return new Response(JSON.stringify({ status: 'PARSE_ERROR', message: '도매꾹 JSON 파싱 에러' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const dg = json.domeggook || json;
      if (json.errors || (dg.code && String(dg.code) !== '200')) {
        return new Response(JSON.stringify({
          status: 'AUTH_ERROR',
          message: json.errors?.message || dg.message || '도매꾹 API 인증 실패',
          raw: json
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(json), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'UPSTREAM_ERROR', message: err.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
