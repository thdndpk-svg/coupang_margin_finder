/**
 * STEP 2: 도매꾹/도매매 Open API 통신 및 MOCK 데이터 획득 모듈
 * - 15개 이상의 MOCK/SAMPLE 상품 데이터 제공 (각 상품에 [SAMPLE/MOCK] 태그 명시)
 * - 기존 안전 인터페이스 및 v4.1/v4.6 구조 보존
 */

import { DomeProductModel } from './models.js';

export const DOMECGOOK_API_ENDPOINT = 'https://www.domeggook.com/ssl/api/';

/**
 * STEP 2 MOCK/SAMPLE 실전 상품 데이터셋 (15개)
 */
export const SAMPLE_MOCK_PRODUCTS = [
  {
    no: 7859124,
    title: "[SAMPLE/MOCK] 대용량 보온보냉 텀블러 1000ml (스트랩형)",
    price: 7800,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/tumbler/300/300",
    seller: "domeseller01",
    category: "1002",
    agencyFlag: "Y",
    defaultCoupangPrice: 28900
  },
  {
    no: 8941235,
    title: "[SAMPLE/MOCK] 초음파 미니 무선 탁상용 가습기",
    price: 6500,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/humidifier/300/300",
    seller: "domeseller02",
    category: "1001",
    agencyFlag: "Y",
    defaultCoupangPrice: 24900
  },
  {
    no: 6512390,
    title: "[SAMPLE/MOCK] 고속충전 C타입 패브릭 케이블 2m",
    price: 1200,
    deliPrice: 2500,
    thumb: "https://picsum.photos/seed/cable/300/300",
    seller: "domeseller03",
    category: "1001",
    agencyFlag: "N",
    defaultCoupangPrice: 5900
  },
  {
    no: 9123841,
    title: "[SAMPLE/MOCK] 접이식 캠핑 릴렉스 체어 특대형",
    price: 18500,
    deliPrice: 4000,
    thumb: "https://picsum.photos/seed/chair/300/300",
    seller: "domeseller04",
    category: "1006",
    agencyFlag: "Y",
    defaultCoupangPrice: 45000
  },
  {
    no: 5412983,
    title: "[SAMPLE/MOCK] 유기농 저분자 피쉬콜라겐 30포",
    price: 11000,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/collagen/300/300",
    seller: "domeseller05",
    category: "1005",
    agencyFlag: "Y",
    defaultCoupangPrice: 32000
  },
  {
    no: 4129851,
    title: "[SAMPLE/MOCK] 프리미엄 무소음 인테리어 LED 벽시계",
    price: 9800,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/clock/300/300",
    seller: "domeseller06",
    category: "1002",
    agencyFlag: "Y",
    defaultCoupangPrice: 29800
  },
  {
    no: 3129482,
    title: "[SAMPLE/MOCK] 자동 폼클렌징 손세정기 센서 디스펜서",
    price: 8200,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/dispenser/300/300",
    seller: "domeseller07",
    category: "1003",
    agencyFlag: "Y",
    defaultCoupangPrice: 26500
  },
  {
    no: 2198347,
    title: "[SAMPLE/MOCK] 남성용 오버핏 기모 후드 집업 스웨트셔츠",
    price: 14000,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/hoodie/300/300",
    seller: "domeseller08",
    category: "1004",
    agencyFlag: "Y",
    defaultCoupangPrice: 38900
  },
  {
    no: 1092834,
    title: "[SAMPLE/MOCK] 강아지 고양이 음성녹음 자동 급식기 4L",
    price: 24000,
    deliPrice: 3500,
    thumb: "https://picsum.photos/seed/petfeeder/300/300",
    seller: "domeseller09",
    category: "1007",
    agencyFlag: "Y",
    defaultCoupangPrice: 59000
  },
  {
    no: 8392014,
    title: "[SAMPLE/MOCK] 차량용 고속 무선충전 스마트폰 거치대",
    price: 7500,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/carmount/300/300",
    seller: "domeseller10",
    category: "1001",
    agencyFlag: "Y",
    defaultCoupangPrice: 23900
  },
  {
    no: 7483920,
    title: "[SAMPLE/MOCK] 밀폐형 스테인리스 음식물 쓰레기통 3L",
    price: 12500,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/trashcan/300/300",
    seller: "domeseller11",
    category: "1002",
    agencyFlag: "Y",
    defaultCoupangPrice: 33000
  },
  {
    no: 6392019,
    title: "[SAMPLE/MOCK] 원터치 팝업 모기장 텐트 2인용",
    price: 15200,
    deliPrice: 3500,
    thumb: "https://picsum.photos/seed/tent/300/300",
    seller: "domeseller12",
    category: "1006",
    agencyFlag: "Y",
    defaultCoupangPrice: 39900
  },
  {
    no: 5291038,
    title: "[SAMPLE/MOCK] 제주 한라봉 진액 스틱 60포 선물세트",
    price: 19000,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/hallabong/300/300",
    seller: "domeseller13",
    category: "1005",
    agencyFlag: "Y",
    defaultCoupangPrice: 48000
  },
  {
    no: 4182903,
    title: "[SAMPLE/MOCK] 6날 고속충전 휴대용 보풀제거기",
    price: 5800,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/remover/300/300",
    seller: "domeseller14",
    category: "1001",
    agencyFlag: "Y",
    defaultCoupangPrice: 18900
  },
  {
    no: 3091827,
    title: "[SAMPLE/MOCK] 에어쿠션 가벼운 남녀공용 조깅 운동화",
    price: 16800,
    deliPrice: 3000,
    thumb: "https://picsum.photos/seed/shoes/300/300",
    seller: "domeseller15",
    category: "1004",
    agencyFlag: "Y",
    defaultCoupangPrice: 42000
  }
];

