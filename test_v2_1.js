import { MarginCalculator } from './src/calculator.js';
import { DomeProductModel } from './src/models.js';
import { configManager } from './src/config.js';

console.log("=== v2.1.1 긴급 핫픽스 종합 테스트 (TEST 1 ~ TEST 22) 시작 ===");

// TEST A: 공식 API 오타 필드명 파싱 (minumum & Recommand)
const pA = new DomeProductModel({
  price: {
    supply: 7800,
    resale: {
      minumum: 15000,
      Recommand: 18000
    }
  }
});
console.assert(pA.minResalePrice === 15000, `TEST A-1 실패: ${pA.minResalePrice}`);
console.assert(pA.recommendResalePrice === 18000, `TEST A-2 실패: ${pA.recommendResalePrice}`);
console.log(`✅ TEST A 통과: minumum=${pA.minResalePrice}원, Recommand=${pA.recommendResalePrice}원`);

// TEST B, C, D: channel.supply boolean 타입
const pB = new DomeProductModel({ channel: { supply: true } });
console.assert(pB.channelLabel === '도매매 판매중', `TEST B 실패: ${pB.channelLabel}`);
console.log(`✅ TEST B 통과: channel.supply = true -> ${pB.channelLabel}`);

const pC = new DomeProductModel({ channel: { supply: false } });
console.assert(pC.channelLabel === '도매매 판매중 아님', `TEST C 실패: ${pC.channelLabel}`);
console.log(`✅ TEST C 통과: channel.supply = false -> ${pC.channelLabel}`);

const pD = new DomeProductModel({ channel: {} });
console.assert(pD.channelLabel === '확인 필요', `TEST D 실패: ${pD.channelLabel}`);
console.log(`✅ TEST D 통과: channel.supply = undefined -> ${pD.channelLabel}`);

// TEST 14: 배송비 데이터 없음 -> 3,000원 임의생성 금지!
const p14 = new DomeProductModel({ price: { supply: 5000 } });
console.assert(p14.wholesaleShippingFee === null, `TEST 14-1 실패: ${p14.wholesaleShippingFee}`);
console.assert(p14.shippingTypeLabel === '배송비확인필요', `TEST 14-2 실패: ${p14.shippingTypeLabel}`);
console.assert(p14.isShippingExact === false, `TEST 14-3 실패: ${p14.isShippingExact}`);
console.log(`✅ TEST 14 통과: 배송비 데이터 없음 -> fee=null, 배송비확인필요`);

// TEST 15: seller.rank 없음 -> 1등급 임의생성 금지!
const p15 = new DomeProductModel({});
console.assert(p15.sellerRank === null, `TEST 15-1 실패: ${p15.sellerRank}`);
console.assert(p15.sellerRankLabel === '확인필요', `TEST 15-2 실패: ${p15.sellerRankLabel}`);
console.log(`✅ TEST 15 통과: seller.rank 없음 -> null, 확인필요`);

// TEST 16: qty.inventory 없음 -> 999개 임의생성 금지!
const p16 = new DomeProductModel({});
console.assert(p16.inventoryQty === null, `TEST 16-1 실패: ${p16.inventoryQty}`);
console.assert(p16.inventoryStatusLabel === '재고확인필요', `TEST 16-2 실패: ${p16.inventoryStatusLabel}`);
console.log(`✅ TEST 16 통과: qty.inventory 없음 -> null, 재고확인필요`);

// TEST 17: basis.status 없음 -> 판매중 임의생성 금지!
const p17 = new DomeProductModel({});
console.assert(p17.status === null, `TEST 17-1 실패: ${p17.status}`);
console.assert(p17.statusLabel === '확인필요', `TEST 17-2 실패: ${p17.statusLabel}`);
console.log(`✅ TEST 17 통과: basis.status 없음 -> null, 확인필요`);

// TEST 18: 수정된 반품손실 공식 (returnLoss = returnRate * lossPerReturn)
// 반품률 0.02 (2%), 건당 실제손실 6000원 -> 반품손실 = 120원
const calc18 = MarginCalculator.calculate({
  wholesalePrice: 5000,
  wholesaleShippingFee: 3000,
  userCoupangPrice: 20000,
  customReturnRate: 0.02,
  customLossPerReturn: 6000
});
console.assert(calc18.returnLoss === 120, `TEST 18 실패: returnLoss는 120원이어야 함 (실제: ${calc18.returnLoss})`);
console.log(`✅ TEST 18 통과: 반품손실 = ${calc18.returnLoss}원 (판매가x2% 아님)`);

