/**
 * STEP 2.1: 소싱 안전성 및 판매검증 상태 판단 유틸리티 (validators.js)
 */

import { VERIFICATION_STATUS } from './constants.js';

export class ProductValidator {
  /**
   * 도매상품의 안전성 요소들을 검증하여 종합 판매검증 상태 반환
   * @param {Object} product - DomeProductModel 객체
   */
  static evaluate(product) {
    const issues = [];
    let status = VERIFICATION_STATUS.PASSED;

    // 1. 판매중 여부
    if (product.status !== '판매중') {
      issues.push(`판매 상태 이상 (${product.status})`);
      status = VERIFICATION_STATUS.NOT_RECOMMENDED;
    }

    // 2. 위탁판매 가능 여부
    if (product.dropShippingStatus === '위탁 불가') {
      issues.push('위탁판매 불가 상품');
      status = VERIFICATION_STATUS.NOT_RECOMMENDED;
    } else if (product.dropShippingStatus === '확인 필요') {
      issues.push('위탁판매 여부 확인 필요');
      if (status !== VERIFICATION_STATUS.NOT_RECOMMENDED) {
        status = VERIFICATION_STATUS.CONDITIONAL;
      }
    }

    // 3. 이미지 사용권
    if (product.imageLicenseStatus === '사용불가') {
      issues.push('이미지 사용 불가');
      status = VERIFICATION_STATUS.NOT_RECOMMENDED; // 자동 승인 금지
    } else if (product.imageLicenseStatus === '확인불가') {
      issues.push('이미지 사용권 확인 필요');
      if (status !== VERIFICATION_STATUS.NOT_RECOMMENDED) {
        status = VERIFICATION_STATUS.CONDITIONAL;
      }
    }

    // 4. 공급사 등급 (1~4등급 우선 검토, 5~9등급 위험/보류)
    if (product.sellerRank > 4) {
      issues.push(`공급사 등급 주의 (${product.sellerRank}등급)`);
      if (status === VERIFICATION_STATUS.PASSED) {
        status = VERIFICATION_STATUS.CONDITIONAL;
      }
    }

    // 5. 재고 수량
    if (product.inventoryQty <= 0) {
      issues.push('품절 (재고 0)');
      status = VERIFICATION_STATUS.PENDING;
    }

    return {
      status,
      statusName: status.name,
      color: status.color,
      issues,
      isPassed: status.id === 'PASSED'
    };
  }
}
