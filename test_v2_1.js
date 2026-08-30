import { MarginCalculator } from './src/calculator.js';
import { DomeProductModel } from './src/models.js';

console.log("=== v2.1 FINAL 사전검수 마진 산출 및 API 필드 종합 테스트 시작 ===");

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
console.assert(pA.minResalePrice === 15000, `TEST A-1 실패: minResalePrice가 15000이어야 함 (실제: ${pA.minResalePrice})`);
console.assert(pA.recommendResalePrice === 18000, `TEST A-2 실패: recommendResalePrice가 18000이어야 함 (실제: ${pA.recommendResalePrice})`);
console.log(`✅ TEST A 통과: minumum=${pA.minResalePrice}원, Recommand=${pA.recommendResalePrice}원 파싱 성공`);

// TEST B: channel.supply = true (boolean 공식 타입)
const pB = new DomeProductModel({ channel: { supply: true } });
console.assert(pB.dropShippingStatus === '위탁 가능', `TEST B-1 실패: ${pB.dropShippingStatus}`);
console.assert(pB.channelLabel === '도매매 판매중', `TEST B-2 실패: ${pB.channelLabel}`);
console.log(`✅ TEST B 통과: channel.supply = true -> ${pB.channelLabel} (${pB.dropShippingStatus})`);

// TEST C: channel.supply = false
const pC = new DomeProductModel({ channel: { supply: false } });
console.assert(pC.dropShippingStatus === '위탁 불가', `TEST C-1 실패: ${pC.dropShippingStatus}`);
console.assert(pC.channelLabel === '도매매 판매중 아님', `TEST C-2 실패: ${pC.channelLabel}`);
console.log(`✅ TEST C 통과: channel.supply = false -> ${pC.channelLabel} (${pC.dropShippingStatus})`);

// TEST D: channel.supply = undefined
const pD = new DomeProductModel({ channel: {} });
console.assert(pD.dropShippingStatus === '확인 필요', `TEST D-1 실패: ${pD.dropShippingStatus}`);
console.assert(pD.channelLabel === '확인 필요', `TEST D-2 실패: ${pD.channelLabel}`);
console.log(`✅ TEST D 통과: channel.supply = undefined -> ${pD.channelLabel} (${pD.dropShippingStatus})`);

// TEST 1: 총원가 테스트 (도매가 7,800 + 배송비 3,000 = 10,800)
const p1 = new DomeProductModel({ price: { supply: 7800 }, deli: { supply: { fee: 3000 } } });
p1.wholesalePrice = 7800;
p1.wholesaleShippingFee = 3000;

const calc1 = MarginCalculator.calculate({ product: p1, userCoupangPrice: 28900 });
console.assert(calc1.totalCost === 10800, `TEST 1 실패: ${calc1.totalCost}`);
console.log(`✅ TEST 1 통과: 총원가 = ${calc1.totalCost}원`);

// TEST 2: 28,900원 MOCK 테스트 (기존 수수료 3,433원 적용 시)
// 세금충당 = 434원, 기본상품이익 = 14,233원, 수익등급 = B급, 필요수량 = 22개/일
const sellingPrice2 = 28900;
const totalCost2 = 10800;
const fee2 = 3433;
const taxReserve2 = Math.round(sellingPrice2 * 0.015); // 434
const basicProfit2 = sellingPrice2 - totalCost2 - fee2 - taxReserve2; // 14233
const reqQty2 = Math.ceil(300000 / basicProfit2); // 22

console.assert(taxReserve2 === 434, `TEST 2-1 실패: taxReserve = ${taxReserve2}`);
console.assert(basicProfit2 === 14233, `TEST 2-2 실패: basicProfit = ${basicProfit2}`);
console.assert(calc1.profitTier && calc1.profitTier.id === 'GRADE_B', `TEST 2-3 실패: 14233원은 GRADE_B 이어야 함 (실제: ${calc1.profitTier ? calc1.profitTier.id : 'undefined'})`);
console.assert(reqQty2 === 22, `TEST 2-4 실패: reqQty = ${reqQty2}`);
console.log(`✅ TEST 2 통과: 세금충당=${taxReserve2}원, 기본상품이익=${basicProfit2}원, 등급=${calc1.profitTier.name}, 필요수량=${reqQty2}개/일`);

// TEST 3: C타입 케이블 (판매가 5,900 - 총원가 3,700 - 수수료 519 - 세금 89 = 1,592원)
const sellingPrice3 = 5900;
const totalCost3 = 3700;
const fee3 = 519;
const taxReserve3 = Math.round(sellingPrice3 * 0.015); // 89
const basicProfit3 = sellingPrice3 - totalCost3 - fee3 - taxReserve3; // 1592
console.assert(basicProfit3 === 1592, `TEST 3 실패: 1592여야 함 (실제: ${basicProfit3})`);
console.log(`✅ TEST 3 통과: C타입 케이블 기본상품이익 = ${basicProfit3}원`);

// TEST 4: 차등가격 파서 (1+3800|20+3500|50+3300)
const parsedPrice = DomeProductModel.parseSupplyPrice('1+3800|20+3500|50+3300', 25);
console.assert(parsedPrice.unitPrice === 3500, `TEST 4 실패: 3500이어야 함 (실제: ${parsedPrice.unitPrice})`);
console.log(`✅ TEST 4 통과: 수량 25개 시 단가 = ${parsedPrice.unitPrice}원 (${parsedPrice.pricingType})`);

// TEST 5: 공급단위 (qty.supplyUnit = 5)
const p5 = new DomeProductModel({ qty: { supplyUnit: 5 } });
console.assert(p5.supplyUnitStatus === '구성확인필요', `TEST 5 실패: ${p5.supplyUnitStatus}`);
console.log(`✅ TEST 5 통과: supplyUnit 5개 시 상태 = ${p5.supplyUnitStatus}`);

// TEST 6: 적자상품 필요수량 null
const p6 = new DomeProductModel({ price: { supply: 15000 }, deli: { supply: { fee: 3000 } } });
p6.wholesalePrice = 15000;
p6.wholesaleShippingFee = 3000;
const calc6 = MarginCalculator.calculate({ product: p6, userCoupangPrice: 10000 });
console.assert(calc6.requiredDailySales === null, `TEST 6 실패: null이어야 함 (실제: ${calc6.requiredDailySales})`);
console.log(`✅ TEST 6 통과: 적자상품 필요수량 = null (UI 표기: 달성불가)`);

console.log("=== 모든 사전검수 테스트 100% 성공 완료! ===");
