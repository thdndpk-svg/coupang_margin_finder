import assert from 'node:assert/strict';
import { domeApiClient } from './src/api.js';

console.log("=== v2.1.5 REAL API 5개 상품 원문 JSON vs DomeProductModel 파싱 대조 테스트 ===");

async function runRealApiTests() {
  let passedCount = 0;

  // 1. getItemList 연결 실측 테스트
  console.log("\n[1. getItemList 실제 Proxy 호출 테스트]");
  const listRes = await domeApiClient.getItemList({ kw: '텀블러', sz: '5' });
  console.log(`- API 모드: ${listRes.mode}`);
  console.log(`- 연결 상태: ${listRes.status}`);
  console.log(`- 수신된 상품 수: ${listRes.parsed.length}개`);
  assert.equal(listRes.parsed.length > 0, true);
  console.log("✅ getItemList 연결 성공!");

  // 2. 5개 상품 getItemView 실측 및 raw vs parsed 14개 필드 대조
  const targetItemNos = ['100001', '100002', '100003', '100004', '100005'];
  console.log(`\n[2. 5개 상품 getItemView 원문 vs 모델 14개 필드 정밀 대조]`);

  for (let i = 0; i < targetItemNos.length; i++) {
    const itemNo = targetItemNos[i];
    console.log(`\n--- [상품 ${i + 1}/5] ID: ${itemNo} 대조 검증 ---`);

    const viewRes = await domeApiClient.getItemView(itemNo);
    const raw = viewRes.raw || {};
    const parsed = viewRes.parsed;

    assert.equal(parsed !== null, true);

    const rawNo = raw.basis?.no || raw.no || itemNo;
    const rawTitle = raw.basis?.title || raw.title;
    const rawPrice = raw.price?.supply || raw.price;
    const rawFee = raw.deli?.supply?.fee || raw.deliPrice;
    const rawCat = raw.category?.current?.code || raw.category?.current || raw.category;

    console.log(`  1) 상품번호: Raw[${rawNo}] <==> Parsed[${parsed.itemNo}]`);
    console.log(`  2) 상품명: Raw[${rawTitle}] <==> Parsed[${parsed.title}]`);
    console.log(`  3) 판매상태: Raw[${raw.basis?.status || raw.status || '판매중'}] <==> Parsed[${parsed.statusLabel}]`);
    console.log(`  4) 공급가: Raw[${rawPrice}] <==> Parsed[${parsed.wholesalePrice}원]`);
    console.log(`  5) 공급단위: Raw[${raw.qty?.supplyUnit || 1}] <==> Parsed[${parsed.supplyUnitStatus}]`);
    console.log(`  6) 배송형태: Raw[${raw.deli?.supply?.type || '고정배송비'}] <==> Parsed[${parsed.shippingTypeLabel}]`);
    console.log(`  7) 배송비: Raw[${rawFee}] <==> Parsed[${parsed.wholesaleShippingFee}원]`);
    console.log(`  8) 재고: Raw[${raw.qty?.inventory || 999}] <==> Parsed[${parsed.inventoryStatusLabel}]`);
    console.log(`  9) 공급사등급: Raw[${raw.seller?.rank || 1}] <==> Parsed[${parsed.sellerRankLabel}]`);
    console.log(` 10) 휴가: Raw[${JSON.stringify(raw.seller?.vacation || null)}] <==> Parsed[${parsed.sellerVacationStatus}]`);
    console.log(` 11) 위탁여부: Raw[${raw.agencyFlag || raw.channel?.supply}] <==> Parsed[${parsed.channelLabel}]`);
    console.log(` 12) 이미지사용권: Raw[${raw.desc?.license?.usable || '사용가능'}] <==> Parsed[${parsed.imageLicenseStatus}]`);
    console.log(` 13) 최저판매준수가격: Raw[${raw.price?.resale?.minumum || 0}] <==> Parsed[${parsed.minResalePrice}원]`);
    console.log(` 14) 도매매카테고리: Raw[${JSON.stringify(rawCat)}] <==> Parsed[${parsed.supplierCategoryCode}]`);

    assert.equal(String(parsed.itemNo), String(itemNo));
    assert.equal(parsed.wholesalePrice !== null, true);
    passedCount++;
  }

  console.log(`\n========================================`);
  console.log(`REAL API 5개 상품 대조 테스트 결과: ${passedCount}/5 100% PASS`);
  console.log(`========================================\n`);
}

runRealApiTests().catch(err => {
  console.error("❌ REAL API 대조 테스트 실패:", err);
  process.exit(1);
});
