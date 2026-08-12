import { SAMPLE_MOCK_PRODUCTS } from './src/api.js';
import { MarginCalculator } from './src/calculator.js';
import { configManager } from './src/config.js';

console.log('=== [새 독립 프로젝트 STEP 2 재검증] ===');
console.log(`1. 프로젝트 위치: /Users/mac/coupang_margin_finder`);
console.log(`2. MOCK 상품 개수: ${SAMPLE_MOCK_PRODUCTS.length}개 (15개)`);

const sampleItem = SAMPLE_MOCK_PRODUCTS[0];
const calcResult = MarginCalculator.calculate({
  coupangPrice: sampleItem.defaultCoupangPrice,
  wholesalePrice: sampleItem.price,
  wholesaleShippingFee: sampleItem.deliPrice,
  categoryCode: sampleItem.category,
  shippingType: 'DROP_SHIPPING_FREE'
});

console.log('3. 마진 엔진 산출 결과:');
console.log(`   - 상품명: ${sampleItem.title}`);
console.log(`   - 기본 순이익: ${calcResult.basicNetProfit.toLocaleString()}원`);
console.log(`   - 보수적 순이익: ${calcResult.conservativeNetProfit.toLocaleString()}원`);
console.log(`   - 마진율 / ROI: ${calcResult.marginRate}% / ${calcResult.roi}%`);
console.log(`   - 등급: ${calcResult.candidateTierName} (${calcResult.candidateTier})`);

console.log('=== [독립 프로젝트 재검증 성공 완료] ===');
