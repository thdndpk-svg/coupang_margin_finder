/**
 * STEP 2.1: 앱 전역 상수 및 설정 기본값 (constants.js)
 * 대량등록과 분리된 하루 30만원 순수익 상품발굴 전용 상수
 */

export const TAX_RESERVE_RATE_DEFAULT = 0.015; // 간이과세 세금충당율 기본값 (1.5%)

export const STATUS_LABELS = {
  CONFIRMED: '확인됨',
  UNCONFIRMED: '미확인',
  UNREFLECTED: '미반영',
  USER_INPUT: '사용자 입력',
  TEMPORARY_ASSUMPTION: '임시 가정'
};

// 카테고리별 수수료 명세 구조 (vatIncluded 명시 & 수수료 상태)
export const DEFAULT_CATEGORY_FEES = {
  '1001': { categoryName: '가전/디지털', feeRate: 0.08, vatIncluded: false, status: 'temporary', verifiedAt: '2026-08', source: '쿠팡 WING 가이드' },
  '1002': { categoryName: '생활/주방용품', feeRate: 0.108, vatIncluded: false, status: 'temporary', verifiedAt: '2026-08', source: '쿠팡 WING 가이드' },
  '1003': { categoryName: '뷰티/화장품', feeRate: 0.105, vatIncluded: false, status: 'temporary', verifiedAt: '2026-08', source: '쿠팡 WING 가이드' },
  '1004': { categoryName: '패션/의류', feeRate: 0.115, vatIncluded: false, status: 'temporary', verifiedAt: '2026-08', source: '쿠팡 WING 가이드' },
  '1005': { categoryName: '식품', feeRate: 0.11, vatIncluded: false, status: 'temporary', verifiedAt: '2026-08', source: '쿠팡 WING 가이드' },
  '1006': { categoryName: '스포츠/레저', feeRate: 0.108, vatIncluded: false, status: 'temporary', verifiedAt: '2026-08', source: '쿠팡 WING 가이드' },
  '1007': { categoryName: '반려동물용품', feeRate: 0.108, vatIncluded: false, status: 'temporary', verifiedAt: '2026-08', source: '쿠팡 WING 가이드' },
  'default': { categoryName: '기타/미확정 카테고리', feeRate: 0.108, vatIncluded: false, status: 'temporary', verifiedAt: '2026-08', source: '임시 가정' }
};

// 수익성 등급 (Profitability Tier)
export const PROFIT_TIERS = {
  GRADE_A: { id: 'GRADE_A', name: 'A급 수익상품', minProfit: 20000, color: 'green', code: 'A' },
  GRADE_B: { id: 'GRADE_B', name: 'B급 수익상품', minProfit: 10000, color: 'yellow', code: 'B' },
  GRADE_C: { id: 'GRADE_C', name: 'C급 수익상품', minProfit: 0, color: 'blue', code: 'C' },
  DEFICIT: { id: 'DEFICIT', name: '적자상품', minProfit: -Infinity, color: 'red', code: 'D' }
};

// 판매검증 상태 (Verification Status)
export const VERIFICATION_STATUS = {
  UNCHECKED: { id: 'UNCHECKED', name: '검증전', color: 'gray' },
  PASSED: { id: 'PASSED', name: '판매가능', color: 'green' },
  CONDITIONAL: { id: 'CONDITIONAL', name: '조건부', color: 'yellow' },
  PENDING: { id: 'PENDING', name: '보류', color: 'orange' },
  NOT_RECOMMENDED: { id: 'NOT_RECOMMENDED', name: '판매비추천', color: 'red' }
};

export const DISCLAIMER_TEXT = '본 계산 결과는 입력된 원가·판매가·수수료·세금충당 및 사용자가 입력한 비용을 기준으로 한 상품별 시뮬레이션입니다. 실제 판매량이나 수익을 보장하지 않습니다.';
