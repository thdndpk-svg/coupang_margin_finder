/**
 * STEP 2.1.1: 시스템 상수 및 상태 레이블 정의 (constants.js)
 */

// 간이과세 세금충당 기본 비율 (1.5%)
export const DEFAULT_TAX_RATE = 0.015;

// 하루 순수익 목표 기본값 (300,000원)
export const DEFAULT_TARGET_DAILY_PROFIT = 300000;

// 수수료 및 설정 상태
export const FEE_STATUS = {
  UNCONFIRMED: { id: 'UNCONFIRMED', name: '수수료 미확인', label: '확인필요' },
  TEMPORARY_ASSUMPTION: { id: 'TEMPORARY_ASSUMPTION', name: '임시 가정 수수료', label: '임시 가정' },
  CONFIRMED: { id: 'CONFIRMED', name: '확인된 공식 수수료', label: '공식 수수료' }
};

// 수익성 등급 임계값 (원)
export const DEFAULT_TIER_THRESHOLDS = {
  GRADE_A: 20000, // 2만원 이상 (A급)
  GRADE_B: 10000  // 1만원 이상 ~ 2만원 미만 (B급)
};

// 수익 등급 정보
export const PROFIT_TIERS = {
  GRADE_A: { id: 'GRADE_A', name: 'A급 수익상품', minProfit: 20000, badgeClass: 'badge-pass' },
  GRADE_B: { id: 'GRADE_B', name: 'B급 수익상품', minProfit: 10000, badgeClass: 'badge-review' },
  GRADE_C: { id: 'GRADE_C', name: 'C급 수익상품', minProfit: 0, badgeClass: 'badge-c' },
  DEFICIT: { id: 'DEFICIT', name: '적자/손실', minProfit: -Infinity, badgeClass: 'badge-exclude' }
};

// 손익 및 검증 상태
export const VERIFICATION_STATUS = {
  PASS: { id: 'PASS', name: '판매 후보 (A급)', color: 'green' },
  REVIEW: { id: 'REVIEW', name: '검토 후보 (B급)', color: 'yellow' },
  EXCLUDE: { id: 'EXCLUDE', name: '제외 후보 (C급/적자)', color: 'red' }
};

// 면책 조항
export const DISCLAIMER_TEXT = '🛡️ 본 계산 결과는 입력된 원가·판매가·수수료·세금충당 및 사용자가 입력한 비용을 기준으로 한 상품별 시뮬레이션입니다. 실제 판매량이나 수익을 보장하지 않습니다.';
