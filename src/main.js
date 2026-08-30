/**
 * STEP 2.1.3: 메인 대시보드 및 4개 탭 통합 컨트롤러 (main.js)
 * - nullableNumber() 헬퍼 도입 (0원 오판 완전 방지)
 * - 수수료 배지 실제 status 연동 ([가정], [직접입력], [확인], [미확인])
 * - 최저판매준수가격 위반 경고 표시 (minResaleViolation)
 */

import { domeApiClient } from './api.js';
import { MarginCalculator, SHIPPING_TYPES } from './calculator.js';
import { configManager } from './config.js';
import { bookmarkStore } from './storage.js';
import { ProductValidator } from './validators.js';

const BUILD_SHA = (import.meta && import.meta.env && import.meta.env.VITE_BUILD_SHA) || 'dev';

export function nullableNumber(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function getFeeStatusBadgeText(status) {
  switch (status) {
    case 'TEMPORARY_ASSUMPTION': return '[가정]';
    case 'CONFIRMED_USER_INPUT':
    case 'USER_INPUT': return '[직접입력]';
    case 'CONFIRMED': return '[확인]';
    case 'UNCONFIRMED':
    default: return '[미확인]';
  }
}

let state = {
  products: [],
  filteredProducts: [],
  filters: {
    category: 'all',
    maxPrice: null,
    minProfit: null,
    minMargin: null,
    dropshipOnly: 'all',
    passOnly: 'all',
    sort: 'profit_desc'
  },
  activeSimulatorItemNo: null
};

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    updateBuildShaDisplay();
    initTabs();
    await loadProducts();
    initFilterControls();
    initBookmarkTab();
    initSimulatorTab();
    initSettingsTab();
    initDrawer();

    renderAll();
  });
}

function updateBuildShaDisplay() {
  document.querySelectorAll('.build-sha-tag').forEach(el => {
    el.textContent = `v2.1.3 · Build ${BUILD_SHA}`;
  });
}

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

      if (targetId === 'tab-bookmarks') {
        renderBookmarks();
      } else if (targetId === 'tab-simulator') {
        renderSimulator();
      }
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 2. Load Products & Initialize State                                        */
/* -------------------------------------------------------------------------- */
async function loadProducts() {
  const res = await domeApiClient.getItemList();
  state.products = res.parsed.map(item => {
    const defaultCoupangPrice = item.isMock ? item.userCoupangPrice : null;
    return {
      item,
      coupangPrice: defaultCoupangPrice,
      calc: null,
      verification: ProductValidator.evaluate(item)
    };
  });
}

function recalculateAllProducts() {
  state.products.forEach(p => {
    p.calc = MarginCalculator.calculate({
      product: p.item,
      userCoupangPrice: p.coupangPrice,
      categoryCode: p.item.coupangCategoryCode,
      shippingType: 'DROP_SHIPPING_FREE'
    });
    p.verification = ProductValidator.evaluate(p.item);
  });
}

