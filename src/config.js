/**
 * STEP 2: 수수료 및 로켓그로스, 월 고정비, 수익성 임계값 동적 설정 (ConfigStore)
 */

export const DEFAULT_CONFIG = {
  // VAT 10% 별도 부과 여부 (false면 명목 수수료율 * 1.1 적용)
  vatIncludedInRate: false,

  // 카테고리별 쿠팡 표준 수수료율 (VAT 별도 명목 수수료율)
  categoryFees: {
    '1001': { name: '가전/디지털', rate: 0.08 },
    '1002': { name: '생활/주방용품', rate: 0.108 },
    '1003': { name: '뷰티/화장품', rate: 0.105 },
    '1004': { name: '패션/의류', rate: 0.115 },
    '1005': { name: '식품', rate: 0.11 },
    '1006': { name: '스포츠/레저', rate: 0.108 },
    '1007': { name: '반려동물용품', rate: 0.108 },
    'default': { name: '기타/기본 카테고리', rate: 0.108 }
  },

  // 쿠팡 결제 배송비 수수료율 (VAT 포함 약 3.63% / 명목 3.3%)
  shippingFeeCommissionRate: 0.0363,

  // 로켓그로스 입출고/배송 요금 설정 (단위: 원/건)
  rocketGrowth: {
    enabled: false,
    fulfillmentFeePerUnit: 2500, // 건당 입출고/배송 처리비
    storageFeePerUnitDay: 15,    // CBM/일 기준 보관료 환산액
    avgStorageDays: 14           // 평균 보관 일수
  },

  // 월 고정 비용 (Monthly Overhead) - 상품 1건 마진 계산에서 차감하지 않음!
  monthlyOverhead: {
    coupangServiceFee: 55000,    // 쿠팡 월 매출 100만 원 초과 시 이용료 (VAT 포함)
    solutionFee: 0,              // 외부 연동 솔루션 월 이용료
    otherMonthlyFixedCost: 0      // 기타 월 고정비
  },

  // 기본 반품 loss 비율 및 건당 광고비 (보수적 순이익 산출용)
  conservativeLoss: {
    returnRate: 0.02,            // 2% 반품 손실률
    adSpendPerUnit: 1500,        // 건당 평균 타겟 광고비
    packagingCostPerUnit: 500    // 건당 포장/박스비 (사입시)
  },

  // 수익성 등급 판단 기준 (기본값)
  tiers: {
    passMinProfit: 20000,        // 판매 후보: 20,000원 이상
    reviewMinProfit: 10000       // 검토 후보: 10,000원 ~ 19,999원
  },

  // 목표 수익 설정 (기본 하루 목표 순수익 300,000원)
  targets: {
    dailyNetProfit: 300000       // 하루 순수익 목표 (원)
  }
};

class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('coupang_margin_config_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          categoryFees: { ...DEFAULT_CONFIG.categoryFees, ...(parsed.categoryFees || {}) },
          rocketGrowth: { ...DEFAULT_CONFIG.rocketGrowth, ...(parsed.rocketGrowth || {}) },
          monthlyOverhead: { ...DEFAULT_CONFIG.monthlyOverhead, ...(parsed.monthlyOverhead || {}) },
          conservativeLoss: { ...DEFAULT_CONFIG.conservativeLoss, ...(parsed.conservativeLoss || {}) },
          tiers: { ...DEFAULT_CONFIG.tiers, ...(parsed.tiers || {}) },
          targets: { ...DEFAULT_CONFIG.targets, ...(parsed.targets || {}) }
        };
      }
    } catch (e) {
      console.warn('Failed to load config from localStorage, using defaults:', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      conservativeLoss: { ...this.config.conservativeLoss, ...(newConfig.conservativeLoss || {}) },
      tiers: { ...this.config.tiers, ...(newConfig.tiers || {}) },
      targets: { ...this.config.targets, ...(newConfig.targets || {}) },
      monthlyOverhead: { ...this.config.monthlyOverhead, ...(newConfig.monthlyOverhead || {}) }
    };
    try {
      localStorage.setItem('coupang_margin_config_v2', JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  resetConfig() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    localStorage.removeItem('coupang_margin_config_v2');
  }

  getCategoryFeeRate(categoryCode) {
    const cat = this.config.categoryFees[categoryCode] || this.config.categoryFees['default'];
    return this.config.vatIncludedInRate ? cat.rate : cat.rate * 1.1;
  }
}

export const configManager = new ConfigManager();
