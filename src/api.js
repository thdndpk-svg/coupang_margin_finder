/**
 * STEP 2.2.0: 도매꾹/도매매 Open API 복구 클라이언트 & Proxy 연결 (api.js)
 * - allowMockFallback 옵션 지원 (REAL_API 검증 시 MOCK 전환 전면 금지)
 * - VITE_DOMEME_PROXY_URL 지원
 * - CONNECTED_EMPTY 상태 지원 (실데이터 0건 수신 시 MOCK 혼합 금지)
 */

import { DomeProductModel, MockDomeProductAdapter } from './models.js';

export const SAMPLE_MOCK_PRODUCTS = [
  {
    isMock: true,
    no: '100001',
    title: '[MOCK] 대용량 스텐 텀블러 1L (보온/보냉)',
    price: 7800,
    deliPrice: 3000,
    category: '1002',
    thumb: 'https://via.placeholder.com/80/3b82f6/ffffff?text=Tumbler',
    agencyFlag: 'Y',
    defaultCoupangPrice: 28900
  },
  {
    isMock: true,
    no: '100002',
    title: '[MOCK] 초고속 고속충전 C타입 케이블 2m',
    price: 1200,
    deliPrice: 2500,
    category: '1001',
    thumb: 'https://via.placeholder.com/80/10b981/ffffff?text=Cable',
    agencyFlag: 'Y',
    defaultCoupangPrice: 5900
  },
  {
    isMock: true,
    no: '100003',
    title: '[MOCK] 프리미엄 무선 블루투스 이어폰 v5.3',
    price: 15000,
    deliPrice: 3000,
    category: '1001',
    thumb: 'https://via.placeholder.com/80/f59e0b/ffffff?text=Earphone',
    agencyFlag: 'Y',
    defaultCoupangPrice: 34900
  },
  {
    isMock: true,
    no: '100004',
    title: '[MOCK] 친환경 유기농 모달 호텔 타월 5매 세트',
    price: 13500,
    deliPrice: 3000,
    category: '1002',
    thumb: 'https://via.placeholder.com/80/ef4444/ffffff?text=Towel',
    agencyFlag: 'Y',
    defaultCoupangPrice: 29900
  },
  {
    isMock: true,
    no: '100005',
    title: '[MOCK] 차량용 고정식 스마트폰 거치대',
    price: 3200,
    deliPrice: 2500,
    category: '1001',
    thumb: 'https://via.placeholder.com/80/8b5cf6/ffffff?text=Holder',
    agencyFlag: 'Y',
    defaultCoupangPrice: 11900
  }
];

export class DomeApiClient {
  constructor() {
    this.mode = 'REAL_API'; // 기본 실행 모드: REAL_API
    this.status = 'CONNECTING';

    const envProxyUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DOMEME_PROXY_URL)
      || (typeof process !== 'undefined' && process.env && process.env.VITE_DOMEME_PROXY_URL);

