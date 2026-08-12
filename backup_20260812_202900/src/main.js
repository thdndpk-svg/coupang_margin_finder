/**
 * STEP 1: 메인 컨트롤러 (main.js)
 * - 탭 전환, 도매꾹 API 테스트, 마진 계산기 연동, 동적 설정 바인딩
 */

import { domeApiClient, SAMPLE_ITEM_LIST_V41_RESPONSE, SAMPLE_ITEM_VIEW_V46_RESPONSE } from './api.js';
import { MarginCalculator } from './calculator.js';
import { configManager } from './config.js';
import { DomeProductModel } from './models.js';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initApiTester();
  initMarginCalculator();
  initConfigStore();
});

/* -------------------------------------------------------------------------- */
/* 1. Tab Navigation                                                          */
/* -------------------------------------------------------------------------- */
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetId)?.classList.add('active');
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 2. Tab 1: Domeggook Open API Tester                                         */
/* -------------------------------------------------------------------------- */
function initApiTester() {
  const apiKeyInput = document.getElementById('api-key-input');
  const apiKwInput = document.getElementById('api-kw-input');
  const btnFetchList = document.getElementById('btn-fetch-list');
  const btnFetchView = document.getElementById('btn-fetch-view');
  const rawJsonViewer = document.getElementById('raw-json-viewer');
  const parsedModelViewer = document.getElementById('parsed-model-viewer');
  const jsonStatusTag = document.getElementById('json-status-tag');

  // 기본적으로 v4.1 샘플 출력 로드
  renderApiResults(
    SAMPLE_ITEM_LIST_V41_RESPONSE,
    (SAMPLE_ITEM_LIST_V41_RESPONSE.domeggook.list.item || []).map(i => new DomeProductModel(i, 'getItemList')),
    'v4.1 샘플 JSON 로드됨 (MOCK 모드)'
  );

  btnFetchList.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const kw = apiKwInput.value.trim() || '텀블러';
    domeApiClient.setApiKey(key);

    btnFetchList.innerText = '⌛ getItemList v4.1 호출 중...';
    btnFetchList.disabled = true;

    try {
      const result = await domeApiClient.getItemList({ kw, sz: 5 });
      renderApiResults(
        result.raw,
        result.parsed,
        result.isMock ? `v4.1 MOCK 모드 (${result.notice || ''})` : 'v4.1 LIVE API 호출 성공'
      );
    } catch (e) {
      alert(`API 호출 오류: ${e.message}`);
    } finally {
      btnFetchList.innerText = '▶ getItemList v4.1 실행';
      btnFetchList.disabled = false;
    }
  });

  btnFetchView.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    domeApiClient.setApiKey(key);

    btnFetchView.innerText = '⌛ getItemView v4.6 호출 중...';
    btnFetchView.disabled = true;

    try {
      const result = await domeApiClient.getItemView('7859124');
      renderApiResults(
        result.raw,
        result.parsed,
        result.isMock ? `v4.6 MOCK 모드 (${result.notice || ''})` : 'v4.6 LIVE API 호출 성공'
      );
    } catch (e) {
      alert(`API 상세 호출 오류: ${e.message}`);
    } finally {
      btnFetchView.innerText = '🔍 getItemView v4.6 상세 실행';
      btnFetchView.disabled = false;
    }
  });

  function renderApiResults(raw, parsed, statusText) {
    rawJsonViewer.textContent = JSON.stringify(raw, null, 2);
    parsedModelViewer.textContent = JSON.stringify(parsed, null, 2);
    jsonStatusTag.textContent = statusText;
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Tab 2: Margin Calculator Tester                                         */
/* -------------------------------------------------------------------------- */
function initMarginCalculator() {
  const selectProduct = document.getElementById('calc-product-select');
  const inputWholesalePrice = document.getElementById('calc-wholesale-price');
  const inputWholesaleShipping = document.getElementById('calc-wholesale-shipping');
  const inputCoupangPrice = document.getElementById('calc-coupang-price');
  const selectCategory = document.getElementById('calc-category-select');
  const selectShippingType = document.getElementById('calc-shipping-type');
  const extraShippingInputs = document.getElementById('extra-shipping-inputs');
  const groupCustomerShipping = document.getElementById('group-customer-shipping');
  const groupSellerCourier = document.getElementById('group-seller-courier');
  const inputCustomerShipping = document.getElementById('calc-customer-shipping');
  const inputSellerCourier = document.getElementById('calc-seller-courier');
  const btnRecalculate = document.getElementById('btn-recalculate');

  // 상품 변경 시 도매가 세팅
  selectProduct.addEventListener('change', () => {
    const sampleItems = SAMPLE_ITEM_LIST_V41_RESPONSE.domeggook.list.item;
    const selected = sampleItems[selectProduct.value] || sampleItems[0];
    inputWholesalePrice.value = selected.price;
    inputWholesaleShipping.value = selected.deliPrice;
    selectCategory.value = selected.category || '1002';
    runCalculation();
  });

  // 배송 방식 변경 시 추가 입력창 표시 여부 제어
  selectShippingType.addEventListener('change', () => {
    const type = selectShippingType.value;
    if (type === 'DROP_SHIPPING_PAID') {
      extraShippingInputs.style.display = 'block';
      groupCustomerShipping.style.display = 'block';
      groupSellerCourier.style.display = 'none';
    } else if (type === 'DIRECT_PURCHASE') {
      extraShippingInputs.style.display = 'block';
      groupCustomerShipping.style.display = 'none';
      groupSellerCourier.style.display = 'block';
    } else {
      extraShippingInputs.style.display = 'none';
    }
    runCalculation();
  });

  btnRecalculate.addEventListener('click', runCalculation);

  // 실시간 변경 이벤트
  [inputWholesalePrice, inputWholesaleShipping, inputCoupangPrice, selectCategory, inputCustomerShipping, inputSellerCourier].forEach(elem => {
    elem.addEventListener('input', runCalculation);
  });

  function runCalculation() {
    const wholesalePrice = Number(inputWholesalePrice.value || 0);
    const wholesaleShippingFee = Number(inputWholesaleShipping.value || 0);
    const coupangPrice = Number(inputCoupangPrice.value || 0);
    const categoryCode = selectCategory.value;
    const shippingType = selectShippingType.value;
    const customerPaidShippingFee = Number(inputCustomerShipping.value || 0);
    const sellerCourierFee = Number(inputSellerCourier.value || 3000);

    const result = MarginCalculator.calculate({
      coupangPrice,
      wholesalePrice,
      wholesaleShippingFee,
      categoryCode,
      shippingType,
      customerPaidShippingFee,
      sellerCourierFee
    });

    updateDashboard(result);
  }

  function updateDashboard(res) {
    document.getElementById('res-basic-profit').textContent = `${res.basicNetProfit.toLocaleString()} 원`;
    document.getElementById('res-conservative-profit').textContent = `${res.conservativeNetProfit.toLocaleString()} 원`;
    document.getElementById('res-margin-rate').textContent = `${res.marginRate} %`;
    document.getElementById('res-roi').textContent = `${res.roi} %`;

    document.getElementById('res-coupang-price').textContent = `${res.coupangPrice.toLocaleString()} 원`;
    document.getElementById('res-coupang-fee').textContent = `${res.coupangFee.toLocaleString()} 원 (${(res.feeRate * 100).toFixed(2)}%)`;
    document.getElementById('res-actual-shipping').textContent = `${res.actualShippingCost.toLocaleString()} 원 (${res.shippingNote})`;
    document.getElementById('res-total-cost').textContent = `${res.totalCost.toLocaleString()} 원`;
    document.getElementById('res-conservative-loss').textContent = `${(res.returnLoss + res.adSpend).toLocaleString()} 원 (반품 ${res.returnLoss.toLocaleString()}원 + 광고비 ${res.adSpend.toLocaleString()}원)`;
    document.getElementById('res-bulk-profit').textContent = `${res.qty10Profit.toLocaleString()} 원 / ${res.qty30Profit.toLocaleString()} 원`;
    document.getElementById('res-required-qty').textContent = `하루 ${res.dailyRequiredQty} 개`;

    const tierBadge = document.getElementById('tier-badge');
    tierBadge.textContent = res.candidateTierName;
    if (res.candidateTier === 'PASS') {
      tierBadge.style.background = 'rgba(34,197,94,0.2)';
      tierBadge.style.color = 'var(--accent-green)';
      tierBadge.style.borderColor = 'var(--accent-green)';
    } else if (res.candidateTier === 'REVIEW') {
      tierBadge.style.background = 'rgba(234,179,8,0.2)';
      tierBadge.style.color = 'var(--accent-yellow)';
      tierBadge.style.borderColor = 'var(--accent-yellow)';
    } else {
      tierBadge.style.background = 'rgba(239,68,68,0.2)';
      tierBadge.style.color = 'var(--accent-red)';
      tierBadge.style.borderColor = 'var(--accent-red)';
    }
  }

  // 초기 실행
  runCalculation();
}

/* -------------------------------------------------------------------------- */
/* 4. Tab 3: Config Store                                                     */
/* -------------------------------------------------------------------------- */
function initConfigStore() {
  const vatToggle = document.getElementById('cfg-vat-toggle');
  const shippingComm = document.getElementById('cfg-shipping-comm');
  const coupangService = document.getElementById('cfg-coupang-service');
  const targetDaily = document.getElementById('cfg-target-daily');
  const btnSaveConfig = document.getElementById('btn-save-config');
  const btnResetConfig = document.getElementById('btn-reset-config');

  // 로드된 설정값 바인딩
  const cfg = configManager.config;
  vatToggle.value = String(cfg.vatIncludedInRate);
  shippingComm.value = cfg.shippingFeeCommissionRate;
  coupangService.value = cfg.monthlyOverhead.coupangServiceFee;
  targetDaily.value = cfg.targets.dailyNetProfit;

  btnSaveConfig.addEventListener('click', () => {
    configManager.saveConfig({
      vatIncludedInRate: vatToggle.value === 'true',
      shippingFeeCommissionRate: Number(shippingComm.value),
      monthlyOverhead: {
        ...configManager.config.monthlyOverhead,
        coupangServiceFee: Number(coupangService.value)
      },
      targets: {
        dailyNetProfit: Number(targetDaily.value)
      }
    });
    alert('✅ 동적 설정이 성공적으로 저장되었습니다!');
    // 마진 재계산 실행
    document.getElementById('btn-recalculate')?.click();
  });

  btnResetConfig.addEventListener('click', () => {
    if (confirm('설정값을 기본값으로 초기화하시겠습니까?')) {
      configManager.resetConfig();
      const freshCfg = configManager.config;
      vatToggle.value = String(freshCfg.vatIncludedInRate);
      shippingComm.value = freshCfg.shippingFeeCommissionRate;
      coupangService.value = freshCfg.monthlyOverhead.coupangServiceFee;
      targetDaily.value = freshCfg.targets.dailyNetProfit;
      alert('🔄 기본값으로 초기화되었습니다.');
      document.getElementById('btn-recalculate')?.click();
    }
  });
}
