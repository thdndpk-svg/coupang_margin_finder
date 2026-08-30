/**
 * STEP 2.1: 마진 계산 엔진 (Margin Engine v2.1)
 * - 세금충당 (간이과세 1.5%) 기본 차감 반영
 * - 기본/보수 상품이익 산출
 * - 하루 30만원 목표 달성 수량 산출 (기본이익 <= 0 인 경우 null 및 UI '달성불가')
 * - A급(≥2만)/B급(1만~2만)/C급(0~1만)/적자 등급 자동 분류
 */

import { configManager } from './config.js';
import { PROFIT_TIERS } from './constants.js';

export const SHIPPING_TYPES = {
  DROP_SHIPPING_FREE: { id: 'DROP_SHIPPING_FREE', name: '위탁배송 (고객 무료배송)', desc: '고객 무배 판매. 도매처 배송비 1회만 부담.' },
  DROP_SHIPPING_PAID: { id: 'DROP_SHIPPING_PAID', name: '위탁배송 (고객 배송비 수령)', desc: '고객 배송비 결제. 결제액 순수령 차감.' },
  DIRECT_PURCHASE: { id: 'DIRECT_PURCHASE', name: '사입배송 (자사 입고 후 발송)', desc: '도매 입고비 + 자사 택배비 + 포장비 발생.' },
  ROCKET_GROWTH: { id: 'ROCKET_GROWTH', name: '로켓그로스 입고 판매', desc: '도매 입고비 + 로켓그로스 수수료 및 보관료 발생.' }
};

export class MarginCalculator {
  static calculate(params = {}) {
    const config = configManager.config;

    // product 객체 또는 직접 파라미터 파싱
    const product = params.product || null;

    const wholesalePrice = Number(
      params.wholesalePrice ?? (product ? product.wholesalePrice : 0)
    );
    const wholesaleShippingFee = Number(
      params.wholesaleShippingFee ?? (product ? product.wholesaleShippingFee : 0)
    );
    const coupangPrice = Number(
      params.userCoupangPrice ?? params.coupangPrice ?? (product ? product.userCoupangPrice : 0)
    );

    const categoryCode = params.categoryCode || (product ? product.categoryCode : '1002');
    const shippingType = params.shippingType || 'DROP_SHIPPING_FREE';
    const customerPaidShippingFee = Number(params.customerPaidShippingFee || 0);

    // 1. 쿠팡 수수료율 및 금액
    const feeRate = (params.customFeeRate !== undefined && params.customFeeRate !== null)
      ? Number(params.customFeeRate)
      : configManager.getCategoryFeeRate(categoryCode);

    const coupangFee = Math.round(coupangPrice * feeRate);

    // 2. 총원가 (도매가 + 도매배송비)
    let supplierShippingCost = wholesaleShippingFee;
    let customerShippingNetRevenue = 0;

    if (shippingType === 'DROP_SHIPPING_PAID') {
      customerShippingNetRevenue = Math.round(customerPaidShippingFee * (1 - config.shippingFeeCommissionRate));
    }

    const totalCost = wholesalePrice + supplierShippingCost;

    // 3. 간이과세 세금충당 (1.5%)
    const taxRate = config.taxRate || 0.015;
    const taxableSales = coupangPrice + (shippingType === 'DROP_SHIPPING_PAID' ? customerPaidShippingFee : 0);
    const taxReserve = Math.round(taxableSales * taxRate);

    // 4. 추가 확인된 유상 비용 (확인된 비용만 차감, 기본 0원)
    const confirmedCosts = (params.customCosts || 0);

    // 5. 기본 상품이익 (Basic Product Profit)
    const basicProfit = coupangPrice + customerShippingNetRevenue - wholesalePrice - supplierShippingCost - coupangFee - taxReserve - confirmedCosts;

    // 6. 보수 상품이익 (Conservative Product Profit)
    const returnRate = (params.customReturnRate !== undefined && params.customReturnRate !== null)
      ? Number(params.customReturnRate)
      : (config.returnRate || 0);

    const adSpend = (params.customAdSpend !== undefined && params.customAdSpend !== null)
      ? Number(params.customAdSpend)
      : (config.targetAdCostPerOrder || 0);

    const packagingCost = (params.customPackagingCost !== undefined && params.customPackagingCost !== null)
      ? Number(params.customPackagingCost)
      : (config.packagingCost || 0);

    const returnLoss = Math.round(coupangPrice * returnRate);
    const conservativeProfit = basicProfit - returnLoss - adSpend - packagingCost;

    // 7. 마진율 및 ROI
    const marginRate = coupangPrice > 0 ? (basicProfit / coupangPrice) * 100 : 0;
    const roi = totalCost > 0 ? (basicProfit / totalCost) * 100 : 0;

    // 8. 하루 30만원 목표 달성 수량
    const targetDailyProfit = config.targetDailyProfit || 300000;
    const requiredDailySales = basicProfit > 0 ? Math.ceil(targetDailyProfit / basicProfit) : null;
    const conservativeRequiredDailySales = conservativeProfit > 0 ? Math.ceil(targetDailyProfit / conservativeProfit) : null;

    // 9. 수익성 등급 자동 분류
    const passThreshold = config.passProfitThreshold || 20000;
    const reviewThreshold = config.reviewProfitThreshold || 10000;

    let profitTier = PROFIT_TIERS.DEFICIT;
    if (basicProfit >= passThreshold) {
      profitTier = PROFIT_TIERS.GRADE_A;
    } else if (basicProfit >= reviewThreshold) {
      profitTier = PROFIT_TIERS.GRADE_B;
    } else if (basicProfit >= 0) {
      profitTier = PROFIT_TIERS.GRADE_C;
    }

    return {
      coupangPrice,
      wholesalePrice,
      wholesaleShippingFee,
      supplierShippingCost,
      totalCost,
      feeRate,
      coupangFee,
      taxReserve,
      confirmedCosts,
      basicProfit,
      basicNetProfit: basicProfit, // 레거시 호환
      conservativeProfit,
      conservativeNetProfit: conservativeProfit, // 레거시 호환
      returnLoss,
      adSpend,
      packagingCost,
      marginRate: Number(marginRate.toFixed(1)),
      roi: Number(roi.toFixed(1)),
      targetDailyProfit,
      requiredDailySales,
      dailyRequiredQty: requiredDailySales ?? 0, // 레거시 호환
      conservativeRequiredDailySales,
      profitTier,
      candidateTier: profitTier.id,
      candidateTierName: profitTier.name
    };
  }

  /**
   * 손익분기 판매가 역산
   */
  static calcBreakEvenPrice({ wholesalePrice, wholesaleShippingFee, feeRate = 0.108, taxRate = 0.015 }) {
    const totalCost = Number(wholesalePrice || 0) + Number(wholesaleShippingFee || 0);
    const denominator = 1 - feeRate - taxRate;
    if (denominator <= 0) return 0;
    return Math.ceil(totalCost / denominator);
  }

  /**
   * 목표 건당 이익을 달성하기 위한 쿠팡 판매가 역산
   */
  static calcTargetSellingPrice({ wholesalePrice, wholesaleShippingFee, targetProfit, feeRate = 0.108, taxRate = 0.015 }) {
    const totalCost = Number(wholesalePrice || 0) + Number(wholesaleShippingFee || 0);
    const denominator = 1 - feeRate - taxRate;
    if (denominator <= 0) return 0;
    return Math.ceil((totalCost + Number(targetProfit || 0)) / denominator);
  }
}