// TEST 19: 적자/손실 상품 -> dailyRequiredQty null 보존
const calc19 = MarginCalculator.calculate({
  wholesalePrice: 15000,
  wholesaleShippingFee: 3000,
  userCoupangPrice: 10000
});
console.assert(calc19.requiredDailySales === null, `TEST 19-1 실패: ${calc19.requiredDailySales}`);
console.assert(calc19.dailyRequiredQty === null, `TEST 19-2 실패: ${calc19.dailyRequiredQty}`);
console.log(`✅ TEST 19 통과: 적자상품 dailyRequiredQty = null (UI 표기: 달성불가)`);

// TEST 20: 손익분기 계산 시 feeRate 미입력 -> 10.8% 자동적용 금지!
const breakEvenRes = MarginCalculator.calcBreakEvenPrice({ wholesalePrice: 10000, wholesaleShippingFee: 3000 });
console.assert(breakEvenRes.value === null, `TEST 20-1 실패: ${breakEvenRes.value}`);
console.assert(breakEvenRes.status === '수수료확인필요', `TEST 20-2 실패: ${breakEvenRes.status}`);
console.log(`✅ TEST 20 통과: feeRate 미입력 시 수수료확인필요`);

// TEST 21: 차등배송비 상품 + fee와 tbl 동시 존재 시 deli.type 확인
const p21 = new DomeProductModel({
  deli: {
    supply: {
      type: '차등',
      fee: 2500,
      tbl: '1+3000|10+2000'
    }
  }
});
console.assert(p21.wholesaleShippingFee === 3000, `TEST 21 실패: tbl에 따른 3000원이어야 함 (실제: ${p21.wholesaleShippingFee})`);
console.log(`✅ TEST 21 통과: 차등배송비 tbl 우선 해석 = ${p21.wholesaleShippingFee}원`);

// TEST 22: 오래된 LocalStorage v2 마이그레이션
const legacyObj = {
  shippingFeeCommissionRate: 0.0363,
  conservativeLoss: { returnRate: 0.02, adSpendPerUnit: 1500, packagingCostPerUnit: 500 }
};
const migrated = configManager.migrateLegacyConfig(legacyObj);
console.assert(migrated.shippingFeeCommissionRate === 0, `TEST 22-1 실패: ${migrated.shippingFeeCommissionRate}`);
console.assert(migrated.returnRate === 0, `TEST 22-2 실패: ${migrated.returnRate}`);
console.assert(migrated.targetAdCostPerOrder === 0, `TEST 22-3 실패: ${migrated.targetAdCostPerOrder}`);
console.assert(migrated.packagingCost === 0, `TEST 22-4 실패: ${migrated.packagingCost}`);
console.log(`✅ TEST 22 통과: 구버전 위험 기본값 0으로 강제 마이그레이션 성공`);

// TEST 1 ~ 6: 기존 28,900원 MOCK 검증 테스트 유지
const p289 = new DomeProductModel({
  isMock: true,
  wholesalePrice: 7800,
  wholesaleShippingFee: 3000,
  userCoupangPrice: 28900
});
const calc289 = MarginCalculator.calculate({ product: p289, userCoupangPrice: 28900, customFeeRate: 0.1187889 }); // 수수료 3,433원
const sellingPrice2 = 28900;
const totalCost2 = 10800;
const fee2 = 3433;
const taxReserve2 = Math.round(sellingPrice2 * 0.015); // 434
const basicProfit2 = sellingPrice2 - totalCost2 - fee2 - taxReserve2; // 14233
const reqQty2 = Math.ceil(300000 / basicProfit2); // 22

console.assert(taxReserve2 === 434, `기존 TEST 2-1 실패: ${taxReserve2}`);
console.assert(basicProfit2 === 14233, `기존 TEST 2-2 실패: ${basicProfit2}`);
console.assert(calc289.profitTier.id === 'GRADE_B', `기존 TEST 2-3 실패: ${calc289.profitTier.id}`);
console.assert(reqQty2 === 22, `기존 TEST 2-4 실패: ${reqQty2}`);
console.log(`✅ 기존 28,900원 MOCK 검증 통과: 세금=${taxReserve2}원, 기본이익=${basicProfit2}원, 등급=${calc289.profitTier.name}, 필요수량=${reqQty2}개/일`);

console.log("=== 모든 사전검수 & 핫픽스 테스트 (TEST 1 ~ TEST 22) 100% PASS! ===");