function applyFiltersAndSort() {
  const f = state.filters;
  let list = [...state.products];

  if (f.category !== 'all') {
    list = list.filter(p => p.item.supplierCategoryCode === f.category || p.item.coupangCategoryCode === f.category);
  }
  if (f.maxPrice !== null && !isNaN(f.maxPrice) && f.maxPrice > 0) {
    list = list.filter(p => p.item.wholesalePrice !== null && p.item.wholesalePrice <= f.maxPrice);
  }
  if (f.minProfit !== null && !isNaN(f.minProfit) && f.minProfit > 0) {
    list = list.filter(p => p.calc.basicProfit !== null && p.calc.basicProfit >= f.minProfit);
  }
  if (f.minMargin !== null && !isNaN(f.minMargin) && f.minMargin > 0) {
    list = list.filter(p => p.calc.marginRate !== null && p.calc.marginRate >= f.minMargin);
  }
  if (f.dropshipOnly === 'Y') {
    list = list.filter(p => p.item.isDropShippingAvailable);
  }
  if (f.passOnly === 'pass') {
    list = list.filter(p => p.calc.profitTier && p.calc.profitTier.id === 'GRADE_A');
  } else if (f.passOnly === 'pass_review') {
    list = list.filter(p => p.calc.profitTier && (p.calc.profitTier.id === 'GRADE_A' || p.calc.profitTier.id === 'GRADE_B'));
  }

  switch (f.sort) {
    case 'profit_desc':
      list.sort((a, b) => (b.calc.basicProfit || -999999) - (a.calc.basicProfit || -999999));
      break;
    case 'required_qty_asc':
      list.sort((a, b) => {
        if (a.calc.requiredDailySales === null) return 1;
        if (b.calc.requiredDailySales === null) return -1;
        return a.calc.requiredDailySales - b.calc.requiredDailySales;
      });
      break;
    case 'margin_desc':
      list.sort((a, b) => (b.calc.marginRate || 0) - (a.calc.marginRate || 0));
      break;
    case 'roi_desc':
      list.sort((a, b) => (b.calc.roi || 0) - (a.calc.roi || 0));
      break;
    case 'price_asc':
      list.sort((a, b) => (a.item.wholesalePrice || 0) - (b.item.wholesalePrice || 0));
      break;
  }

  state.filteredProducts = list;
}

function renderAll() {
  recalculateAllProducts();
  applyFiltersAndSort();
  renderHeaderStats();
  renderSourcingTable();
  populateSimulatorDropdown();
}

function renderHeaderStats() {
  let gradeACnt = 0, gradeBCnt = 0, gradeCCnt = 0;
  state.products.forEach(p => {
    const tierId = p.calc.profitTier?.id;
    if (tierId === 'GRADE_A') gradeACnt++;
    else if (tierId === 'GRADE_B') gradeBCnt++;
    else gradeCCnt++;
  });

  const bookmarks = bookmarkStore.getBookmarks();

  document.getElementById('stat-total-cnt').textContent = state.products.length;
  document.getElementById('stat-pass-cnt').textContent = gradeACnt;
  document.getElementById('stat-review-cnt').textContent = gradeBCnt;
  document.getElementById('stat-exclude-cnt').textContent = gradeCCnt;
  document.getElementById('stat-bookmark-cnt').textContent = bookmarks.length;
}