    this.proxyBaseUrl = envProxyUrl || 'http://localhost:3001';
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'MOCK') {
      this.status = 'MOCK';
    }
  }

  async getItemList(params = {}, options = {}) {
    const allowMockFallback = options.allowMockFallback !== undefined ? options.allowMockFallback : true;

    if (this.mode === 'MOCK') {
      const parsed = SAMPLE_MOCK_PRODUCTS.map(mockItem => {
        const v46Object = MockDomeProductAdapter.adapt(mockItem);
        return new DomeProductModel(v46Object);
      });

      return {
        mode: 'MOCK',
        status: 'MOCK',
        statusLabel: 'MOCK 데이터 표시 중',
        raw: SAMPLE_MOCK_PRODUCTS,
        parsed
      };
    }

    const kw = params.kw || '텀블러';
    const sz = params.sz || '10';

    try {
      this.status = 'CONNECTING';
      const res = await fetch(`${this.proxyBaseUrl}/api/domeme/items?kw=${encodeURIComponent(kw)}&sz=${sz}`);

      if (res.status === 401) {
        this.status = 'AUTH_ERROR';
        if (!allowMockFallback) {
          return { mode: 'REAL_API', status: 'AUTH_ERROR', statusLabel: 'API Key 인증 실패', raw: null, parsed: [] };
        }
        return this.getFallbackMock('AUTH_ERROR', 'API Key 인증 필요 (서버 .env 환경변수 설정)');
      }

      if (!res.ok) {
        this.status = 'API_ERROR';
        if (!allowMockFallback) {
          return { mode: 'REAL_API', status: 'API_ERROR', statusLabel: `API Proxy 오류 [${res.status}]`, raw: null, parsed: [] };
        }
        return this.getFallbackMock('API_ERROR', 'API Proxy 통신 오류');
      }

      const raw = await res.json();
      const dg = raw.domeggook || raw;

      if (raw.errors || (dg.code && String(dg.code) !== '200')) {
        this.status = 'AUTH_ERROR';
        if (!allowMockFallback) {
          return { mode: 'REAL_API', status: 'AUTH_ERROR', statusLabel: `도매꾹 API 오류 [${raw.errors?.code || dg.code}]`, raw, parsed: [] };
        }
        return this.getFallbackMock('AUTH_ERROR', `도매꾹 API 인증실패 [${raw.errors?.code || dg.code}]: ${raw.errors?.message || dg.message || ''}`);
      }

      const itemsRaw = dg.list?.item || dg.items || [];
      const itemsArray = Array.isArray(itemsRaw) ? itemsRaw : (itemsRaw ? [itemsRaw] : []);

      if (itemsArray.length === 0) {
        this.status = 'CONNECTED_EMPTY';
        return {
          mode: 'REAL_API',
          status: 'CONNECTED_EMPTY',
          statusLabel: 'REAL API 연결 성공 (검색 결과 0건)',
          raw,
          parsed: []
        };
      }

      const parsed = DomeProductModel.parseRealItemList(itemsArray);

      this.status = 'CONNECTED';
      return {
        mode: 'REAL_API',
        status: 'CONNECTED',
        statusLabel: 'REAL API 연결됨',
        raw,
        parsed
      };
    } catch (e) {
      console.warn('Proxy getItemList 호출 실패:', e.message);
      this.status = 'PROXY_NOT_CONFIGURED';

      if (!allowMockFallback) {
        return { mode: 'REAL_API', status: 'PROXY_NOT_CONFIGURED', statusLabel: 'Proxy 연결대기', raw: null, parsed: [] };
      }

      return this.getFallbackMock('PROXY_NOT_CONFIGURED', 'API Key / Proxy 연결대기 (MOCK 데이터 표시)');
    }
  }

  async getItemView(itemNo, options = {}) {
    const allowMockFallback = options.allowMockFallback !== undefined ? options.allowMockFallback : true;

    if (this.mode === 'MOCK') {
      const mockItem = SAMPLE_MOCK_PRODUCTS.find(p => String(p.no) === String(itemNo)) || SAMPLE_MOCK_PRODUCTS[0];
      const v46Object = MockDomeProductAdapter.adapt({ ...mockItem, no: itemNo });
      return {
        mode: 'MOCK',
        status: 'MOCK',
        raw: v46Object,
        parsed: new DomeProductModel(v46Object)
      };
    }

    try {
      this.status = 'CONNECTING';
      const res = await fetch(`${this.proxyBaseUrl}/api/domeme/items/${itemNo}`);

      if (!res.ok) {
        this.status = 'API_ERROR';
        if (!allowMockFallback) {
          return { mode: 'REAL_API', status: 'API_ERROR', statusLabel: `API Proxy 오류 [${res.status}]`, raw: null, parsed: null };
        }
        return this.getFallbackMockView(itemNo, 'API_ERROR', 'API 통신 오류');
      }

      const raw = await res.json();
      const dg = raw.domeggook || raw;

      if (raw.errors || (dg.code && String(dg.code) !== '200')) {
        this.status = 'AUTH_ERROR';
        if (!allowMockFallback) {
          return { mode: 'REAL_API', status: 'AUTH_ERROR', statusLabel: `도매꾹 API 인증실패 [${raw.errors?.code || dg.code}]`, raw, parsed: null };
        }
        return this.getFallbackMockView(itemNo, 'AUTH_ERROR', `도매꾹 API 인증실패 [${raw.errors?.code || dg.code}]`);
      }

      const parsed = new DomeProductModel(dg);
      this.status = 'CONNECTED';

      return {
        mode: 'REAL_API',
        status: 'CONNECTED',
        statusLabel: 'REAL API 연결됨',
        raw: dg,
        parsed
      };
    } catch (e) {
      console.warn('Proxy getItemView 호출 실패:', e.message);
      this.status = 'PROXY_NOT_CONFIGURED';

      if (!allowMockFallback) {
        return { mode: 'REAL_API', status: 'PROXY_NOT_CONFIGURED', statusLabel: 'Proxy 연결대기', raw: null, parsed: null };
      }

      return this.getFallbackMockView(itemNo, 'PROXY_NOT_CONFIGURED', 'API Key / Proxy 연결대기');
    }
  }

  getFallbackMock(status, statusLabel) {
    const parsed = SAMPLE_MOCK_PRODUCTS.map(mockItem => {
      const v46Object = MockDomeProductAdapter.adapt(mockItem);
      return new DomeProductModel(v46Object);
    });

    return {
      mode: 'MOCK_FALLBACK',
      status,
      statusLabel,
      raw: SAMPLE_MOCK_PRODUCTS,
      parsed
    };
  }

  getFallbackMockView(itemNo, status, statusLabel) {
    const mockItem = SAMPLE_MOCK_PRODUCTS.find(p => String(p.no) === String(itemNo)) || SAMPLE_MOCK_PRODUCTS[0];
    const v46Object = MockDomeProductAdapter.adapt({ ...mockItem, no: itemNo });
    return {
      mode: 'MOCK_FALLBACK',
      status,
      statusLabel,
      raw: v46Object,
      parsed: new DomeProductModel(v46Object)
    };
  }
}

export const domeApiClient = new DomeApiClient();
