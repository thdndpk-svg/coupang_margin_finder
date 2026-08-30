/**
 * STEP 2.1.1: 메인 대시보드 컨트롤러 (main.js)
 * - Build SHA 자동 반영
 * - 달성불가(null) 표기 완전 보장 (절대 0개 표시 안 함)
 * - v2.1.1 수수료 및 원가 미확인 상태 대응
 */

import { domeApiClient } from './api.js';
import { MarginCalculator, SHIPPING_TYPES } from './calculator.js';
import { configManager } from './config.js';
import { bookmarkStore } from './storage.js';

// Build SHA 자동 주입
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || 'dev';

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

function updateBuildShaDisplay() {
  const shaElements = document.querySelectorAll('.build-sha-tag');
  shaElements.forEach(el => {
    el.textContent = `v2.1.1 · Build ${BUILD_SHA}`;
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
    const defaultCoupangPrice = item.userCoupangPrice ?? (item.wholesalePrice ? Math.round((item.wholesalePrice + (item.wholesaleShippingFee || 0)) * 1.5 / 100) * 100 : null);
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
      product: p.item,
      userCoupangPrice: p.coupangPrice,
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
    list = list.filter(p => p.item.wholesalePrice !== null && p.item.wholesalePrice <= f.maxPrice);
  }

  // 3. 최소 기본 상품이익
  if (f.minProfit !== null && !isNaN(f.minProfit) && f.minProfit > 0) {
    list = list.filter(p => p.calc.basicProfit !== null && p.calc.basicProfit >= f.minProfit);
  }

  // 4. 최소 마진율
  if (f.minMargin !== null && !isNaN(f.minMargin) && f.minMargin > 0) {
    list = list.filter(p => p.calc.marginRate !== null && p.calc.marginRate >= f.minMargin);
  }

  // 5. 위탁 전용
  if (f.dropshipOnly === 'Y') {
    list = list.filter(p => p.item.isDropShippingAvailable);
  }

  // 6. 수익성 등급 필터
  if (f.passOnly === 'pass') {
    list = list.filter(p => p.calc.profitTier && p.calc.profitTier.id === 'GRADE_A');
  } else if (f.passOnly === 'pass_review') {
    list = list.filter(p => p.calc.profitTier && (p.calc.profitTier.id === 'GRADE_A' || p.calc.profitTier.id === 'GRADE_B'));
  }

  // 7. 정렬
  switch (f.sort) {
    case 'profit_desc':
      list.sort((a, b) => (b.calc.basicProfit || 0) - (a.calc.basicProfit || 0));
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
    const isBookmarked = bookmarkStore.isBookmarked(item.itemNo);

    // 필요수량 표기 (null 일 경우 절대 0개 표기 금지 -> '달성불가')
    const reqQtyText = calc.requiredDailySales !== null ? `${calc.requiredDailySales}개/일` : '달성불가';

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
          ${item.isMock ? '<span class="tag-mock">MOCK</span>' : ''} ${item.title || '제목없음'}
        </div>
        <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
          카테고리: ${configManager.config.categoryFees[item.categoryCode]?.name || '기타'} | ID: ${item.itemNo}
          <span style="color:var(--accent-blue); margin-left: 6px;">[${item.channelLabel}]</span>
          ${item.supplyUnitStatus === '구성확인필요' ? '<span style="color:var(--accent-yellow); margin-left: 4px;">[구성확인필요]</span>' : ''}
        </div>
      </td>
      <td>${item.wholesalePrice !== null ? item.wholesalePrice.toLocaleString() + '원' : '확인필요'}</td>
      <td>${item.wholesaleShippingFee !== null ? item.wholesaleShippingFee.toLocaleString() + '원' : '<span style="color:var(--accent-yellow);">확인필요</span>'}</td>
      <td>
        <input type="number" class="price-input input-coupang-price" data-itemno="${item.itemNo}" value="${p.coupangPrice || ''}" placeholder="입력" step="100" /> 원
      </td>
      <td style="color: var(--text-muted);">${calc.coupangFee !== null ? calc.coupangFee.toLocaleString() + '원' : '-'}</td>
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

  // 이벤트 바인딩 (쿠팡가 수동 수정 & 찜 버튼 & Drawer)
  tbody.querySelectorAll('.input-coupang-price').forEach(input => {
    input.addEventListener('input', (e) => {
      const itemNo = e.target.getAttribute('data-itemno');
      const val = e.target.value !== '' ? Number(e.target.value) : null;
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
        bookmarkStore.toggleBookmark({
          itemNo: targetP.item.itemNo,
          title: targetP.item.title,
          wholesalePrice: targetP.item.wholesalePrice,
          wholesaleShippingFee: targetP.item.wholesaleShippingFee,
          userCoupangPrice: targetP.coupangPrice,
          categoryCode: targetP.item.categoryCode,
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
    state.filters.maxPrice = e.target.value !== '' ? Number(e.target.value) : null;
    renderAll();
  });
  document.getElementById('flt-min-profit').addEventListener('input', e => {
    state.filters.minProfit = e.target.value !== '' ? Number(e.target.value) : null;
    renderAll();
  });
  document.getElementById('flt-min-margin').addEventListener('input', e => {
    state.filters.minMargin = e.target.value !== '' ? Number(e.target.value) : null;
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

function initBookmarkTab() {}
function renderBookmarks() {}
function initSimulatorTab() {}
function initSettingsTab() {}
function initDrawer() {}
function openDrawerForItem(itemNo) {}
