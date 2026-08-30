/**
 * Cloudflare Worker / Serverless HTTPS Production Proxy (worker.js)
 * 
 * [보안 규격 반영]
 * - whitelist mode: getItemList, getItemView 만 허용 (타 mode 차단)
 * - market=supply 강제 적용 (도매매 위탁상품 검색)
 * - sz 최대 200 제한
 * - 클라이언트 aid 파라미터 무시 & 서버 Secret env.DOME_API_KEY 주입
 * - API Key 로그 마스킹
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
      const szRaw = Number(url.searchParams.get('sz') || 10);
      const sz = Math.min(Math.max(1, isNaN(szRaw) ? 10 : szRaw), 200);

      // market=supply 파라미터 강제
      targetUrl = `${DOME_ENDPOINT}?ver=4.1&mode=getItemList&market=supply&aid=${encodeURIComponent(apiKey)}&om=json&kw=${encodeURIComponent(kw)}&sz=${sz}`;
    } else {
      return new Response(JSON.stringify({ status: 'FORBIDDEN_MODE', message: '허용되지 않은 API mode 입니다 (getItemList, getItemView 만 허용).' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12초 timeout

      const upstreamRes = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

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
      const errStatus = err.name === 'AbortError' ? 'TIMEOUT' : 'UPSTREAM_ERROR';
      return new Response(JSON.stringify({ status: errStatus, message: err.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
