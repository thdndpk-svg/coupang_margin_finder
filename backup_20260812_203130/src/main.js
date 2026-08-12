/**
 * STEP 2: 메인 대시보드 컨트롤러 (main.js)
 * - 상품 발굴 대시보드 (15+ MOCK 데이터)
 * - 실시간 쿠팡가 수동 입력 & 즉시 마진 재계산
 * - 필터 & 정렬 (예상순이익/마진율/ROI/도매가)
 * - 관심상품 저장/삭제 (LocalStorage 복원)
 * - 상세 시뮬레이터 & 동적 설정 관리
 */

import { domeApiClient, SAMPLE_MOCK_PRODUCTS } from './api.js';
import { MarginCalculator, SHIPPING_TYPES } from './calculator.js';
import { configManager } from './config.js';
import { BookmarkStore } from './storage.js';

// 상태 관리
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

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadProducts();
  initFilterControls();
  initBookmarkTab();
  initSimulatorTab();
  initSettingsTab();
  initDrawer();

  renderAll();
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

      if (targetId === 'tab-bookmarks') {
        renderBookmarks();
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
    const defaultCoupangPrice = item.rawResponse?.defaultCoupangPrice || Math.round(item.wholesalePrice * 3.5);
    return {
      item,
      coupangPrice: defaultCoupangPrice,
      calc: null
    };
  });
}

function recalculateAllProducts() {
  state.products.forEach(p => {
    p.calc = MarginCalculator.calculate({
      coupangPrice: p.coupangPrice,
      wholesalePrice: p.item.wholesalePrice,
      wholesaleShippingFee: p.item.wholesaleShippingFee,
      categoryCode: p.item.categoryCode,
      shippingType: 'DROP_SHIPPING_FREE'
    });
  });
}

function applyFiltersAndSort() {
  const f = state.filters;
  let list = [...state.products];

  // 1. 카테고리 필터
  if (f.category !== 'all') {
    list = list.filter(p => p.item.categoryCode === f.category);
  }

  // 2. 최대 도매가
  if (f.maxPrice !== null && !isNaN(f.maxPrice) && f.maxPrice > 0) {
    list = list.filter(p => p.item.wholesalePrice <= f.maxPrice);
  }

  // 3. 최소 예상 순이익
  if (f.minProfit !== null && !isNaN(f.minProfit) && f.minProfit > 0) {
    list = list.filter(p => p.calc.basicNetProfit >= f.minProfit);
  }

  // 4. 최소 마진율
  if (f.minMargin !== null && !isNaN(f.minMargin) && f.minMargin > 0) {
    list = list.filter(p => p.calc.marginRate >= f.minMargin);
  }

  // 5. 위탁 전용
  if (f.dropshipOnly === 'Y') {
    list = list.filter(p => p.item.isDropShippingAvailable);
  }

  // 6. 수익성 등급 필터
  if (f.passOnly === 'pass') {
    list = list.filter(p => p.calc.candidateTier === 'PASS');
  } else if (f.passOnly === 'pass_review') {
    list = list.filter(p => p.calc.candidateTier === 'PASS' || p.calc.candidateTier === 'REVIEW');
  }

  // 7. 정렬
  switch (f.sort) {
    case 'profit_desc':
      list.sort((a, b) => b.calc.basicNetProfit - a.calc.basicNetProfit);
      break;
    case 'margin_desc':
      list.sort((a, b) => b.calc.marginRate - a.calc.marginRate);
      break;
    case 'roi_desc':
      list.sort((a, b) => b.calc.roi - a.calc.roi);
      break;
    case 'price_asc':
      list.sort((a, b) => a.item.wholesalePrice - b.item.wholesalePrice);
      break;
  }

  state.filteredProducts = list;
}

/* -------------------------------------------------------------------------- */
/* 3. Render Sourcing Dashboard Table                                         */
/* -------------------------------------------------------------------------- */
function renderAll() {
  recalculateAllProducts();
  applyFiltersAndSort();
  renderHeaderStats();
  renderSourcingTable();
}

