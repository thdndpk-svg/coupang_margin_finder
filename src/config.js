/**
 * STEP 2.1.1: 동적 마진 설정 및 LocalStorage 마이그레이션 관리 (config.js)
 */

import { DEFAULT_TAX_RATE, DEFAULT_TARGET_DAILY_PROFIT, DEFAULT_TIER_THRESHOLDS, FEE_STATUS } from './constants.js';

export const STORAGE_KEY_V2_1_1 = 'coupang_margin_config_v2_1_1';
export const LEGACY_STORAGE_KEYS = ['coupang_margin_config_v2', 'coupang_margin_config_v2_1'];

// 카테고리 수수료 상태 정보 구조
export const DEFAULT_CATEGORY_FEE_MAP = {
  '1001': { name: '가전/디지털', rate: 0.08, status: FEE_STATUS.TEMPORARY_ASSUMPTION.id, vatIncluded: false },
  '1002': { name: '생활/주방용품', rate: 0.108, status: FEE_STATUS.TEMPORARY_ASSUMPTION.id, vatIncluded: false },
  '1003': { name: '뷰티/화장품', rate: 0.105, status: FEE_STATUS.TEMPORARY_ASSUMPTION.id, vatIncluded: false },
  '1004': { name: '패션/의류', rate: 0.115, status: FEE_STATUS.TEMPORARY_ASSUMPTION.id, vatIncluded: false },
  '1005': { name: '식품', rate: 0.110, status: FEE_STATUS.TEMPORARY_ASSUMPTION.id, vatIncluded: false },
  '1006': { name: '스포츠/레저', rate: 0.108, status: FEE_STATUS.TEMPORARY_ASSUMPTION.id, vatIncluded: false },
  '1007': { name: '반려동물용품', rate: 0.108, status: FEE_STATUS.TEMPORARY_ASSUMPTION.id, vatIncluded: false }
};

export const DEFAULT_CONFIG = {
  version: '2.1.1',
  taxRate: DEFAULT_TAX_RATE, // 0.015 (1.5%)
  targetDailyProfit: DEFAULT_TARGET_DAILY_PROFIT, // 300,000원
  shippingFeeCommissionRate: 0, // 기본 0
  returnRate: 0, // 기본 0
  lossPerReturn: 0, // 기본 0 (건당 실제 손실액)
  targetAdCostPerOrder: 0, // 기본 0
  packagingCost: 0, // 기본 0
  monthlyServiceFee: 55000, // 월 55,000원 고정비
  passProfitThreshold: DEFAULT_TIER_THRESHOLDS.GRADE_A, // 20,000원
  reviewProfitThreshold: DEFAULT_TIER_THRESHOLDS.GRADE_B, // 10,000원
  categoryFees: DEFAULT_CATEGORY_FEE_MAP
};

export class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (typeof localStorage === 'undefined') return;

      // 1. 최신 v2.1.1 설정 읽기
      const savedV211 = localStorage.getItem(STORAGE_KEY_V2_1_1);
      if (savedV211) {
        const parsed = JSON.parse(savedV211);
        this.config = this.sanitizeConfig(parsed);
        return;
      }

      // 2. 구버전 (v2, v2_1) 마이그레이션 수행
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacySaved = localStorage.getItem(legacyKey);
        if (legacySaved) {
          try {
            const legacyData = JSON.parse(legacySaved);
            const migrated = this.migrateLegacyConfig(legacyData);
            this.config = migrated;
            this.saveConfig();
            console.log(`✅ LocalStorage legacy config (${legacyKey}) migrated to ${STORAGE_KEY_V2_1_1}`);
            return;
          } catch (e) {
            console.warn(`Legacy migration failed for ${legacyKey}:`, e);
          }
        }
      }
    } catch (e) {
      console.warn('Config load/migration error:', e);
    }
  }

  /**
   * 구버전 위험 기본값(3.63%, 2%, 1500원, 500원, x1.1) 정화 및 마이그레이션
   */
  migrateLegacyConfig(legacyData) {
    const newConfig = { ...DEFAULT_CONFIG };

    if (legacyData) {
      // 1. 위험한 옛 기본값 제거
      if (legacyData.shippingFeeCommissionRate === 0.0363) newConfig.shippingFeeCommissionRate = 0;
      else if (legacyData.shippingFeeCommissionRate !== undefined) newConfig.shippingFeeCommissionRate = Number(legacyData.shippingFeeCommissionRate);

      if (legacyData.returnRate === 0.02 || legacyData.conservativeLoss?.returnRate === 0.02) newConfig.returnRate = 0;
      else if (legacyData.returnRate !== undefined) newConfig.returnRate = Number(legacyData.returnRate);

      if (legacyData.targetAdCostPerOrder === 1500 || legacyData.conservativeLoss?.adSpendPerUnit === 1500) newConfig.targetAdCostPerOrder = 0;
      else if (legacyData.targetAdCostPerOrder !== undefined) newConfig.targetAdCostPerOrder = Number(legacyData.targetAdCostPerOrder);

      if (legacyData.packagingCost === 500 || legacyData.conservativeLoss?.packagingCostPerUnit === 500) newConfig.packagingCost = 0;
      else if (legacyData.packagingCost !== undefined) newConfig.packagingCost = Number(legacyData.packagingCost);

      if (legacyData.targetDailyProfit) newConfig.targetDailyProfit = Number(legacyData.targetDailyProfit);
      if (legacyData.passProfitThreshold) newConfig.passProfitThreshold = Number(legacyData.passProfitThreshold);
      if (legacyData.reviewProfitThreshold) newConfig.reviewProfitThreshold = Number(legacyData.reviewProfitThreshold);
    }

    return newConfig;
  }

  sanitizeConfig(configData) {
    return {
      ...DEFAULT_CONFIG,
      ...configData,
      shippingFeeCommissionRate: Number(configData.shippingFeeCommissionRate || 0),
      returnRate: Number(configData.returnRate || 0),
      lossPerReturn: Number(configData.lossPerReturn || 0),
      targetAdCostPerOrder: Number(configData.targetAdCostPerOrder || 0),
      packagingCost: Number(configData.packagingCost || 0)
    };
  }

  saveConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_V2_1_1, JSON.stringify(this.config));
      }
    } catch (e) {
      console.error('Config save error:', e);
    }
  }

  resetToDefault() {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig();
  }

  /**
   * 카테고리 수수료 객체 반환 (수수료 자동 x1.1 제거)
   */
  getCategoryFeeObject(categoryCode) {
    const feeObj = this.config.categoryFees[categoryCode] || {
      name: '미확인 카테고리',
      rate: null,
      status: FEE_STATUS.UNCONFIRMED.id,
      vatIncluded: null,
      verifiedAt: null,
      source: null
    };

    return feeObj;
  }

  getCategoryFeeRate(categoryCode) {
    const feeObj = this.getCategoryFeeObject(categoryCode);
    return feeObj ? feeObj.rate : null;
  }
}

export const configManager = new ConfigManager();