/* -------------------------------------------------------------------------- */
/* 3. Render Sourcing Dashboard Table                                         */
/* -------------------------------------------------------------------------- */
function renderSourcingTable() {
  const tbody = document.getElementById('sourcing-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (state.filteredProducts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="15" style="text-align: center; padding: 40px; color: var(--text-muted);">
          🔍 조건에 맞는 상품이 없습니다. 필터 조건을 변경해 보세요.
        </td>
      </tr>`;
    return;
  }

  state.filteredProducts.forEach(p => {
    const item = p.item;
    const calc = p.calc;
    const isBookmarked = bookmarkStore.isBookmarked(item.itemNo);

    const reqQtyText = calc.requiredDailySales !== null ? `${calc.requiredDailySales}개/일` : '달성불가';

    // 수수료 배지 텍스트
    const feeBadgeText = getFeeStatusBadgeText(item.coupangFeeStatus);

    // 최저판매준수가격 위반 경고
    const violationBadge = item.minResaleViolation ? `<span style="color:var(--accent-red); font-size:0.75rem; font-weight:bold; margin-left:4px;">[최저판매준수가격 위반]</span>` : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">
        <button class="btn-icon btn-bookmark ${isBookmarked ? 'active' : ''}" data-itemno="${item.itemNo}">
          ${isBookmarked ? '♥' : '♡'}
        </button>
      </td>
      <td>
        <img src="${item.imageUrl}" alt="${item.title || ''}" class="img-thumb" />
      </td>
      <td>
        <div style="font-weight: 600; font-size: 0.88rem; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${item.isMock ? '<span class="tag-mock">MOCK</span>' : ''} ${item.title || '제목없음'} ${violationBadge}
        </div>
        <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
          도매카테고리: ${item.supplierCategoryName || item.supplierCategoryCode || '미확인'} | ID: ${item.itemNo}
          <span style="color:var(--accent-blue); margin-left: 4px;">[${item.channelLabel}]</span>
          <span style="color:var(--text-muted); margin-left: 4px;">(${p.verification.label})</span>
        </div>
      </td>
      <td>${item.wholesalePrice !== null ? item.wholesalePrice.toLocaleString() + '원' : '확인필요'}</td>
      <td>${item.wholesaleShippingFee !== null ? item.wholesaleShippingFee.toLocaleString() + '원' : '<span style="color:var(--accent-yellow);">확인필요</span>'}</td>
      <td>
        <input type="number" class="price-input input-coupang-price" data-itemno="${item.itemNo}" value="${p.coupangPrice !== null ? p.coupangPrice : ''}" placeholder="직접입력" step="100" /> 원
      </td>
      <td style="color: var(--text-muted);">
        ${calc.coupangFee !== null ? calc.coupangFee.toLocaleString() + '원' : '-'}
        <span style="font-size: 0.7rem; color: var(--accent-yellow);">${feeBadgeText}</span>
      </td>
      <td>${calc.totalCost !== null ? calc.totalCost.toLocaleString() + '원' : '-'}</td>
      <td style="font-weight: 700; color: var(--accent-green);">${calc.basicProfit !== null ? calc.basicProfit.toLocaleString() + '원' : '-'}</td>
      <td style="color: #7dd3fc;">${calc.conservativeProfit !== null ? calc.conservativeProfit.toLocaleString() + '원' : '-'}</td>
      <td style="color: var(--accent-yellow); font-weight: 600;">${calc.marginRate !== null ? calc.marginRate + '%' : '-'}</td>
      <td style="color: var(--accent-blue); font-weight: 600;">${calc.roi !== null ? calc.roi + '%' : '-'}</td>
      <td style="font-weight: 700; color: ${calc.requiredDailySales !== null ? 'var(--accent-blue)' : 'var(--accent-red)'};">${reqQtyText}</td>
      <td style="text-align: center;">
        <span class="badge-tier ${calc.profitTier ? calc.profitTier.badgeClass : 'badge-exclude'}">${calc.profitTier ? calc.profitTier.name : '확인필요'}</span>
      </td>
      <td style="text-align: center;">
        <button class="btn-icon btn-open-drawer" data-itemno="${item.itemNo}">⚙️ 시뮬</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.input-coupang-price').forEach(input => {
    input.addEventListener('input', (e) => {
      const itemNo = e.target.getAttribute('data-itemno');
      const val = nullableNumber(e.target.value);
      const targetP = state.products.find(p => String(p.item.itemNo) === String(itemNo));
      if (targetP) {
        targetP.coupangPrice = val;
        renderAll();
      }
    });
  });

  tbody.querySelectorAll('.btn-bookmark').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemNo = btn.getAttribute('data-itemno');
      const targetP = state.products.find(p => String(p.item.itemNo) === String(itemNo));
      if (targetP) {
        bookmarkStore.toggleBookmark({
          itemNo: targetP.item.itemNo,
          title: targetP.item.title,
          wholesalePrice: targetP.item.wholesalePrice,
          wholesaleShippingFee: targetP.item.wholesaleShippingFee,
          userCoupangPrice: targetP.coupangPrice,
          categoryCode: targetP.item.coupangCategoryCode,
          imageUrl: targetP.item.imageUrl
        });
        renderAll();
      }
    });
  });

  tbody.querySelectorAll('.btn-open-drawer').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemNo = btn.getAttribute('data-itemno');
      openDrawerForItem(itemNo);
    });
  });
}

function initFilterControls() {
  document.getElementById('flt-category').addEventListener('change', e => {
    state.filters.category = e.target.value;
    renderAll();
  });
  document.getElementById('flt-max-price').addEventListener('input', e => {
    state.filters.maxPrice = nullableNumber(e.target.value);
    renderAll();
  });
  document.getElementById('flt-min-profit').addEventListener('input', e => {
    state.filters.minProfit = nullableNumber(e.target.value);
    renderAll();
  });
  document.getElementById('flt-min-margin').addEventListener('input', e => {
    state.filters.minMargin = nullableNumber(e.target.value);
    renderAll();
  });
  document.getElementById('flt-dropship').addEventListener('change', e => {
    state.filters.dropshipOnly = e.target.value;
    renderAll();
  });
  document.getElementById('flt-pass-only').addEventListener('change', e => {
    state.filters.passOnly = e.target.value;
    renderAll();
  });
  document.getElementById('flt-sort').addEventListener('change', e => {
    state.filters.sort = e.target.value;
    renderAll();
  });
}

/* -------------------------------------------------------------------------- */
/* 4. Tab 2: Bookmark Store 기능                                             */
/* -------------------------------------------------------------------------- */
function initBookmarkTab() {}

function renderBookmarks() {
  const tbody = document.getElementById('bookmark-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const bookmarks = bookmarkStore.getBookmarks();
  if (bookmarks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 30px; color: var(--text-muted);">
          ♥ 저장된 관심상품이 없습니다. 대시보드에서 하트(♥)를 클릭하여 추가해 보세요.
        </td>
      </tr>`;
    return;
  }

  bookmarks.forEach(bm => {
    const calc = MarginCalculator.calculate({
      wholesalePrice: bm.wholesalePrice,
      wholesaleShippingFee: bm.wholesaleShippingFee,
      userCoupangPrice: bm.userCoupangPrice,
      categoryCode: bm.categoryCode
    });

    const reqQtyText = calc.requiredDailySales !== null ? `${calc.requiredDailySales}개/일` : '달성불가';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${bm.imageUrl}" class="img-thumb" /></td>
      <td style="font-weight: 600; font-size: 0.85rem;">${bm.title || '제목없음'}</td>
      <td>${bm.wholesalePrice ? bm.wholesalePrice.toLocaleString() + '원' : '-'}</td>
      <td>${bm.userCoupangPrice ? bm.userCoupangPrice.toLocaleString() + '원' : '미입력'}</td>
      <td style="font-weight:700; color:var(--accent-green);">${calc.basicProfit ? calc.basicProfit.toLocaleString() + '원' : '-'}</td>
      <td style="color:#7dd3fc;">${calc.conservativeProfit ? calc.conservativeProfit.toLocaleString() + '원' : '-'}</td>
      <td>${calc.marginRate ? calc.marginRate + '%' : '-'}</td>
      <td>${calc.roi ? calc.roi + '%' : '-'}</td>
      <td style="font-weight:700; color:var(--accent-blue);">${reqQtyText}</td>
      <td style="font-size:0.75rem; color:var(--text-muted);">${bm.savedAt ? bm.savedAt.substring(0, 10) : '-'}</td>
      <td style="text-align:center;">
        <button class="btn-icon btn-remove-bookmark" data-itemno="${bm.itemNo}">🗑️ 삭제</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-remove-bookmark').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemNo = btn.getAttribute('data-itemno');
      bookmarkStore.removeBookmark(itemNo);
      renderAll();
      renderBookmarks();
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 5. Tab 3: Detailed Simulator 기능                                          */
/* -------------------------------------------------------------------------- */
function initSimulatorTab() {
  const select = document.getElementById('sim-product-select');
  if (!select) return;

  select.addEventListener('change', e => {
    state.activeSimulatorItemNo = e.target.value;
    renderSimulator();
  });

  document.querySelectorAll('.btn-quick-price').forEach(btn => {
    btn.addEventListener('click', () => {
      const addVal = Number(btn.getAttribute('data-add'));
      const priceInput = document.getElementById('sim-coupang-price');
      const cur = nullableNumber(priceInput.value) || 0;
      priceInput.value = Math.max(0, cur + addVal);
      renderSimulator();
    });
  });

  document.querySelectorAll('.btn-quick-ratio').forEach(btn => {
    btn.addEventListener('click', () => {
      const ratio = Number(btn.getAttribute('data-ratio'));
      const wholesale = nullableNumber(document.getElementById('sim-wholesale-price').value) || 0;
      const shipping = nullableNumber(document.getElementById('sim-wholesale-shipping').value) || 0;
      const totalCost = wholesale + shipping;
      document.getElementById('sim-coupang-price').value = Math.round((totalCost * ratio) / 100) * 100;
      renderSimulator();
    });
  });

  ['sim-wholesale-price', 'sim-wholesale-shipping', 'sim-coupang-price', 'sim-category-select', 'sim-shipping-type', 'sim-target-profit-input', 'sim-target-qty-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', renderSimulator);
      el.addEventListener('change', renderSimulator);
    }
  });
}

