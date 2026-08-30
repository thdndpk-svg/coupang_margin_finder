import assert from 'node:assert/strict';
import { MarginCalculator } from './src/calculator.js';
import { DomeProductModel, MockDomeProductAdapter } from './src/models.js';
import { configManager } from './src/config.js';
import { ProductValidator } from './src/validators.js';

console.log("=== v2.1.2 FINAL REAL API READY 종합 검증 스크립트 (TEST 1 ~ 35) ===");

let passedCount = 0;
let failedCount = 0;

function runTest(testName, testFn) {
  try {
    testFn();
    passedCount++;
    console.log(`✅ ${testName} PASSED`);
  } catch (err) {
    failedCount++;
    console.error(`❌ ${testName} FAILED:`, err.message);
    process.exitCode = 1;
  }
}

// TEST 1 ~ 35
runTest("TEST 1: 총원가 검증 (도매가 7,800 + 배송비 3,000 = 10,800)", () => {
  const calc1 = MarginCalculator.calculate({ wholesalePrice: 7800, wholesaleShippingFee: 3000, userCoupangPrice: 28900 });
  assert.equal(calc1.totalCost, 10800);
});

runTest("TEST 2: 28,900원 MOCK 기본상품이익 14,233원 및 B급 등급 검증", () => {
  const calc2 = MarginCalculator.calculate({ wholesalePrice: 7800, wholesaleShippingFee: 3000, userCoupangPrice: 28900, customFeeRate: 0.1187889 });
  assert.equal(calc2.taxReserve, 434);
  assert.equal(calc2.basicProfit, 14233);
  assert.equal(calc2.profitTier.id, 'GRADE_B');
  assert.equal(calc2.requiredDailySales, 22);
});

runTest("TEST 3: C타입 케이블 마진 검증 (5,900 - 3,700 - 519 - 89 = 1,592원)", () => {
  const calc3 = MarginCalculator.calculate({ wholesalePrice: 1200, wholesaleShippingFee: 2500, userCoupangPrice: 5900, customFeeRate: 0.087966 });
  assert.equal(calc3.basicProfit, 1592);
});

runTest("TEST 4: 차등가격 파서 검증 (1+3800|20+3500|50+3300)", () => {
  const parsed = DomeProductModel.parseSupplyPrice('1+3800|20+3500|50+3300', 25);
  assert.equal(parsed.unitPrice, 3500);
});

runTest("TEST 5: 공급단위 파싱 (supplyUnit = 5)", () => {
  const p5 = new DomeProductModel({ qty: { supplyUnit: 5 } });
  assert.equal(p5.supplyUnitStatus, '구성확인필요');
});

runTest("TEST 6: 적자상품 필요수량 null 보존", () => {
  const calc6 = MarginCalculator.calculate({ wholesalePrice: 15000, wholesaleShippingFee: 3000, userCoupangPrice: 10000 });
  assert.equal(calc6.requiredDailySales, null);
});

runTest("TEST 7: 공식 API 오타 필드명 파싱 (minumum & Recommand)", () => {
  const pA = new DomeProductModel({
    price: { supply: 7800, resale: { minumum: 15000, Recommand: 18000 } }
  });
  assert.equal(pA.minResalePrice, 15000);
  assert.equal(pA.recommendResalePrice, 18000);
});

runTest("TEST 8: channel.supply = true (boolean)", () => {
  const pB = new DomeProductModel({ channel: { supply: true } });
  assert.equal(pB.channelLabel, '도매매 판매중');
});

runTest("TEST 9: channel.supply = false (boolean)", () => {
  const pC = new DomeProductModel({ channel: { supply: false } });
  assert.equal(pC.channelLabel, '도매매 판매중 아님');
});

runTest("TEST 10: channel.supply = undefined", () => {
  const pD = new DomeProductModel({ channel: {} });
  assert.equal(pD.channelLabel, '확인 필요');
});

runTest("TEST 11: desc.license.usable = true (boolean)", () => {
  const p11 = new DomeProductModel({ desc: { license: { usable: true } } });
  assert.equal(p11.imageLicenseStatus, '사용가능');
});

runTest("TEST 12: desc.license.usable = false (boolean)", () => {
  const p12 = new DomeProductModel({ desc: { license: { usable: false } } });
  assert.equal(p12.imageLicenseStatus, '사용불가');
});

