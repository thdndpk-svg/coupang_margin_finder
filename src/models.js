/**
 * STEP 2.1.1: 도매꾹/도매매 getItemView v4.6 공식 API 응답 데이터 파싱 모델 (models.js)
 * - 배송비 3,000원 및 판매중/재고999개/1등급 가짜 기본값 전면 제거
 * - 차등/비례 배송비 tbl 우선 해석
 * - production parser와 MOCK 어댑터 분리
 */

export class DomeProductModel {
  /**
   * 수량별 차등가격 파서 (1+3800|20+3500|50+3300 또는 정수형 파싱)
   */
  static parseSupplyPrice(priceSupply, orderQty = 1) {
    if (priceSupply === undefined || priceSupply === null || priceSupply === '') {
      return { unitPrice: null, pricingType: '가격확인필요', rawValue: priceSupply, isExact: false };
    }

    if (typeof priceSupply === 'number' || (!String(priceSupply).includes('+') && !isNaN(Number(priceSupply)))) {
      const price = Number(priceSupply);
      return { unitPrice: price, pricingType: '고정가', rawValue: priceSupply, isExact: true };
    }

    try {
      const parts = String(priceSupply).split('|');
      let matchedPrice = null;
      let minQtyPrice = null;

      for (const part of parts) {
        const [qtyStr, pStr] = part.split('+');
        const qtyThreshold = Number(qtyStr);
        const priceVal = Number(pStr);

        if (!isNaN(qtyThreshold) && !isNaN(priceVal)) {
          if (minQtyPrice === null) minQtyPrice = priceVal;
          if (orderQty >= qtyThreshold) {
            matchedPrice = priceVal;
          }
        }
      }

      const finalPrice = matchedPrice ?? minQtyPrice;
      if (finalPrice !== null) {
        return { unitPrice: finalPrice, pricingType: '수량별차등', rawValue: priceSupply, isExact: true };
      }
    } catch (e) {
      console.warn('차등가격 파싱 실패:', e);
    }

    return { unitPrice: null, pricingType: '가격확인필요', rawValue: priceSupply, isExact: false };
  }

  /**
   * 배송비 파서 - deli.type을 최우선 확인
   */
  static parseShippingFee(rawData, orderQty = 1) {
    const deli = rawData.deli?.supply || rawData.deli?.dome || rawData.deli || {};

    const payType = deli.pay || '선불';
    const deliType = deli.type;
    const rawFee = deli.fee;
    const tbl = deli.tbl;

    // 1. 차등배송비 / 비례배송비: tbl이 존재하는 경우 tbl을 최우선 파싱
    if ((deliType === '차등' || deliType === '비례') && tbl) {
      try {
        const parts = String(tbl).split('|');
        let matchedFee = null;
        for (const part of parts) {
          const [qtyStr, fStr] = part.split('+');
          if (orderQty >= Number(qtyStr)) matchedFee = Number(fStr);
        }
        if (matchedFee !== null) {
          return { fee: matchedFee, type: `${deliType}배송비`, status: '확인됨', isExact: true };
        }
      } catch (e) {
        console.warn('배송비 테이블 파싱 실패:', e);
      }
    }

    // 2. 고정배송비: fee가 숫자인 경우 사용
    if (deliType === '고정' && rawFee !== undefined && rawFee !== null && !isNaN(Number(rawFee))) {
      return { fee: Number(rawFee), type: '고정배송비', status: '확인됨', isExact: true };
    }

    // 3. 고정/차등 구분 없이 fee가 숫자인 경우
    if (rawFee !== undefined && rawFee !== null && !isNaN(Number(rawFee))) {
      return { fee: Number(rawFee), type: `${deliType || '고정'}배송비`, status: '확인됨', isExact: true };
    }

    // 4. 금액비노출 또는 데이터 미확인시 절대로 3,000원을 임의 생성하지 않음!
    return { fee: null, type: '배송비확인필요', status: '미확인', isExact: false };
  }