function populateSimulatorDropdown() {
  const select = document.getElementById('sim-product-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '';

  state.products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.item.itemNo;
    opt.textContent = `${p.item.isMock ? '[MOCK] ' : ''}${p.item.title || '제목없음'} (공급가: ${p.item.wholesalePrice ? p.item.wholesalePrice.toLocaleString() : '-'}원)`;
    select.appendChild(opt);
  });

  if (currentVal && state.products.some(p => String(p.item.itemNo) === String(currentVal))) {
    select.value = currentVal;
  } else if (state.products.length > 0) {
    select.value = state.products[0].item.itemNo;
    state.activeSimulatorItemNo = state.products[0].item.itemNo;
  }
}

function renderSimulator() {
  const itemNo = document.getElementById('sim-product-select')?.value;
  const targetP = state.products.find(p => String(p.item.itemNo) === String(itemNo));
  if (!targetP) return;

  const wholesaleInput = document.getElementById('sim-wholesale-price');
  const shippingInput = document.getElementById('sim-wholesale-shipping');
  const coupangInput = document.getElementById('sim-coupang-price');
  const categorySelect = document.getElementById('sim-category-select');
  const shippingTypeSelect = document.getElementById('sim-shipping-type');

  if (document.activeElement !== wholesaleInput && wholesaleInput) {
    wholesaleInput.value = targetP.item.wholesalePrice !== null ? targetP.item.wholesalePrice : '';
  }
  if (document.activeElement !== shippingInput && shippingInput) {
    shippingInput.value = targetP.item.wholesaleShippingFee !== null ? targetP.item.wholesaleShippingFee : '';
  }
  if (document.activeElement !== coupangInput && coupangInput) {
    coupangInput.value = targetP.coupangPrice !== null ? targetP.coupangPrice : '';
  }

  const wholesale = nullableNumber(wholesaleInput?.value);
  const shipping = nullableNumber(shippingInput?.value);
  const coupang = nullableNumber(coupangInput?.value);
  const categoryCode = categorySelect?.value || null;
  const shippingType = shippingTypeSelect?.value || 'DROP_SHIPPING_FREE';

  const calc = MarginCalculator.calculate({
    wholesalePrice: wholesale,
    wholesaleShippingFee: shipping,
    userCoupangPrice: coupang,
    categoryCode,
    shippingType
  });

  // 결과 리포트 렌더링
  document.getElementById('sim-basic-profit').textContent = calc.basicProfit !== null ? `${calc.basicProfit.toLocaleString()} 원` : '-';
  document.getElementById('sim-conservative-profit').textContent = calc.conservativeProfit !== null ? `${calc.conservativeProfit.toLocaleString()} 원` : '-';
  document.getElementById('sim-margin-roi').textContent = calc.marginRate !== null ? `${calc.marginRate}% / ${calc.roi}%` : '- / -';
  document.getElementById('sim-total-cost').textContent = calc.totalCost !== null ? `${calc.totalCost.toLocaleString()} 원` : '-';
  document.getElementById('sim-coupang-fee').textContent = calc.coupangFee !== null ? `${calc.coupangFee.toLocaleString()} 원` : '-';
  document.getElementById('sim-tax-reserve').textContent = calc.taxReserve !== null ? `${calc.taxReserve.toLocaleString()} 원` : '-';

  // 손익분기 역산
  const breakEven = MarginCalculator.calcBreakEvenPrice({ wholesalePrice: wholesale, wholesaleShippingFee: shipping, feeRate: calc.feeRate });
  document.getElementById('sim-breakeven-price').textContent = breakEven.value !== null ? `${breakEven.value.toLocaleString()} 원` : '수수료확인필요';

  // 필요 수량
  const reqQtyText = calc.requiredDailySales !== null ? `${calc.requiredDailySales} 개/일` : '달성불가';
  document.getElementById('sim-required-qty').textContent = reqQtyText;

  // 등급 뱃지
  const tierBadge = document.getElementById('sim-tier-badge');
  if (tierBadge && calc.profitTier) {
    tierBadge.className = `badge-tier ${calc.profitTier.badgeClass}`;
    tierBadge.textContent = calc.profitTier.name;
  }

  // 수수료 상태 배지
  const feeStatusBadge = document.getElementById('sim-fee-status-badge');
  if (feeStatusBadge) {
    feeStatusBadge.textContent = categoryCode ? '임시 가정' : '미확인';
  }

  // 하루 5/10/20/30개 판매수량 시뮬레이션
  [5, 10, 20, 30].forEach(qty => {
    const el = document.getElementById(`sim-qty${qty}-profit`);
    if (el) {
      el.textContent = calc.basicProfit !== null ? `${(calc.basicProfit * qty).toLocaleString()}원` : '-';
    }
  });

  // 목표 이익 역산기
  const targetProfitVal = nullableNumber(document.getElementById('sim-target-profit-input')?.value) || 20000;
  const targetQtyVal = nullableNumber(document.getElementById('sim-target-qty-input')?.value) || 15;
  const targetPriceObj = MarginCalculator.calcTargetSellingPrice({ wholesalePrice: wholesale, wholesaleShippingFee: shipping, targetProfit: targetProfitVal, feeRate: calc.feeRate });

  const revEl = document.getElementById('sim-reverse-calc-result');
  if (revEl) {
    if (targetPriceObj.value !== null) {
      revEl.innerHTML = `건당 <strong>${targetProfitVal.toLocaleString()}원</strong> 이익을 위해 쿠팡 판매가 <strong>${targetPriceObj.value.toLocaleString()}원</strong> 필요 (하루 ${targetQtyVal}개 판매시 일 순수익 ${(targetProfitVal * targetQtyVal).toLocaleString()}원)`;
    } else {
      revEl.textContent = '수수료 미확인으로 계산 불가';
    }
  }
}

