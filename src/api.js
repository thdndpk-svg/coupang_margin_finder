/**
 * STEP 2.1.2: 도매꾹/도매매 Open API 클라이언트 & MOCK 데이터 (api.js)
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
  },
  {
    isMock: true,
    no: '100006',
    title: '[MOCK] 저소음 탁상용 탁상용 USB 미니 선풍기',
    price: 6500,
    deliPrice: 3000,
    category: '1001',
    thumb: 'https://via.placeholder.com/80/06b6d4/ffffff?text=Fan',
    agencyFlag: 'Y',
    defaultCoupangPrice: 15900
  },
  {
    isMock: true,
    no: '100007',
    title: '[MOCK] 자동 압축 파우치 여행용 옷정리 백 4종',
    price: 8900,
    deliPrice: 3000,
    category: '1002',
    thumb: 'https://via.placeholder.com/80/ec4899/ffffff?text=Pouch',
    agencyFlag: 'Y',
    defaultCoupangPrice: 19800
  },
  {
    isMock: true,
    no: '100008',
    title: '[MOCK] LED 무드등 경량 보조배터리 10000mAh',
    price: 9800,
    deliPrice: 2500,
    category: '1001',
    thumb: 'https://via.placeholder.com/80/84cc16/ffffff?text=Battery',
    agencyFlag: 'Y',
    defaultCoupangPrice: 22900
  },
  {
    isMock: true,
    no: '100009',
    title: '[MOCK] 304 스텐 휴대용 수저 세트 + 케이스',
    price: 2400,
    deliPrice: 2500,
    category: '1002',
    thumb: 'https://via.placeholder.com/80/f97316/ffffff?text=Spoon',
    agencyFlag: 'Y',
    defaultCoupangPrice: 7900
  },
  {
    isMock: true,
    no: '100010',
    title: '[MOCK] 인체공학 메모리폼 목베개 경추 베개',
    price: 11200,
    deliPrice: 3000,
    category: '1002',
    thumb: 'https://via.placeholder.com/80/14b8a6/ffffff?text=Pillow',
    agencyFlag: 'Y',
    defaultCoupangPrice: 26900
  },
  {
    isMock: true,
    no: '100011',
    title: '[MOCK] 극세사 스팀 청소기 밀대 패드 3매',
    price: 4500,
    deliPrice: 2500,
    category: '1002',
    thumb: 'https://via.placeholder.com/80/6366f1/ffffff?text=MopPad',
    agencyFlag: 'Y',
    defaultCoupangPrice: 12900
  },
  {
    isMock: true,
    no: '100012',
    title: '[MOCK] 실리콘 접이식 드립커피 필터 드리퍼',
    price: 2800,
    deliPrice: 2500,
    category: '1002',
    thumb: 'https://via.placeholder.com/80/a855f7/ffffff?text=Dripper',
    agencyFlag: 'Y',
    defaultCoupangPrice: 8900
  },
  {
    isMock: true,
    no: '100013',
    title: '[MOCK] 방수 스포티 무선 이어폰 헤드셋',
    price: 22000,
    deliPrice: 3000,
    category: '1001',
    thumb: 'https://via.placeholder.com/80/3b82f6/ffffff?text=SportEar',
    agencyFlag: 'Y',
    defaultCoupangPrice: 48900
  },
  {
    isMock: true,
    no: '100014',
    title: '[MOCK] 다기능 홈 트레이닝 푸쉬업 바 세트',
    price: 7500,
    deliPrice: 3000,
    category: '1006',
    thumb: 'https://via.placeholder.com/80/10b981/ffffff?text=Pushup',
    agencyFlag: 'Y',
    defaultCoupangPrice: 18900
  },
  {
    isMock: true,
    no: '100015',
    title: '[MOCK] 반려동물 자동 급수기 2.5L 정수 필터',
    price: 14800,
    deliPrice: 3000,
    category: '1007',
    thumb: 'https://via.placeholder.com/80/f59e0b/ffffff?text=PetFountain',
    agencyFlag: 'Y',
    defaultCoupangPrice: 32900
  }
];

export class DomeApiClient {
  constructor() {
    this.apiKey = null;
    this.mode = 'MOCK';
  }

  setApiKey(key) {
    this.apiKey = key;
    this.mode = key ? 'REAL_API' : 'MOCK';
  }

  async getItemList() {
    if (this.mode === 'MOCK') {
      const parsed = SAMPLE_MOCK_PRODUCTS.map(mockItem => {
        const v46Object = MockDomeProductAdapter.adapt(mockItem);
        return new DomeProductModel(v46Object);
      });

      return {
        mode: 'MOCK',
        raw: SAMPLE_MOCK_PRODUCTS,
        parsed
      };
    }

    return {
      mode: 'REAL_API',
      raw: [],
      parsed: []
    };
  }

  async getItemView(itemNo) {
    if (this.mode === 'MOCK') {
      const mockItem = SAMPLE_MOCK_PRODUCTS.find(p => p.no === String(itemNo)) || SAMPLE_MOCK_PRODUCTS[0];
      const v46Object = MockDomeProductAdapter.adapt(mockItem);
      return {
        mode: 'MOCK',
        raw: mockItem,
        parsed: new DomeProductModel(v46Object)
      };
    }

    return {
      mode: 'REAL_API',
      raw: null,
      parsed: null
    };
  }
}

export const domeApiClient = new DomeApiClient();