function renderHeaderStats() {
  let passCnt = 0, reviewCnt = 0, excludeCnt = 0;
  state.products.forEach(p => {
    if (p.calc.candidateTier === 'PASS') passCnt++;
    else if (p.calc.candidateTier === 'REVIEW') reviewCnt++;
    else excludeCnt++;
  });

  const bookmarks = BookmarkStore.getBookmarks();

  document.getElementById('stat-total-cnt').textContent = state.products.length;
  document.getElementById('stat-pass-cnt').textContent = passCnt;
  document.getElementById('stat-review-cnt').textContent = reviewCnt;
  document.getElementById('stat-exclude-cnt').textContent = excludeCnt;
  document.getElementById('stat-bookmark-cnt').textContent = bookmarks.length;
}

function renderSourcingTable() {
  const tbody = document.getElementById('sourcing-table-body');
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
    const isBookmarked = BookmarkStore.isBookmarked(item.itemNo);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">
        <button class="btn-icon btn-bookmark ${isBookmarked ? 'active' : ''}" data-itemno="${item.itemNo}">
          ${isBookmarked ? '♥' : '♡'}
        </button>
      </td>
      <td>
        <img src="${item.imageUrl}" alt="${item.title}" class="img-thumb" />
      </td>
      <td>
        <div style="font-weight: 600; font-size: 0.88rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span class="tag-mock">MOCK</span> ${item.title}
        </div>
        <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
          카테고리: ${configManager.config.categoryFees[item.categoryCode]?.name || '기타'} | ID: ${item.itemNo}
          ${item.isDropShippingAvailable ? '<span style="color:var(--accent-blue); margin-left: 6px;">[위탁가능]</span>' : ''}
        </div>
      </td>
      <td>${item.wholesalePrice.toLocaleString()}원</td>
      <td>${item.wholesaleShippingFee.toLocaleString()}원</td>
      <td>
        <input type="number" class="price-input input-coupang-price" data-itemno="${item.itemNo}" value="${p.coupangPrice}" step="100" /> 원
      </td>
      <td style="color: var(--text-muted);">${calc.coupangFee.toLocaleString()}원</td>
      <td>${calc.totalCost.toLocaleString()}원</td>
      <td style="font-weight: 700; color: var(--accent-green);">${calc.basicNetProfit.toLocaleString()}원</td>
      <td style="color: #7dd3fc;">${calc.conservativeNetProfit.toLocaleString()}원</td>
      <td style="color: var(--accent-yellow); font-weight: 600;">${calc.marginRate}%</td>
      <td style="color: var(--accent-blue); font-weight: 600;">${calc.roi}%</td>
      <td style="font-weight: 700; color: #a855f7;">하루 ${calc.dailyRequiredQty}개</td>
      <td style="text-align: center;">
        <span class="badge-tier badge-${calc.candidateTier.toLowerCase()}">${calc.candidateTierName}</span>
      </td>
      <td style="text-align: center;">
        <button class="btn-icon btn-open-drawer" data-itemno="${item.itemNo}">⚙️ 시뮬</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // 이벤트 바인딩 (쿠팡가 즉시 수정 인풋 & 찜 버튼 & Drawer)
  tbody.querySelectorAll('.input-coupang-price').forEach(input => {
    input.addEventListener('input', (e) => {
      const itemNo = e.target.getAttribute('data-itemno');
      const val = Number(e.target.value || 0);
      const targetP = state.products.find(p => String(p.item.itemNo) === String(itemNo));
      if (targetP) {
        targetP.coupangPrice = val;
        renderAll();
      }
    });
  });

  tbody.querySelectorAll('.btn-bookmark').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemNo = btn.getAttribute('data-itemno');
      const targetP = state.products.find(p => String(p.item.itemNo) === String(itemNo));
      if (targetP) {
        BookmarkStore.toggleBookmark(targetP.item, targetP.calc);
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

/* -------------------------------------------------------------------------- */
/* 4. Filter & Sort Event Controls                                            */
/* -------------------------------------------------------------------------- */
function initFilterControls() {
  document.getElementById('flt-category').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    renderAll();
  });

  document.getElementById('flt-max-price').addEventListener('input', (e) => {
    state.filters.maxPrice = e.target.value ? Number(e.target.value) : null;
    renderAll();
  });

  document.getElementById('flt-min-profit').addEventListener('input', (e) => {
    state.filters.minProfit = e.target.value ? Number(e.target.value) : null;
    renderAll();
  });

  document.getElementById('flt-min-margin').addEventListener('input', (e) => {
    state.filters.minMargin = e.target.value ? Number(e.target.value) : null;
    renderAll();
  });

  document.getElementById('flt-dropship').addEventListener('change', (e) => {
    state.filters.dropshipOnly = e.target.value;
    renderAll();
  });

  document.getElementById('flt-pass-only').addEventListener('change', (e) => {
    state.filters.passOnly = e.target.value;
    renderAll();
  });

  document.getElementById('flt-sort').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderAll();
  });
}