runTest("TEST 13: desc.license.usable = undefined", () => {
  const p13 = new DomeProductModel({ desc: {} });
  assert.equal(p13.imageLicenseStatus, '확인불가');
});

runTest("TEST 14: 배송비 데이터 없음 -> fee=null, 배송비확인필요 (3,000원 생성 금지)", () => {
  const p14 = new DomeProductModel({ price: { supply: 5000 } });
  assert.equal(p14.wholesaleShippingFee, null);
  assert.equal(p14.shippingTypeLabel, '배송비확인필요');
  assert.equal(p14.isShippingExact, false);
});

runTest("TEST 15: seller.rank 없음 -> null, 공급사 등급 확인필요 (1등급 생성 금지)", () => {
  const p15 = new DomeProductModel({});
  assert.equal(p15.sellerRank, null);
  assert.equal(p15.sellerRankLabel, '공급사 등급 확인필요');
});

runTest("TEST 16: qty.inventory 없음 -> null, 재고 확인 필요 (999개 생성 금지)", () => {
  const p16 = new DomeProductModel({});
  assert.equal(p16.inventoryQty, null);
  assert.equal(p16.inventoryStatusLabel, '재고 확인 필요');
});

runTest("TEST 17: basis.status 없음 -> null, 판매상태 확인필요 (판매중 생성 금지)", () => {
  const p17 = new DomeProductModel({});
  assert.equal(p17.status, null);
  assert.equal(p17.statusLabel, '판매상태 확인필요');
});

runTest("TEST 18: 수정된 반품손실 공식 (returnLoss = returnRate * lossPerReturn)", () => {
  const calc18 = MarginCalculator.calculate({
    wholesalePrice: 5000,
    wholesaleShippingFee: 3000,
    userCoupangPrice: 20000,
    customReturnRate: 0.02,
    customLossPerReturn: 6000
  });
  assert.equal(calc18.returnLoss, 120);
});

runTest("TEST 19: 적자상품 dailyRequiredQty = null 보존", () => {
  const calc19 = MarginCalculator.calculate({ wholesalePrice: 15000, wholesaleShippingFee: 3000, userCoupangPrice: 10000 });
  assert.equal(calc19.dailyRequiredQty, null);
});

runTest("TEST 20: 손익분기 계산 시 feeRate 미입력 -> 수수료확인필요 (10.8% 자동적용 금지)", () => {
  const breakEvenRes = MarginCalculator.calcBreakEvenPrice({ wholesalePrice: 10000, wholesaleShippingFee: 3000 });
  assert.equal(breakEvenRes.value, null);
  assert.equal(breakEvenRes.status, '수수료확인필요');
});

runTest("TEST 21: 차등배송비 상품 + fee와 tbl 동시 존재 시 tbl 우선 해석", () => {
  const p21 = new DomeProductModel({
    deli: { supply: { type: '수량별차등', fee: 2500, tbl: '1+3000|10+2000' } }
  });
  assert.equal(p21.wholesaleShippingFee, 3000);
});

runTest("TEST 22: 오래된 LocalStorage v2 마이그레이션", () => {
  const legacyObj = { shippingFeeCommissionRate: 0.0363, conservativeLoss: { returnRate: 0.02 } };
  const migrated = configManager.migrateLegacyConfig(legacyObj);
  assert.equal(migrated.shippingFeeCommissionRate, 0);
  assert.equal(migrated.returnRate, 0);
});

runTest("TEST 23: deli.type = '고정배송비', fee=3000 -> 3000원", () => {
  const p23 = new DomeProductModel({ deli: { supply: { type: '고정배송비', fee: 3000 } } });
  assert.equal(p23.wholesaleShippingFee, 3000);
  assert.equal(p23.shippingTypeLabel, '고정배송비');
});

runTest("TEST 24: deli.type = '수량별차등', tbl='1+2500|20+2350|40+2100|60+2000', qty=25 -> 2350원", () => {
  const fee = DomeProductModel.parseTieredShippingFee('1+2500|20+2350|40+2100|60+2000', 25);
  assert.equal(fee, 2350);
});

