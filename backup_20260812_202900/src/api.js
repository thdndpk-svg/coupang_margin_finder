/**
 * STEP 1: 도매꾹/도매매 Open API 통신 및 데이터 획득 모듈
 * - getItemList v4.1 및 getItemView v4.6 사양 지원
 * - CORS / API Key 실시간 테스트 및 표준 JSON 응답 파싱 지원
 */

import { DomeProductModel } from './models.js';

export const DOMECGOOK_API_ENDPOINT = 'https://www.domeggook.com/ssl/api/';

/**
 * 도매꾹 getItemList v4.1 실제 JSON 응답 예시 (공식 명세 100% 반영)
 */
export const SAMPLE_ITEM_LIST_V41_RESPONSE = {
  domeggook: {
    ver: "4.1",
    mode: "getItemList",
    number: 5,
    total: 1280,
    list: {
      item: [
        {
          no: 7859124,
          title: "[SAMPLE/MOCK] 대용량 보온보냉 텀블러 1000ml (스트랩형)",
          price: 7800,
          deliPrice: 3000,
          thumb: "https://picsum.photos/seed/tumbler/300/300",
          seller: "domeseller01",
          category: "1002",
          agencyFlag: "Y"
        },
        {
          no: 8941235,
          title: "[SAMPLE/MOCK] 초음파 미니 무선 탁상용 가습기",
          price: 6500,
          deliPrice: 3000,
          thumb: "https://picsum.photos/seed/humidifier/300/300",
          seller: "domeseller02",
          category: "1001",
          agencyFlag: "Y"
        },
        {
          no: 6512390,
          title: "[SAMPLE/MOCK] 고속충전 C타입 패브릭 케이블 2m",
          price: 1200,
          deliPrice: 2500,
          thumb: "https://picsum.photos/seed/cable/300/300",
          seller: "domeseller03",
          category: "1001",
          agencyFlag: "N"
        },
        {
          no: 9123841,
          title: "[SAMPLE/MOCK] 접이식 캠핑 릴렉스 체어 특대형",
          price: 18500,
          deliPrice: 4000,
          thumb: "https://picsum.photos/seed/chair/300/300",
          seller: "domeseller04",
          category: "1002",
          agencyFlag: "Y"
        },
        {
          no: 5412983,
          title: "[SAMPLE/MOCK] 유기농 저분자 피쉬콜라겐 30포",
          price: 11000,
          deliPrice: 3000,
          thumb: "https://picsum.photos/seed/collagen/300/300",
          seller: "domeseller05",
          category: "1005",
          agencyFlag: "Y"
        }
      ]
    }
  }
};

/**
 * 도매꾹 getItemView v4.6 실제 JSON 응답 예시 (공식 명세 100% 반영)
 */
export const SAMPLE_ITEM_VIEW_V46_RESPONSE = {
  domeggook: {
    ver: "4.6",
    mode: "getItemView",
    basis: {
      no: 7859124,
      title: "[SAMPLE/MOCK] 대용량 보온보냉 텀블러 1000ml (스트랩형)",
      price: 7800,
      status: "판매중",
      img: "https://picsum.photos/seed/tumbler/600/600",
      category: "1002"
    },
    ship: {
      deliFee: 3000,
      type: "선불"
    },
    qty: {
      minQty: 1
    },
    deliv: {
      agencyFlag: "Y"
    },
    sellerId: "domeseller01",
    option: {
      list: [
        { name: "매트블랙", addPrice: 0, stock: 999 },
        { name: "올리브그린", addPrice: 0, stock: 540 },
        { name: "로즈골드", addPrice: 500, stock: 120 }
      ]
    }
  }
};

export class DomeggookApiClient {
  constructor(apiKey = '') {
    this.apiKey = apiKey;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * getItemList v4.1 호출
   * @param {Object} params - { kw: 검색어, sz: 개수, page: 페이지 }
   */
  async getItemList(params = {}) {
    const kw = params.kw || '텀블러';
    const sz = params.sz || 10;
    const ver = '4.1';

    if (!this.apiKey) {
      console.info('[DomeggookApiClient] API Key가 없으므로 공식 v4.1 JSON 응답 샘플을 반환합니다.');
      const parsedList = (SAMPLE_ITEM_LIST_V41_RESPONSE.domeggook.list.item || []).map(
        item => new DomeProductModel(item, 'getItemList')
      );
      return {
        raw: SAMPLE_ITEM_LIST_V41_RESPONSE,
        parsed: parsedList,
        isMock: true,
        notice: 'API Key 미입력 상태 - 공식 v4.1 JSON 샘플 데이터 반환'
      };
    }

    try {
      const url = `${DOMECGOOK_API_ENDPOINT}?ver=${ver}&mode=getItemList&aid=${encodeURIComponent(this.apiKey)}&om=json&kw=${encodeURIComponent(kw)}&sz=${sz}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const json = await resp.json();

      const items = json.domeggook?.list?.item || [];
      const parsedList = (Array.isArray(items) ? items : [items]).map(
        item => new DomeProductModel(item, 'getItemList')
      );

      return {
        raw: json,
        parsed: parsedList,
        isMock: false
      };
    } catch (e) {
      console.warn('[DomeggookApiClient] Live API 호출 실패 (CORS 또는 Key 오류). v4.1 샘플로 대체합니다.', e);
      const parsedList = (SAMPLE_ITEM_LIST_V41_RESPONSE.domeggook.list.item || []).map(
        item => new DomeProductModel(item, 'getItemList')
      );
      return {
        raw: SAMPLE_ITEM_LIST_V41_RESPONSE,
        parsed: parsedList,
        isMock: true,
        error: e.message,
        notice: `API 호출 실패 (${e.message}) - 공식 v4.1 JSON 샘플로 대체`
      };
    }
  }

  /**
   * getItemView v4.6 호출
   * @param {string|number} itemNo - 상품번호
   */
  async getItemView(itemNo) {
    const ver = '4.6';
    const no = itemNo || '7859124';

    if (!this.apiKey) {
      console.info('[DomeggookApiClient] API Key가 없으므로 공식 v4.6 JSON 상세 샘플을 반환합니다.');
      const parsed = new DomeProductModel(SAMPLE_ITEM_VIEW_V46_RESPONSE.domeggook, 'getItemView');
      return {
        raw: SAMPLE_ITEM_VIEW_V46_RESPONSE,
        parsed: parsed,
        isMock: true,
        notice: 'API Key 미입력 상태 - 공식 v4.6 JSON 상세 샘플 데이터 반환'
      };
    }

    try {
      const url = `${DOMECGOOK_API_ENDPOINT}?ver=${ver}&mode=getItemView&aid=${encodeURIComponent(this.apiKey)}&om=json&no=${no}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const json = await resp.json();

      const parsed = new DomeProductModel(json.domeggook, 'getItemView');
      return {
        raw: json,
        parsed: parsed,
        isMock: false
      };
    } catch (e) {
      console.warn('[DomeggookApiClient] Live API 호출 실패. v4.6 상세 샘플로 대체합니다.', e);
      const parsed = new DomeProductModel(SAMPLE_ITEM_VIEW_V46_RESPONSE.domeggook, 'getItemView');
      return {
        raw: SAMPLE_ITEM_VIEW_V46_RESPONSE,
        parsed: parsed,
        isMock: true,
        error: e.message,
        notice: `API 호출 실패 (${e.message}) - 공식 v4.6 JSON 샘플로 대체`
      };
    }
  }
}

export const domeApiClient = new DomeggookApiClient();