/* -------------------------------------------------------------------------- */
/* 5. Bookmarks Tab                                                           */
/* -------------------------------------------------------------------------- */
function initBookmarkTab() {
  renderBookmarks();
}

function renderBookmarks() {
  const tbody = document.getElementById('bookmark-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const bookmarks = BookmarkStore.getBookmarks();

  if (bookmarks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
          ♥ 저장된 관심상품이 없습니다. 상품 대시보드에서 하트(♥) 버튼을 눌러 저장해 보세요.
        </td>
      </tr>`;
    return;
  }

  bookmarks.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${b.imageUrl}" alt="${b.title}" class="img-thumb" /></td>
      <td>
        <div style="font-weight: 600;"><span class="tag-mock">MOCK</span> ${b.title}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${b.itemNo}</div>
      </td>
      <td>${b.wholesalePrice.toLocaleString()}원</td>
      <td>${b.coupangPrice.toLocaleString()}원</td>
      <td style="font-weight: 700; color: var(--accent-green);">${b.basicNetProfit.toLocaleString()}원</td>
      <td style="color: #7dd3fc;">${b.conservativeNetProfit.toLocaleString()}원</td>
      <td style="color: var(--accent-yellow); font-weight: 600;">${b.marginRate}%</td>
      <td style="color: var(--accent-blue); font-weight: 600;">${b.roi}%</td>
      <td style="font-size: 0.78rem; color: var(--text-muted);">${new Date(b.savedAt).toLocaleDateString()}</td>
      <td style="text-align: center;">
        <button class="btn-icon btn-remove-bm" data-itemno="${b.itemNo}" style="color: var(--accent-red); border-color: var(--accent-red);">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-remove-bm').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemNo = btn.getAttribute('data-itemno');
      BookmarkStore.removeBookmark(itemNo);
      renderBookmarks();
      renderAll();
    });
  });
}

/* -------------------------------------------------------------------------- */
/* 6. Detail Simulator Tab                                                    */
/* -------------------------------------------------------------------------- */
function initSimulatorTab() {
  const selectProd = document.getElementById('sim-product-select');
  const inputWholesale = document.getElementById('sim-wholesale-price');
  const inputShipping = document.getElementById('sim-wholesale-shipping');
  const inputCoupang = document.getElementById('sim-coupang-price');
  const selectCat = document.getElementById('sim-category-select');
  const selectShipType = document.getElementById('sim-shipping-type');
  const inputAdSpend = document.getElementById('sim-ad-spend');
  const inputReturnRate = document.getElementById('sim-return-rate');

  // 상품 선택 셀렉트 옵션 바인딩
  selectProd.innerHTML = '';
  state.products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.item.itemNo;
    opt.textContent = `${p.item.title} (도매가: ${p.item.wholesalePrice.toLocaleString()}원)`;
    selectProd.appendChild(opt);
  });

  selectProd.addEventListener('change', () => {
    const targetP = state.products.find(p => String(p.item.itemNo) === String(selectProd.value));
    if (targetP) {
      inputWholesale.value = targetP.item.wholesalePrice;
      inputShipping.value = targetP.item.wholesaleShippingFee;
      inputCoupang.value = targetP.coupangPrice;
      selectCat.value = targetP.item.categoryCode || '1002';
      runSimulation();
    }
  });

  [inputWholesale, inputShipping, inputCoupang, selectCat, selectShipType, inputAdSpend, inputReturnRate].forEach(elem => {
    elem?.addEventListener('input', runSimulation);
    elem?.addEventListener('change', runSimulation);
  });

  // 초기 1회 바인딩
  if (state.products.length > 0) {
    selectProd.value = state.products[0].item.itemNo;
    selectProd.dispatchEvent(new Event('change'));
  }
}

function runSimulation() {
  const selectProd = document.getElementById('sim-product-select');
  const itemNo = selectProd.value;
  const targetP = state.products.find(p => String(p.item.itemNo) === String(itemNo));
  if (!targetP) return;

  const wholesalePrice = Number(document.getElementById('sim-wholesale-price').value || 0);
  const wholesaleShippingFee = Number(document.getElementById('sim-wholesale-shipping').value || 0);
  const coupangPrice = Number(document.getElementById('sim-coupang-price').value || 0);
  const categoryCode = document.getElementById('sim-category-select').value;
  const shippingType = document.getElementById('sim-shipping-type').value;
  const customAdSpend = Number(document.getElementById('sim-ad-spend').value || 1500);
  const customReturnRate = Number(document.getElementById('sim-return-rate').value || 0.02);

  const calc = MarginCalculator.calculate({
    coupangPrice,
    wholesalePrice,
    wholesaleShippingFee,
    categoryCode,
    shippingType,
    customAdSpend,
    customReturnRate
  });

  document.getElementById('sim-basic-profit').textContent = `${calc.basicNetProfit.toLocaleString()} 원`;
  document.getElementById('sim-conservative-profit').textContent = `${calc.conservativeNetProfit.toLocaleString()} 원`;
  document.getElementById('sim-margin-roi').textContent = `${calc.marginRate}% / ${calc.roi}%`;
  document.getElementById('sim-coupang-fee').textContent = `${calc.coupangFee.toLocaleString()} 원 (${(calc.feeRate * 100).toFixed(2)}%)`;
  document.getElementById('sim-actual-shipping').textContent = `${calc.actualShippingCost.toLocaleString()} 원 (${calc.shippingNote})`;
  document.getElementById('sim-total-cost').textContent = `${calc.totalCost.toLocaleString()} 원`;
  document.getElementById('sim-bulk-profit').textContent = `${calc.qty10Profit.toLocaleString()} 원 / ${calc.qty30Profit.toLocaleString()} 원`;
  document.getElementById('sim-required-qty').textContent = `하루 ${calc.dailyRequiredQty} 개`;

  const tierBadge = document.getElementById('sim-tier-badge');
  tierBadge.textContent = calc.candidateTierName;
  tierBadge.className = `badge-tier badge-${calc.candidateTier.toLowerCase()}`;
}

/* -------------------------------------------------------------------------- */
/* 7. Settings Tab                                                            */
/* -------------------------------------------------------------------------- */
function initSettingsTab() {
  const cfg = configManager.config;

  document.getElementById('cfg-target-daily').value = cfg.targets.dailyNetProfit;
  document.getElementById('cfg-pass-profit').value = cfg.tiers.passMinProfit;
  document.getElementById('cfg-review-profit').value = cfg.tiers.reviewMinProfit;
  document.getElementById('cfg-ad-spend').value = cfg.conservativeLoss.adSpendPerUnit;
  document.getElementById('cfg-return-rate').value = cfg.conservativeLoss.returnRate;
  document.getElementById('cfg-service-fee').value = cfg.monthlyOverhead.coupangServiceFee;

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    configManager.saveConfig({
      targets: { dailyNetProfit: Number(document.getElementById('cfg-target-daily').value) },
      tiers: {
        passMinProfit: Number(document.getElementById('cfg-pass-profit').value),
        reviewMinProfit: Number(document.getElementById('cfg-review-profit').value)
      },
      conservativeLoss: {
        adSpendPerUnit: Number(document.getElementById('cfg-ad-spend').value),
        returnRate: Number(document.getElementById('cfg-return-rate').value)
      },
      monthlyOverhead: {
        ...configManager.config.monthlyOverhead,
        coupangServiceFee: Number(document.getElementById('cfg-service-fee').value)
      }
    });

    alert('✅ 동적 설정이 LocalStorage에 성공적으로 저장되었습니다!');
    renderAll();
  });

  document.getElementById('btn-reset-settings').addEventListener('click', () => {
    if (confirm('모든 설정을 기본값(하루 목표 30만원, 판매후보 2만원 등)으로 초기화하시겠습니까?')) {
      configManager.resetConfig();
      initSettingsTab();
      renderAll();
      alert('🔄 설정이 기본값으로 초기화되었습니다.');
    }
  });
}

/* -------------------------------------------------------------------------- */
/* 8. Drawer Modal Controls                                                   */
/* -------------------------------------------------------------------------- */
function initDrawer() {
  const modal = document.getElementById('detail-modal');
  const closeBtn = document.getElementById('btn-close-drawer');

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
    }
  });
}

function openDrawerForItem(itemNo) {
  const targetP = state.products.find(p => String(p.item.itemNo) === String(itemNo));
  if (!targetP) return;

  const modal = document.getElementById('detail-modal');
  const title = document.getElementById('drawer-title');
  const content = document.getElementById('drawer-content');

  title.textContent = `[상세분석] ${targetP.item.title}`;

  const c = targetP.calc;
  content.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px;">
      <img src="${targetP.item.imageUrl}" style="width: 120px; height: 120px; border-radius: 12px; object-fit: cover;" />
    </div>

    <div class="card" style="margin-bottom: 14px;">
      <div style="font-size: 0.85rem; color: var(--text-muted);">후보 등급</div>
      <div style="font-size: 1.3rem; font-weight: 700; margin-top: 4px;">
        <span class="badge-tier badge-${c.candidateTier.toLowerCase()}">${c.candidateTierName}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span>수익성 지표 요약</span></div>
      <table class="product-table">
        <tbody>
          <tr><th>도매가 / 배송비</th><td>${targetP.item.wholesalePrice.toLocaleString()}원 / ${targetP.item.wholesaleShippingFee.toLocaleString()}원</td></tr>
          <tr><th>쿠팡 판매가</th><td>${c.coupangPrice.toLocaleString()}원</td></tr>
          <tr><th>쿠팡 수수료</th><td>${c.coupangFee.toLocaleString()}원 (${(c.feeRate*100).toFixed(2)}%)</td></tr>
          <tr><th>기본 순이익</th><td style="font-weight:700; color:var(--accent-green);">${c.basicNetProfit.toLocaleString()}원</td></tr>
          <tr><th>보수적 순이익</th><td style="color:#7dd3fc;">${c.conservativeNetProfit.toLocaleString()}원</td></tr>
          <tr><th>마진율 / ROI</th><td>${c.marginRate}% / ${c.roi}%</td></tr>
          <tr><th>하루 30만원 달성량</th><td style="color:var(--accent-blue); font-weight:700;">하루 ${c.dailyRequiredQty}개</td></tr>
        </tbody>
      </table>
    </div>

    <div class="alert alert-warning">
      💡 <strong>배송 구조</strong>: ${c.shippingNote}<br/>
      🛡️ <strong>월 고정비 안내</strong>: ${c.monthlyOverheadNotice}
    </div>
  `;

  modal.classList.add('open');
}