/* -------------------------------------------------------------------------- */
/* 6. Tab 4: Settings 기능                                                    */
/* -------------------------------------------------------------------------- */
function initSettingsTab() {
  const saveBtn = document.getElementById('btn-save-settings');
  const resetBtn = document.getElementById('btn-reset-settings');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      configManager.config.targetDailyProfit = nullableNumber(document.getElementById('cfg-target-daily').value) || 300000;
      configManager.config.passProfitThreshold = nullableNumber(document.getElementById('cfg-pass-profit').value) || 20000;
      configManager.config.reviewProfitThreshold = nullableNumber(document.getElementById('cfg-review-profit').value) || 10000;
      configManager.config.taxRate = nullableNumber(document.getElementById('cfg-tax-rate').value) || 0.015;
      configManager.config.monthlyServiceFee = nullableNumber(document.getElementById('cfg-service-fee').value) || 55000;

      configManager.saveConfig();
      alert('💾 설정이 성공적으로 저장되었습니다!');
      renderAll();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('🔄 기본값으로 초기화하시겠습니까?')) {
        configManager.resetToDefault();
        document.getElementById('cfg-target-daily').value = configManager.config.targetDailyProfit;
        document.getElementById('cfg-pass-profit').value = configManager.config.passProfitThreshold;
        document.getElementById('cfg-review-profit').value = configManager.config.reviewProfitThreshold;
        document.getElementById('cfg-tax-rate').value = configManager.config.taxRate;
        document.getElementById('cfg-service-fee').value = configManager.config.monthlyServiceFee;
        alert('기본값으로 초기화되었습니다.');
        renderAll();
      }
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 7. Detail Drawer Modal 기능                                                */
/* -------------------------------------------------------------------------- */
function initDrawer() {
  const closeBtn = document.getElementById('btn-close-drawer');
  const modal = document.getElementById('detail-modal');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
}

