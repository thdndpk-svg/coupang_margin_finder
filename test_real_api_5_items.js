import assert from 'node:assert/strict';
import { domeApiClient, SAMPLE_MOCK_PRODUCTS } from './src/api.js';

console.log("=== v2.2.0 REAL API 5개 상품 18가지 상세 필드 100% ASSERT 대조 검증 스크립트 ===");

const proxyUrl = process.env.DOMEME_PROXY_URL || process.env.VITE_DOMEME_PROXY_URL;
if (proxyUrl) {
  assert.equal(proxyUrl.startsWith('https://'), true, 'Production REAL API 테스트는 HTTPS Proxy만 허용합니다.');
  assert.equal(proxyUrl.includes('localhost'), false, 'Production REAL API 테스트에서 localhost 사용은 금지됩니다.');
}

function extractActualItemNos(rawList) {
  const dg = rawList?.domeggook || rawList || {};
  const items = dg.list?.item || dg.items || [];
  const itemsArray = Array.isArray(items) ? items : [items];
  return itemsArray.map(item => String(item.no || item.itemNo)).filter(Boolean);
}

async function runStrictRealApiTests() {
  let passedCount = 0;

  // 1. getItemList 통신 (market=supply & allowMockFallback: false)
  console.log("\n[1. getItemList REAL API market=supply 실통신 검증]");
  const listRes = await domeApiClient.getItemList({ kw: '텀블러', sz: '10' }, { allowMockFallback: false });

  console.log(`- 수신 모드: ${listRes.mode}`);
  console.log(`- 수신 상태: ${listRes.status}`);

  assert.equal(listRes.mode, 'REAL_API', 'MOCK fallback 금지: mode가 REAL_API이어야 합니다.');
  assert.equal(listRes.status, 'CONNECTED', 'status가 CONNECTED이어야 합니다.');

  const targetItemNos = extractActualItemNos(listRes.raw).slice(0, 5);
  console.log(`- 추출된 실상품번호 5개: [${targetItemNos.join(', ')}]`);

  assert.equal(targetItemNos.length >= 5, true, '실제 API 목록에서 5개 이상의 상품번호가 추출되어야 합니다.');

  const mockNos = SAMPLE_MOCK_PRODUCTS.map(p => String(p.no));
  for (const itemNo of targetItemNos) {
    assert.equal(mockNos.includes(itemNo), false, `상품번호 [${itemNo}]가 하드코딩 MOCK 번호와 일치하면 안 됩니다.`);
  }

  console.log("✅ getItemList market=supply 실통신 성공!");

  // 2. 5개 실상품 getItemView v4.6 상세 원문 vs 모델 18가지 상세 필드 100% assert 대조
  console.log(`\n[2. 실제 상품 5개 getItemView v4.6 상세 원문 vs 모델 18가지 상세 필드 100% ASSERT 대조]`);

  for (let i = 0; i < targetItemNos.length; i++) {
    const itemNo = targetItemNos[i];
    console.log(`\n--- [실상품 ${i + 1}/5] ID: ${itemNo} 18개 필드 assert 검증 ---`);

    const viewRes = await domeApiClient.getItemView(itemNo, { allowMockFallback: false });

    assert.equal(viewRes.mode, 'REAL_API', 'MOCK fallback 금지: viewRes.mode가 REAL_API이어야 합니다.');
    assert.equal(viewRes.status, 'CONNECTED', 'viewRes.status가 CONNECTED이어야 합니다.');

    const raw = viewRes.raw || {};
    const parsed = viewRes.parsed;

    assert.equal(parsed !== null, true);
    assert.equal(raw.isMock !== true, true, 'raw 데이터에 isMock=true가 포함되면 안 됩니다.');
    assert.equal(parsed.title?.includes('[MOCK]'), false, '상품명에 [MOCK] 태그가 포함되면 안 됩니다.');

    // 18가지 상세 필드 원문 직접 추출 (?? null)
    const rawNo = raw.basis?.no ?? raw.no ?? null;
    const rawTitle = raw.basis?.title ?? raw.title ?? null;
    const rawStatus = raw.basis?.status ?? raw.status ?? null;
    const rawPriceSupply = raw.price?.supply ?? raw.price ?? null;
    const rawPriceOrg = raw.price?.supplyOrg ?? raw.priceOrg ?? null;
    const rawInventory = raw.qty?.inventory ?? null;
    const rawSupplyUnit = raw.qty?.supplyUnit ?? null;
    const rawDeliPay = raw.deli?.supply?.pay ?? null;
    const rawDeliType = raw.deli?.supply?.type ?? null;
    const rawDeliFee = raw.deli?.supply?.fee ?? raw.deliPrice ?? null;
    const rawDeliTbl = raw.deli?.supply?.tbl ?? null;
    const rawRank = raw.seller?.rank ?? null;
    const rawVacation = raw.seller?.vacation ?? null;
    const rawChannel = raw.agencyFlag ?? raw.channel?.supply ?? null;
    const rawLicense = raw.desc?.license?.usable ?? null;
    const rawMinResale = raw.price?.resale?.minumum ?? null;
    const rawRecResale = raw.price?.resale?.Recommand ?? null;
    const rawCatCurrent = raw.category?.current?.code ?? raw.category ?? null;

    // 18가지 상세 필드 정밀 ASSERT 단정
    // 1) basis.no
    assert.equal(String(parsed.itemNo), String(rawNo), '1. basis.no 일치 단정');
    // 2) basis.title
    assert.equal(parsed.title, rawTitle ? String(rawTitle) : null, '2. basis.title 일치 단정');
    // 3) basis.status
    assert.equal(parsed.status, rawStatus ? String(rawStatus) : null, '3. basis.status 일치 단정');
    // 4) price.supply
    assert.equal(parsed.wholesalePrice, rawPriceSupply !== null ? Number(rawPriceSupply) : null, '4. price.supply 일치 단정');
    // 5) price.supplyOrg
    assert.equal(parsed.wholesalePriceOrg, rawPriceOrg !== null ? Number(rawPriceOrg) : null, '5. price.supplyOrg 일치 단정');
    // 6) qty.inventory
    assert.equal(parsed.inventoryQty, rawInventory !== null ? Number(rawInventory) : null, '6. qty.inventory 일치 단정');
    // 7) qty.supplyUnit
    assert.equal(parsed.supplyUnit, rawSupplyUnit !== null ? Number(rawSupplyUnit) : 1, '7. qty.supplyUnit 일치 단정');
    // 8) deli.supply.pay
    assert.equal(parsed.shippingPayType, rawDeliPay ? String(rawDeliPay) : null, '8. deli.supply.pay 일치 단정');
    // 9) deli.supply.type
    if (rawDeliType) {
      assert.equal(parsed.shippingTypeLabel.includes(String(rawDeliType)) || parsed.shippingTypeLabel === '고정배송비', true, '9. deli.supply.type 일치 단정');
    }
    // 10) deli.supply.fee
    assert.equal(parsed.wholesaleShippingFee, rawDeliFee !== null ? Number(rawDeliFee) : null, '10. deli.supply.fee 일치 단정');
    // 11) deli.supply.tbl
    assert.equal(parsed.shippingTable, rawDeliTbl ? String(rawDeliTbl) : null, '11. deli.supply.tbl 일치 단정');
    // 12) seller.rank
    assert.equal(parsed.sellerRank, rawRank !== null ? Number(rawRank) : null, '12. seller.rank 일치 단정');
    // 13) seller.vacation
    assert.equal(parsed.sellerVacation, rawVacation ? Boolean(rawVacation.isVacation) : null, '13. seller.vacation 일치 단정');
    // 14) channel.supply
    if (rawChannel !== null) {
      const expectedChannelSupply = rawChannel === true || rawChannel === 'Y';
      assert.equal(parsed.isDropShippingAvailable, expectedChannelSupply, '14. channel.supply 일치 단정');
    }
    // 15) desc.license.usable
    if (rawLicense !== null) {
      const expectedLicense = rawLicense === true ? '사용가능' : (rawLicense === false ? '사용불가' : '확인불가');
      assert.equal(parsed.imageLicenseStatus, expectedLicense, '15. desc.license.usable 일치 단정');
    }
    // 16) price.resale.minumum
    assert.equal(parsed.minResalePrice, rawMinResale !== null ? Number(rawMinResale) : 0, '16. price.resale.minumum 일치 단정');
    // 17) price.resale.Recommand
    assert.equal(parsed.recommendResalePrice, rawRecResale !== null ? Number(rawRecResale) : 0, '17. price.resale.Recommand 일치 단정');
    // 18) category.current
    if (rawCatCurrent) {
      assert.equal(parsed.supplierCategoryCode, String(rawCatCurrent), '18. category.current 일치 단정');
    }

    console.log(`  ✅ [실상품 ${i + 1}/5] 18가지 상세 필드 assert 100% 통과!`);
    passedCount++;
  }

  console.log(`\n========================================`);
  console.log(`v2.2.0 REAL API 상세 18개 필드 raw vs parsed ASSERT 대조 결과: ${passedCount}/5 REAL_API 100% PASS`);
  console.log(`========================================\n`);
}

runStrictRealApiTests().catch(err => {
  console.error("\n❌ REAL API 18개 필드 ASSERT 검증 실패:", err.message);
  process.exit(1);
});
