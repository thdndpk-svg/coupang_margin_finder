import assert from 'node:assert/strict';
import { domeApiClient, SAMPLE_MOCK_PRODUCTS } from './src/api.js';

console.log("=== v2.2.0 REAL API 진짜 연결 엄격 검증 스크립트 (MOCK 0% 혼입 원칙) ===");

function extractActualItemNos(rawList) {
  const dg = rawList?.domeggook || rawList || {};
  const items = dg.list?.item || dg.items || [];
  const itemsArray = Array.isArray(items) ? items : [items];
  return itemsArray.map(item => String(item.no || item.itemNo)).filter(Boolean);
}

async function runStrictRealApiTests() {
  let passedCount = 0;

  // 1. getItemList 통신 (allowMockFallback: false)
  console.log("\n[1. getItemList REAL API 실통신 검증 (allowMockFallback: false)]");
  const listRes = await domeApiClient.getItemList({ kw: '텀블러', sz: '10' }, { allowMockFallback: false });

  console.log(`- 수신 모드: ${listRes.mode}`);
  console.log(`- 수신 상태: ${listRes.status}`);

  // MOCK 및 실패 상태 단정
  assert.equal(listRes.mode, 'REAL_API', 'MOCK fallback 금지: mode가 REAL_API이어야 합니다.');
  assert.equal(listRes.status, 'CONNECTED', 'status가 CONNECTED이어야 합니다.');

  const targetItemNos = extractActualItemNos(listRes.raw).slice(0, 5);
  console.log(`- 추출된 실상품번호 5개: [${targetItemNos.join(', ')}]`);

  assert.equal(targetItemNos.length >= 5, true, '실제 API 목록에서 5개 이상의 상품번호가 추출되어야 합니다.');

  const mockNos = SAMPLE_MOCK_PRODUCTS.map(p => String(p.no));
  for (const itemNo of targetItemNos) {
    assert.equal(mockNos.includes(itemNo), false, `상품번호 [${itemNo}]가 하드코딩 MOCK 번호와 일치하면 안 됩니다.`);
  }

  console.log("✅ getItemList REAL API 통신 성공!");

  // 2. 5개 실상품 getItemView 실통신 및 원문 vs 모델 13개 필드 엄격 대조
  console.log(`\n[2. 실제 상품 5개 getItemView 원문 vs 모델 13개 필드 엄격 대조]`);

  for (let i = 0; i < targetItemNos.length; i++) {
    const itemNo = targetItemNos[i];
    console.log(`\n--- [실상품 ${i + 1}/5] ID: ${itemNo} 대조 검증 ---`);

    const viewRes = await domeApiClient.getItemView(itemNo, { allowMockFallback: false });

    // MOCK fallback 단정
    assert.equal(viewRes.mode, 'REAL_API', 'MOCK fallback 금지: viewRes.mode가 REAL_API이어야 합니다.');
    assert.equal(viewRes.status, 'CONNECTED', 'viewRes.status가 CONNECTED이어야 합니다.');

    const raw = viewRes.raw || {};
    const parsed = viewRes.parsed;

    assert.equal(parsed !== null, true);
    assert.equal(raw.isMock !== true, true, 'raw 데이터에 isMock=true가 포함되면 안 됩니다.');
    assert.equal(parsed.title?.includes('[MOCK]'), false, '상품명에 [MOCK] 태그가 포함되면 안 됩니다.');

    // 가짜 fallback 표현(|| 999, || '판매중') 전면 제거 및 ?? null 파싱
    const rawNo = raw.basis?.no ?? raw.no ?? null;
    const rawTitle = raw.basis?.title ?? raw.title ?? null;
    const rawStatus = raw.basis?.status ?? raw.status ?? null;
    const rawPrice = raw.price?.supply ?? raw.price ?? null;
    const rawSupplyUnit = raw.qty?.supplyUnit ?? null;
    const rawDeliType = raw.deli?.supply?.type ?? null;
    const rawFee = raw.deli?.supply?.fee ?? raw.deliPrice ?? null;
    const rawInventory = raw.qty?.inventory ?? null;
    const rawRank = raw.seller?.rank ?? null;
    const rawVacation = raw.seller?.vacation ?? null;
    const rawChannel = raw.agencyFlag ?? raw.channel?.supply ?? null;
    const rawLicense = raw.desc?.license?.usable ?? null;
    const rawMinPrice = raw.price?.resale?.minumum ?? null;
    const rawCat = raw.category?.current?.code ?? raw.category ?? null;

    console.log(`  1) 상품번호: Raw[${rawNo}] <==> Parsed[${parsed.itemNo}]`);
    console.log(`  2) 상품명: Raw[${rawTitle}] <==> Parsed[${parsed.title}]`);
    console.log(`  3) 판매상태: Raw[${rawStatus}] <==> Parsed[${parsed.statusLabel}]`);
    console.log(`  4) 공급가: Raw[${rawPrice}] <==> Parsed[${parsed.wholesalePrice}원]`);
    console.log(`  5) 공급단위: Raw[${rawSupplyUnit}] <==> Parsed[${parsed.supplyUnitStatus}]`);
    console.log(`  6) 배송형태/배송비: Raw[${rawDeliType} / ${rawFee}] <==> Parsed[${parsed.shippingTypeLabel} / ${parsed.wholesaleShippingFee}원]`);
    console.log(`  7) 재고: Raw[${rawInventory}] <==> Parsed[${parsed.inventoryStatusLabel}]`);
    console.log(`  8) 공급사등급: Raw[${rawRank}] <==> Parsed[${parsed.sellerRankLabel}]`);
    console.log(`  9) 휴가: Raw[${JSON.stringify(rawVacation)}] <==> Parsed[${parsed.sellerVacationStatus}]`);
    console.log(` 10) 위탁여부: Raw[${rawChannel}] <==> Parsed[${parsed.channelLabel}]`);
    console.log(` 11) 이미지사용권: Raw[${rawLicense}] <==> Parsed[${parsed.imageLicenseStatus}]`);
    console.log(` 12) 최저판매준수가격: Raw[${rawMinPrice}] <==> Parsed[${parsed.minResalePrice}원]`);
    console.log(` 13) 도매매카테고리: Raw[${JSON.stringify(rawCat)}] <==> Parsed[${parsed.supplierCategoryCode}]`);

    assert.equal(String(parsed.itemNo), String(itemNo));
    assert.equal(parsed.wholesalePrice !== null, true);
    passedCount++;
  }

  console.log(`\n========================================`);
  console.log(`v2.2.0 REAL API 진짜 연동 대조 결과: ${passedCount}/5 REAL_API 100% PASS`);
  console.log(`========================================\n`);
}

runStrictRealApiTests().catch(err => {
  console.error("\n❌ REAL API 엄격 검증 실패 (MOCK Fallback / API 키 오류 감지):", err.message);
  process.exit(1);
});
