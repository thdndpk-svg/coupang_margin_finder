/**
 * STEP 2.1: 도매꾹/도매매 getItemView v4.6 공식 API 응답 데이터 파싱 모델 (models.js)
 */

export class DomeProductModel {
  static parseSupplyPrice(priceSupply, orderQty = 1) {
    if (priceSupply === undefined || priceSupply === null || priceSupply === '') {
      return { unitPrice: 0, pricingType: '가격확인필요', rawValue: priceSupply, isExact: false };
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

    return { unitPrice: 0, pricingType: '가격확인필요', rawValue: priceSupply, isExact: false };
  }

  static parseShippingFee(rawData, orderQty = 1) {
    const deli = rawData.deli?.supply || rawData.deli?.dome || rawData.deli || rawData.ship || {};

    const payType = deli.pay || '선불';
    const deliType = deli.type || '고정';
    const rawFee = deli.fee ?? rawData.wholesaleShippingFee;
    const tbl = deli.tbl;

    if (rawFee !== undefined && rawFee !== null && !isNaN(Number(rawFee))) {
      return { fee: Number(rawFee), type: `${deliType}배송비`, status: '확인됨', isExact: true };
    }

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

    if (deliType === '금액비노출') {
      return { fee: 0, type: '배송비확인필요', status: '미확인', isExact: false };
    }

    return { fee: 3000, type: '기본배송비', status: '확인됨', isExact: true };
  }

  constructor(rawData = {}) {
    this.raw = rawData;
    this.isMock = Boolean(rawData.isMock || rawData._isMock);

    // 에러 파싱
    this.hasError = Boolean(rawData.errors || rawData.error);

    // 1. getItemView v4.6 실제 필드 파싱 (basis.no, basis.status, basis.title)
    const basis = rawData.basis || rawData;
    this.itemNo = String(basis.no || rawData.itemNo || '000000');
    this.title = String(basis.title || rawData.title || '제목 없음');
    this.status = String(basis.status || rawData.status || '판매중');

    // 2. 가격 파싱 (price.supply, price.resale.minumum, price.resale.Recommand)
    // 주의: 도매매 공식 API 문서 필드명 그대로 적용 (minumum & Recommand)
    const priceObj = rawData.price || {};
    const priceSupplyRaw = priceObj.supply ?? rawData.wholesalePrice;
    const parsedSupply = DomeProductModel.parseSupplyPrice(priceSupplyRaw);

    this.wholesalePrice = rawData.wholesalePrice !== undefined
      ? Number(rawData.wholesalePrice)
      : Number(parsedSupply.unitPrice || 0);
    this.pricingType = parsedSupply.pricingType;
    this.isPriceExact = parsedSupply.isExact || rawData.wholesalePrice !== undefined;

    this.minResalePrice = Number(priceObj.resale?.minumum ?? priceObj.resale?.minimum ?? rawData.minResalePrice ?? 0);
    this.recommendResalePrice = Number(priceObj.resale?.Recommand ?? priceObj.resale?.recommand ?? rawData.recommendResalePrice ?? 0);

    // 3. 배송비 파싱 (deli.supply.type / fee / tbl 파서)
    const parsedShipping = DomeProductModel.parseShippingFee(rawData);
    this.wholesaleShippingFee = rawData.wholesaleShippingFee !== undefined
      ? Number(rawData.wholesaleShippingFee)
      : Number(parsedShipping.fee || 0);
    this.shippingTypeLabel = parsedShipping.type;
    this.isShippingExact = parsedShipping.isExact || rawData.wholesaleShippingFee !== undefined;

    // 4. 수량 & 공급단위 파싱 (qty.inventory, qty.supplyUnit)
    const qtyObj = rawData.qty || {};
    this.inventoryQty = Number(qtyObj.inventory ?? rawData.inventoryQty ?? 999);
    this.supplyUnit = Number(qtyObj.supplyUnit ?? rawData.supplyUnit ?? 1);
    this.supplyUnitStatus = this.supplyUnit > 1 ? '구성확인필요' : '단건공급';

    // 5. 공급사 정보 (seller.rank, seller.vacation)
    const sellerObj = rawData.seller || {};
    this.sellerRank = Number(sellerObj.rank ?? rawData.sellerRank ?? 1);
    this.sellerVacation = Boolean(sellerObj.vacation ?? rawData.sellerVacation);

    // 6. 도매매 판매채널 파싱 (channel.supply - boolean 공식 타입 지원)
    const channelObj = rawData.channel || {};
    const channelSupply = channelObj.supply ?? rawData.channelSupply;

    if (channelSupply === true) {
      this.dropShippingStatus = '위탁 가능';
      this.channelLabel = '도매매 판매중';
    } else if (channelSupply === false) {
      this.dropShippingStatus = '위탁 불가';
      this.channelLabel = '도매매 판매중 아님';
    } else if (channelSupply === 'Y' || channelSupply === 'true') {
      this.dropShippingStatus = '위탁 가능';
      this.channelLabel = '도매매 판매중';
    } else if (channelSupply === 'N' || channelSupply === 'false') {
      this.dropShippingStatus = '위탁 불가';
      this.channelLabel = '도매매 판매중 아님';
    } else {
      this.dropShippingStatus = '확인 필요';
      this.channelLabel = '확인 필요';
    }
    this.isDropShippingAvailable = this.dropShippingStatus === '위탁 가능';

    // 7. 이미지 사용권 파싱 (desc.license.usable)
    const descObj = rawData.desc || {};
    const licenseUsable = descObj.license?.usable ?? rawData.imageLicenseStatus;
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
    this.itemUrl = `https://domeggook.com/${this.itemNo}`;

    const categoryObj = rawData.category || {};
    this.categoryCode = String(categoryObj.current || rawData.categoryCode || '1002');

    // 9. 사용자 쿠팡가
    this.userCoupangPrice = Number(
      rawData.userCoupangPrice ??
      (this.wholesalePrice > 0 ? Math.round((this.wholesalePrice + this.wholesaleShippingFee) * 1.5 / 100) * 100 : 0)
    );
  }
}
