/**
 * STEP 2.1.3: 상품 안전성 및 리스크 검증기 (validators.js)
 * - null <= 0 이 true가 되는 자바스크립트 버그 완벽 방지
 * - APPROVED 라벨을 보수적인 '공급조건 1차검증 완료'로 변경
 */

export class ProductValidator {
  /**
   * @param {DomeProductModel} product
   * @returns {Object} { status, label, issues, isSafeToSell }
   */
  static evaluate(product) {
    const issues = [];
    let status = 'APPROVED'; // APPROVED, CONDITIONAL, PENDING, REJECTED

    if (!product) {
      return {
        status: 'PENDING',
        label: '데이터 확인필요',
        issues: ['상품 데이터가 존재하지 않습니다.'],
        isSafeToSell: false
      };
    }

    // 1. 판매 상태 점검 (null 일 경우 판매불가로 오판하지 않음)
    if (product.status === null) {
      issues.push('판매상태 확인필요');
      status = 'PENDING';
    } else if (product.status !== '판매중') {
      issues.push(`판매중지 상태 (${product.status})`);
      status = 'REJECTED';
    }

    // 2. 도매매 위탁배송 가능 여부
    if (product.dropShippingStatus === '확인 필요') {
      issues.push('위탁 가능여부 확인필요');
      if (status !== 'REJECTED') status = 'PENDING';
    } else if (!product.isDropShippingAvailable) {
      issues.push('도매매 위탁배송 불가 상품');
      status = 'REJECTED';
    }

    // 3. 재고 수량 점검 (null <= 0 버그 완벽 방지!)
    if (product.inventoryQty === null) {
      issues.push('재고 수량 확인필요');
      if (status !== 'REJECTED') status = 'PENDING';
    } else if (product.inventoryQty <= 0) {
      issues.push('품절 상태 (재고 0개)');
      status = 'REJECTED';
    } else if (product.inventoryQty < 10) {
      issues.push(`재고 소량 (${product.inventoryQty}개)`);
      if (status === 'APPROVED') status = 'CONDITIONAL';
    }

    // 4. 공급사 등급 점검
    if (product.sellerRank === null) {
      issues.push('공급사 등급 확인필요');
      if (status === 'APPROVED') status = 'CONDITIONAL';
    } else if (product.sellerRank > 5) {
      issues.push(`공급사 등급 저하 (${product.sellerRank}등급)`);
      if (status === 'APPROVED') status = 'CONDITIONAL';
    }

    // 5. 이미지 사용권
    if (product.imageLicenseStatus === '확인불가') {
      issues.push('이미지 사용권 확인필요');
      if (status === 'APPROVED') status = 'CONDITIONAL';
    } else if (product.imageLicenseStatus === '사용불가') {
      issues.push('이미지 사용권 없음');
      status = 'REJECTED';
    }

    // 6. 배송비 확인 여부
    if (product.wholesaleShippingFee === null) {
      issues.push('배송비 금액 미확인');
      if (status !== 'REJECTED') status = 'PENDING';
    }

    // 7. 공급단위 확인
    if (product.supplyUnitStatus === '공급단위확인필요') {
      issues.push('공급단위 확인필요');
      if (status === 'APPROVED') status = 'CONDITIONAL';
    } else if (product.supplyUnitStatus === '구성확인필요') {
      issues.push(`공급단위 ${product.supplyUnit}개 묶음 (구성확인필요)`);
      if (status === 'APPROVED') status = 'CONDITIONAL';
    }

    // 8. 최저판매준수가격 위반 확인
    if (product.minResaleViolation) {
      issues.push(`최저판매준수가격 위반 (${product.userCoupangPrice?.toLocaleString()}원 < 준수가 ${product.minResalePrice?.toLocaleString()}원)`);
      status = 'REJECTED';
    }

    let label = '공급조건 1차검증 완료';
    if (status === 'CONDITIONAL') label = '조건부 승인';
    else if (status === 'PENDING') label = '확인필요';
    else if (status === 'REJECTED') label = '판매비추천';

    return {
      status,
      label,
      issues,
      isSafeToSell: status === 'APPROVED' || status === 'CONDITIONAL'
    };
  }
}