export const SAMPLE_ITEM_LIST_V41_RESPONSE = {
  domeggook: {
    ver: "4.1",
    mode: "getItemList",
    number: SAMPLE_MOCK_PRODUCTS.length,
    total: SAMPLE_MOCK_PRODUCTS.length,
    list: {
      item: SAMPLE_MOCK_PRODUCTS
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

  async getItemList(params = {}) {
    const parsedList = SAMPLE_MOCK_PRODUCTS.map(
      item => new DomeProductModel(item, 'getItemList')
    );
    return {
      raw: SAMPLE_ITEM_LIST_V41_RESPONSE,
      parsed: parsedList,
      isMock: true,
      notice: 'API Key 연동 전 STEP 2 MVP 모드 - 15개 실전 MOCK 데이터 렌더링'
    };
  }

  async getItemView(itemNo) {
    const item = SAMPLE_MOCK_PRODUCTS.find(p => String(p.no) === String(itemNo)) || SAMPLE_MOCK_PRODUCTS[0];
    const mockViewResponse = {
      domeggook: {
        ver: "4.6",
        mode: "getItemView",
        basis: {
          no: item.no,
          title: item.title,
          price: item.price,
          status: "판매중",
          img: item.thumb,
          category: item.category
        },
        ship: {
          deliFee: item.deliPrice,
          type: "선불"
        },
        qty: {
          minQty: 1
        },
        deliv: {
          agencyFlag: item.agencyFlag
        },
        sellerId: item.seller,
        option: {
          list: [
            { name: "기본 옵션 A", addPrice: 0, stock: 999 },
            { name: "고급 옵션 B", addPrice: 1000, stock: 500 }
          ]
        }
      }
    };

    const parsed = new DomeProductModel(mockViewResponse.domeggook, 'getItemView');
    return {
      raw: mockViewResponse,
      parsed: parsed,
      isMock: true,
      notice: 'STEP 2 MOCK 상세 응답 데이터'
    };
  }
}

export const domeApiClient = new DomeggookApiClient();