  constructor(rawData = {}) {
    this.raw = rawData;
    this.isMock = Boolean(rawData.isMock || rawData._isMock);

    // 에러 파싱
    this.hasError = Boolean(rawData.errors || rawData.error);

    // 1. getItemView v4.6 실제 필드 파싱 (basis.no, basis.status, basis.title)
    const basis = rawData.basis || (this.isMock ? rawData : {});
    this.itemNo = String(basis.no || rawData.itemNo || '');

    // basis.title: 존재하지 않으면 null
    this.title = basis.title || (this.isMock ? rawData.title : null);

    // basis.status: 존재하지 않으면 null (임의 '판매중' 금지!)
    this.status = basis.status !== undefined ? String(basis.status) : (this.isMock ? String(rawData.status || '판매중') : null);
    this.statusLabel = this.status ? this.status : '확인필요';

    // 2. 가격 파싱 (price.supply, price.resale.minumum, price.resale.Recommand)
    const priceObj = rawData.price || {};
    const priceSupplyRaw = priceObj.supply ?? (this.isMock ? rawData.wholesalePrice : undefined);
    const parsedSupply = DomeProductModel.parseSupplyPrice(priceSupplyRaw);

    this.wholesalePrice = parsedSupply.unitPrice !== null
      ? parsedSupply.unitPrice
      : (this.isMock && rawData.wholesalePrice !== undefined ? Number(rawData.wholesalePrice) : null);

    this.pricingType = parsedSupply.pricingType;
    this.isPriceExact = parsedSupply.isExact;

    // 공식 API 문서 필드명 (minumum & Recommand)
    this.minResalePrice = priceObj.resale?.minumum !== undefined
      ? Number(priceObj.resale.minumum)
      : (priceObj.resale?.minimum !== undefined ? Number(priceObj.resale.minimum) : (this.isMock ? Number(rawData.minResalePrice || 0) : null));

    this.recommendResalePrice = priceObj.resale?.Recommand !== undefined
      ? Number(priceObj.resale.Recommand)
      : (priceObj.resale?.recommand !== undefined ? Number(priceObj.resale.recommand) : (this.isMock ? Number(rawData.recommendResalePrice || 0) : null));

    // 3. 배송비 파싱 (deli.supply.type / fee / tbl 파서)
    const parsedShipping = DomeProductModel.parseShippingFee(rawData);
    this.wholesaleShippingFee = parsedShipping.fee !== null
      ? parsedShipping.fee
      : (this.isMock && rawData.wholesaleShippingFee !== undefined ? Number(rawData.wholesaleShippingFee) : null);

    this.shippingTypeLabel = parsedShipping.type;
    this.isShippingExact = parsedShipping.isExact;

    // 4. 수량 & 공급단위 파싱 (qty.inventory, qty.supplyUnit)
    const qtyObj = rawData.qty || {};

    // inventory: 데이터 없으면 null (임의 999개 금지!)
    this.inventoryQty = qtyObj.inventory !== undefined && qtyObj.inventory !== null
      ? Number(qtyObj.inventory)
      : (this.isMock && rawData.inventoryQty !== undefined ? Number(rawData.inventoryQty) : null);

    this.inventoryStatusLabel = this.inventoryQty !== null ? `${this.inventoryQty.toLocaleString()}개` : '재고확인필요';

    // supplyUnit: 데이터 없으면 null
    if (qtyObj.supplyUnit !== undefined && qtyObj.supplyUnit !== null) {
      this.supplyUnit = Number(qtyObj.supplyUnit);
    } else if (this.isMock && rawData.supplyUnit !== undefined) {
      this.supplyUnit = Number(rawData.supplyUnit);
    } else {
      this.supplyUnit = null;
    }

    if (this.supplyUnit === 1) {
      this.supplyUnitStatus = '단건공급';
    } else if (this.supplyUnit > 1) {
      this.supplyUnitStatus = '구성확인필요';
    } else {
      this.supplyUnitStatus = '공급단위확인필요';
    }

    // 5. 공급사 정보 (seller.rank, seller.vacation)
    const sellerObj = rawData.seller || {};

    // sellerRank: 데이터 없으면 null (임의 1등급 금지!)
    this.sellerRank = sellerObj.rank !== undefined && sellerObj.rank !== null
      ? Number(sellerObj.rank)
      : (this.isMock && rawData.sellerRank !== undefined ? Number(rawData.sellerRank) : null);

    this.sellerRankLabel = this.sellerRank !== null ? `${this.sellerRank}등급` : '확인필요';
    this.sellerVacation = sellerObj.vacation !== undefined ? Boolean(sellerObj.vacation) : (this.isMock ? Boolean(rawData.sellerVacation) : false);

    // 6. 도매매 판매채널 파싱 (channel.supply - boolean 공식 타입 지원)
    const channelObj = rawData.channel || {};
    const channelSupply = channelObj.supply ?? (this.isMock ? rawData.channelSupply : undefined);

    if (channelSupply === true || channelSupply === 'Y' || channelSupply === 'true') {
      this.dropShippingStatus = '위탁 가능';
      this.channelLabel = '도매매 판매중';
    } else if (channelSupply === false || channelSupply === 'N' || channelSupply === 'false') {
      this.dropShippingStatus = '위탁 불가';
      this.channelLabel = '도매매 판매중 아님';
    } else {
      this.dropShippingStatus = '확인 필요';
      this.channelLabel = '확인 필요';
    }
    this.isDropShippingAvailable = this.dropShippingStatus === '위탁 가능';

    // 7. 이미지 사용권 파싱 (desc.license.usable)
    const descObj = rawData.desc || {};
    const licenseUsable = descObj.license?.usable ?? (this.isMock ? rawData.imageLicenseStatus : undefined);
    if (licenseUsable === 'Y' || licenseUsable === true || licenseUsable === 'true') {
      this.imageLicenseStatus = '사용가능';
    } else if (licenseUsable === 'N' || licenseUsable === false || licenseUsable === 'false') {
      this.imageLicenseStatus = '사용불가';
    } else {
      this.imageLicenseStatus = '확인불가';
    }

    // 8. 썸네일 & 카테고리 (thumb.large, thumb.original, category.current)
    const thumbObj = rawData.thumb || {};
    this.imageUrl = thumbObj.large || thumbObj.original || rawData.imageUrl || 'https://via.placeholder.com/80';
    this.itemUrl = this.itemNo ? `https://domeggook.com/${this.itemNo}` : '#';

    const categoryObj = rawData.category || {};
    this.categoryCode = String(categoryObj.current || rawData.categoryCode || '1002');

    // 9. 사용자 쿠팡가 (실제 API 상품은 null, 사용자가 직접 입력해야 함)
    if (rawData.userCoupangPrice !== undefined && rawData.userCoupangPrice !== null) {
      this.userCoupangPrice = Number(rawData.userCoupangPrice);
      this.priceStatus = 'CONFIRMED_USER_INPUT';
    } else if (this.isMock && this.wholesalePrice !== null) {
      const fee = this.wholesaleShippingFee || 0;
      this.userCoupangPrice = Math.round((this.wholesalePrice + fee) * 1.5 / 100) * 100;
      this.priceStatus = 'TEMPORARY_SIMULATION';
    } else {
      this.userCoupangPrice = null;
      this.priceStatus = 'UNCONFIRMED';
    }
  }
}
