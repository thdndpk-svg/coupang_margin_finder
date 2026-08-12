/**
 * STEP 1: 도매꾹/도매매 공식 Open API JSON 응답 파싱 및 데이터 모델
 * - getItemList v4.1 & getItemView v4.6 실제 JSON 필드 명세 반영
 */

export class DomeProductModel {
  constructor(data = {}, sourceMode = 'getItemList') {
    if (sourceMode === 'getItemList') {
      this.parseFromItemListV41(data);
    } else if (sourceMode === 'getItemView') {
      this.parseFromItemViewV46(data);
    } else {
      this.parseGeneric(data);
    }
  }

  /**
   * getItemList v4.1 실제 JSON 필드 매핑
   * - no: 상품번호
   * - title: 상품제목
   * - price: 도매공급가
   * - deliPrice: 배송비
   * - thumb: 이미지 URL
   * - seller: 공급자 아이디
   * - category: 카테고리 코드
   * - agencyFlag: 위탁배송 여부 (Y/N)
   */
  parseFromItemListV41(item) {
    if (item.errors) {
      this.hasError = true;
      this.errorCode = item.errors.code || 'UNKNOWN';
      this.errorMessage = item.errors.dmessage || item.errors.message || 'API 오류 발생';
      return;
    }
    this.itemNo = String(item.no || '');
    this.title = String(item.title || '');
    this.wholesalePrice = Number(item.price || 0);
    this.wholesaleShippingFee = Number(item.deliPrice || 0);
    this.imageUrl = item.thumb || '';
    this.sellerId = item.seller || '';
    this.categoryCode = item.category || 'default';
    this.isDropShippingAvailable = (item.agencyFlag === 'Y');
    this.minOrderQty = 1;
    this.productUrl = this.itemNo ? `https://domeggook.com/${this.itemNo}` : '';
    this.rawResponse = item;
  }

  /**
   * getItemView v4.6 실제 JSON 필드 매핑
   * - basis: { no, title, price, status, img }
   * - ship: { deliFee, type }
   * - qty: { minQty }
   * - deliv: { agencyFlag }
   * - option: { list }
   */
  parseFromItemViewV46(view) {
    const basis = view.basis || {};
    const ship = view.ship || {};
    const qty = view.qty || {};
    const deliv = view.deliv || {};

    this.itemNo = String(basis.no || '');
    this.title = String(basis.title || '');
    this.wholesalePrice = Number(basis.price || 0);
    this.wholesaleShippingFee = Number(ship.deliFee || 0);
    this.imageUrl = basis.img || basis.thumb || '';
    this.sellerId = view.sellerId || basis.sellerId || '';
    this.categoryCode = basis.category || 'default';
    this.isDropShippingAvailable = (deliv.agencyFlag === 'Y');
    this.minOrderQty = Number(qty.minQty || 1);
    this.shippingType = ship.type || '선불';
    this.status = basis.status || '판매중';
    this.options = view.option?.list || [];
    this.productUrl = this.itemNo ? `https://domeggook.com/${this.itemNo}` : '';
    this.rawResponse = view;
  }

  parseGeneric(data) {
    this.itemNo = String(data.itemNo || data.no || '');
    this.title = data.title || '';
    this.wholesalePrice = Number(data.wholesalePrice || data.price || 0);
    this.wholesaleShippingFee = Number(data.wholesaleShippingFee || data.deliPrice || data.deliFee || 0);
    this.imageUrl = data.imageUrl || data.thumb || data.img || '';
    this.sellerId = data.sellerId || data.seller || '';
    this.categoryCode = data.categoryCode || data.category || 'default';
    this.isDropShippingAvailable = Boolean(data.isDropShippingAvailable ?? true);
    this.minOrderQty = Number(data.minOrderQty || 1);
    this.productUrl = data.productUrl || (this.itemNo ? `https://domeggook.com/${this.itemNo}` : '');
    this.rawResponse = data;
  }
}