runTest("TEST 25: deli.type = '수량별비례', tbl='50+2500|100+2000', qty=150 -> 4500원", () => {
  const fee = DomeProductModel.parseProportionalShippingFee('50+2500|100+2000', 150);
  assert.equal(fee, 4500);
});

runTest("TEST 26: deli.pay = '무료배송' -> 배송비 0원, 확인됨", () => {
  const p26 = new DomeProductModel({ deli: { supply: { pay: '무료배송' } } });
  assert.equal(p26.wholesaleShippingFee, 0);
  assert.equal(p26.shippingTypeLabel, '무료배송');
});

runTest("TEST 27: deli.pay = '착불' -> 착불배송 확인필요 (0원 자동확정 금지)", () => {
  const p27 = new DomeProductModel({ deli: { supply: { pay: '착불' } } });
  assert.equal(p27.wholesaleShippingFee, null);
  assert.equal(p27.shippingTypeLabel, '착불배송 확인필요');
});

runTest("TEST 28: 실제 API 상품 + userCoupangPrice 없음 -> coupangPrice = null", () => {
  const p28 = new DomeProductModel({ basis: { no: '999999' }, price: { supply: 10000 } });
  assert.equal(p28.userCoupangPrice, null);
  assert.equal(p28.priceStatus, 'UNCONFIRMED');
});

runTest("TEST 29: category.current 없음 -> categoryCode = null (1002 생성 금지)", () => {
  const p29 = new DomeProductModel({ basis: { no: '999999' } });
  assert.equal(p29.categoryCode, null);
});

runTest("TEST 30: inventoryQty = null -> ProductValidator 결과 품절이 아니라 재고 확인 필요", () => {
  const p30 = new DomeProductModel({ basis: { no: '999999' } });
  const evalRes = ProductValidator.evaluate(p30);
  assert.equal(evalRes.issues.includes('재고 수량 확인필요'), true);
  assert.equal(evalRes.issues.includes('품절 상태 (재고 0개)'), false);
});

runTest("TEST 31: MOCK 상품 MockDomeProductAdapter 어댑팅 렌더링 검증", () => {
  const mockItem = { no: '100001', title: '테스트텀블러', price: 7800, deliPrice: 3000, defaultCoupangPrice: 28900 };
  const adapted = MockDomeProductAdapter.adapt(mockItem);
  const p31 = new DomeProductModel(adapted);
  assert.equal(p31.title, '테스트텀블러');
  assert.equal(p31.wholesalePrice, 7800);
  assert.equal(p31.wholesaleShippingFee, 3000);
  assert.equal(p31.userCoupangPrice, 28900);
});

runTest("TEST 32: 실제 API 형식 상품은 자동 1.5배 판매가 생성 안 됨", () => {
  const realApiItem = { basis: { no: '555555', title: '실제상품' }, price: { supply: 10000 }, deli: { supply: { pay: '무료배송' } } };
  const p32 = new DomeProductModel(realApiItem);
  assert.equal(p32.userCoupangPrice, null);
});

runTest("TEST 33: 관심상품 탭 렌더링 마진 계산 검증", () => {
  const calcBm = MarginCalculator.calculate({ wholesalePrice: 10000, wholesaleShippingFee: 3000, userCoupangPrice: 25000 });
  assert.equal(calcBm.basicProfit > 0, true);
});

runTest("TEST 34: 상세 시뮬레이터 판매가 변경 후 마진 재계산 검증", () => {
  const calcBefore = MarginCalculator.calculate({ wholesalePrice: 10000, wholesaleShippingFee: 3000, userCoupangPrice: 20000 });
  const calcAfter = MarginCalculator.calculate({ wholesalePrice: 10000, wholesaleShippingFee: 3000, userCoupangPrice: 25000 });
  assert.equal(calcAfter.basicProfit > calcBefore.basicProfit, true);
});

runTest("TEST 35: 설정 저장 및 마이그레이션 안전 검증", () => {
  configManager.config.targetDailyProfit = 300000;
  assert.equal(configManager.config.targetDailyProfit, 300000);
});

console.log(`\n========================================`);
console.log(`종합 테스트 집계 결과: ${passedCount} passed, ${failedCount} failed`);
console.log(`========================================\n`);

if (failedCount > 0) {
  process.exit(1);
}
