/**
 * STEP 1: 마진 계산 엔진 기본형 (Margin Engine v1.0)
 * - 배송비 4가지 구조별 중복 차감 방지
 * - 하드코딩 없는 수수료 및 로켓그로스 동적 설정 연동
 * - 월 55,000원 서비스 이용료는 상품 1건 차감에서 제외 (월 고정비로 관리)
 */

import { configManager } from './config.js';

export const SHIPPING_TYPES = {
  DROP_SHIPPING_FREE: { id: 'DROP_SHIPPING_FREE', name: '위탁배송 (판매자 무료배송)', desc: '고객에게 무배 판매. 도매처 배송비 1회만 부담.' },
  DROP_SHIPPING_PAID: { id: 'DROP_SHIPPING_PAID', name: '위탁배송 (고객 배송비 수령)', desc: '고객이 배송비 결제. 배송비 수수료 제외 후 도매 배송비 차감.' },
  DIRECT_PURCHASE: { id: 'DIRECT_PURCHASE', name: '사입배송 (자사 입고 후 발송)', desc: '도매 입고 배송비 + 쿠팡 발송 택배비 2회 및 포장비 발생.' },
  ROCKET_GROWTH: { id: 'ROCKET_GROWTH', name: '로켓그로스 입고 판매', desc: '도매 입고 배송비 + 로켓그로스 입출고/배송 및 보관 수수료 발생.' }
};