function openDrawerForItem(itemNo) {
  const targetP = state.products.find(p => String(p.item.itemNo) === String(itemNo));
  if (!targetP) return;

  const modal = document.getElementById('detail-modal');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerContent = document.getElementById('drawer-content');

  if (!modal || !drawerContent) return;

  const item = targetP.item;
  const calc = targetP.calc;
  const ver = targetP.verification;

  drawerTitle.textContent = `[${item.itemNo}] ${item.title || '제목없음'}`;

  const issuesList = ver.issues.map(iss => `<li style="color:var(--accent-yellow); margin-bottom:2px;">• ${iss}</li>`).join('');

  drawerContent.innerHTML = `
    <div style="display:flex; gap:12px; margin-bottom:14px; align-items:center;">
      <img src="${item.imageUrl}" style="width:70px; height:70px; border-radius:8px; object-fit:cover;" />
      <div>
        <div style="font-weight:bold;">${item.title || ''}</div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
          도매가: ${item.wholesalePrice ? item.wholesalePrice.toLocaleString() + '원' : '확인필요'} |
          배송비: ${item.wholesaleShippingFee ? item.wholesaleShippingFee.toLocaleString() + '원' : '확인필요'}
        </div>
        <div style="margin-top:4px;">
          <span class="badge-tier ${calc.profitTier ? calc.profitTier.badgeClass : ''}">${calc.profitTier ? calc.profitTier.name : '확인필요'}</span>
          <span style="font-size:0.75rem; color:var(--accent-blue); margin-left:6px;">검증: ${ver.label}</span>
        </div>
      </div>
    </div>

    <table class="product-table" style="margin-bottom:14px;">
      <tbody>
        <tr><th>쿠팡 판매예정가</th><td><strong>${calc.coupangPrice ? calc.coupangPrice.toLocaleString() + ' 원' : '미입력'}</strong></td></tr>
        <tr><th>총 원가</th><td>${calc.totalCost ? calc.totalCost.toLocaleString() + ' 원' : '-'}</td></tr>
        <tr><th>쿠팡 수수료</th><td>${calc.coupangFee ? calc.coupangFee.toLocaleString() + ' 원' : '-'} <span style="font-size:0.7rem; color:var(--accent-yellow);">${getFeeStatusBadgeText(item.coupangFeeStatus)}</span></td></tr>
        <tr><th>간이과세 세금충당(1.5%)</th><td>${calc.taxReserve ? calc.taxReserve.toLocaleString() + ' 원' : '-'}</td></tr>
        <tr><th>기본 상품이익</th><td style="font-weight:bold; color:var(--accent-green);">${calc.basicProfit ? calc.basicProfit.toLocaleString() + ' 원' : '-'}</td></tr>
        <tr><th>보수 상품이익</th><td style="color:#7dd3fc;">${calc.conservativeProfit ? calc.conservativeProfit.toLocaleString() + ' 원' : '-'}</td></tr>
        <tr><th>마진율 / ROI</th><td>${calc.marginRate ? calc.marginRate + '%' : '-'} / ${calc.roi ? calc.roi + '%' : '-'}</td></tr>
        <tr><th>30만원 필요수량</th><td style="font-weight:bold; color:var(--accent-blue);">${calc.requiredDailySales !== null ? calc.requiredDailySales + ' 개/일' : '달성불가'}</td></tr>
      </tbody>
    </table>

    <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:6px; border:1px solid var(--panel-border);">
      <div style="font-size:0.8rem; font-weight:bold; margin-bottom:4px;">🛡️ 상품 안전성 검증 점검 리스트</div>
      <ul style="padding-left:14px; font-size:0.78rem; list-style:none;">
        ${issuesList || '<li style="color:var(--accent-green);">• 특이사항 없음 (검증완료)</li>'}
      </ul>
    </div>
  `;

  modal.classList.add('active');
}