export class MarginCalculator {
  /**
   * @param {Object} params
   * @param {number} params.coupangPrice - 쿠팡 판매설정가
   * @param {number} params.wholesalePrice - 도매 공급가
   * @param {number} params.wholesaleShippingFee - 도매 배송비
   * @param {string} [params.categoryCode] - 쿠팡 카테고리 코드
   * @param {string} [params.shippingType] - 배송 유형 (SHIPPING_TYPES key)
   * @param {number} [params.customerPaidShippingFee] - 고객 결제 배송비 (DROP_SHIPPING_PAID 일 경우)
   * @param {number} [params.sellerCourierFee] - 사입시 고객 발송 택배비 (DIRECT_PURCHASE 일 경우)
   * @param {number} [params.customFeeRate] - 수동 지정 수수료율 (지정 시 동적 수수료 대신 적용)
   */
  static calculate(params) {
    const config = configManager.config;

    const coupangPrice = Number(params.coupangPrice || 0);
    const wholesalePrice = Number(params.wholesalePrice || 0);
    const wholesaleShippingFee = Number(params.wholesaleShippingFee || 0);
    const categoryCode = params.categoryCode || 'default';
    const shippingType = params.shippingType || 'DROP_SHIPPING_FREE';
    const customerPaidShippingFee = Number(params.customerPaidShippingFee || 0);
    const sellerCourierFee = Number(params.sellerCourierFee || 3000);

    // 1. 쿠팡 판매 수수료 산출 (VAT 10% 포함 여부 처리)
    const feeRate = (params.customFeeRate !== undefined && params.customFeeRate !== null)
      ? Number(params.customFeeRate)
      : configManager.getCategoryFeeRate(categoryCode);

    const coupangFee = Math.round(coupangPrice * feeRate);

    // 2. 배송비 4가지 산정 구조 (중복 계산 방지 로직)
    let actualShippingCost = 0;
    let shippingNote = '';

    switch (shippingType) {
      case 'DROP_SHIPPING_FREE':
        // 고객 무료배송: 판매자가 도매처 배송비 1회만 부담
        actualShippingCost = wholesaleShippingFee;
        shippingNote = `도매 배송비 1회만 차감 (${wholesaleShippingFee.toLocaleString()}원)`;
        break;

      case 'DROP_SHIPPING_PAID':
        // 고객 결제 배송비 수령: (도매 배송비) - (고객 결제 배송비 - 배송비 결제수수료)
        const customerNetShippingRecv = customerPaidShippingFee * (1 - config.shippingFeeCommissionRate);
        actualShippingCost = wholesaleShippingFee - customerNetShippingRecv;
        shippingNote = `도매배송비(${wholesaleShippingFee.toLocaleString()}원) - 고객결제액 순수령(${Math.round(customerNetShippingRecv).toLocaleString()}원)`;
        break;

      case 'DIRECT_PURCHASE':
        // 사입: 도매 입고 배송비 + 자사 택배비 + 포장비
        const pkgCost = config.conservativeLoss.packagingCostPerUnit || 500;
        actualShippingCost = wholesaleShippingFee + sellerCourierFee + pkgCost;
        shippingNote = `도매입고비(${wholesaleShippingFee.toLocaleString()}원) + 자사택배비(${sellerCourierFee.toLocaleString()}원) + 포장비(${pkgCost.toLocaleString()}원)`;
        break;

      case 'ROCKET_GROWTH':
        // 로켓그로스: 도매 입고 배송비 + 입출고/배송 처리비 + 보관료
        const rg = config.rocketGrowth;
        const storageFee = rg.storageFeePerUnitDay * rg.avgStorageDays;
        actualShippingCost = wholesaleShippingFee + rg.fulfillmentFeePerUnit + storageFee;
        shippingNote = `도매입고비(${wholesaleShippingFee.toLocaleString()}원) + 로켓입출고비(${rg.fulfillmentFeePerUnit.toLocaleString()}원) + 보관료(${storageFee.toLocaleString()}원)`;
        break;

      default:
        actualShippingCost = wholesaleShippingFee;
        shippingNote = `기본 도매 배송비 적용 (${wholesaleShippingFee.toLocaleString()}원)`;
    }

    // 3. 총 원가 산출 (상품가 + 실부담 배송비)
    const totalCost = wholesalePrice + actualShippingCost;

    // 4. 기본 예상 순이익 (Basic Net Profit)
    // 주의: 월 55,000원 서비스 이용료는 상품 1건 단위에서 차감하지 않음!
    const basicNetProfit = coupangPrice - totalCost - coupangFee;

    // 5. 보수적 예상 순이익 (Conservative Net Profit)
    // 반품 loss + 타겟 광고비 차감
    const returnLoss = Math.round(coupangPrice * config.conservativeLoss.returnRate);
    const adSpend = config.conservativeLoss.adSpendPerUnit;
    const conservativeNetProfit = basicNetProfit - returnLoss - adSpend;

    // 6. 마진율 및 ROI
    const marginRate = coupangPrice > 0 ? (basicNetProfit / coupangPrice) * 100 : 0;
    const roi = totalCost > 0 ? (basicNetProfit / totalCost) * 100 : 0;

    // 7. 대량 판매 예상 수익 및 하루 목표 달성 필요 수량
    const targetDailyProfit = config.targets.dailyNetProfit || 300000;
    const dailyRequiredQty = basicNetProfit > 0 ? Math.ceil(targetDailyProfit / basicNetProfit) : 0;

    // 8. 수익상품 자동 분류 등급
    let candidateTier = 'EXCLUDE'; // 제외 후보
    let candidateTierName = '제외 후보';
    let candidateColor = 'red';

    if (basicNetProfit >= 20000) {
      candidateTier = 'PASS';
      candidateTierName = '판매 후보';
      candidateColor = 'green';
    } else if (basicNetProfit >= 10000) {
      candidateTier = 'REVIEW';
      candidateTierName = '검토 후보';
      candidateColor = 'yellow';
    }

    return {
      coupangPrice,
      wholesalePrice,
      wholesaleShippingFee,
      feeRate,
      coupangFee,
      actualShippingCost,
      shippingNote,
      totalCost,
      basicNetProfit,
      conservativeNetProfit,
      returnLoss,
      adSpend,
      marginRate: Number(marginRate.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      qty10Profit: basicNetProfit * 10,
      qty30Profit: basicNetProfit * 30,
      targetDailyProfit,
      dailyRequiredQty,
      candidateTier,
      candidateTierName,
      candidateColor,
      // 월 고정비 명시적 리포트 참조 (상품 마진 차감에서는 제외됨)
      monthlyOverheadNotice: `월 고정비 (쿠팡 서비스 이용료 등: ${config.monthlyOverhead.coupangServiceFee.toLocaleString()}원)는 건당 마진에서 미차감`
    };
  }
}
