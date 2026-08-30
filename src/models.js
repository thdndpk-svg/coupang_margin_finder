/**
 * STEP 2.1.2: 도매꾹/도매매 getItemView v4.6 공식 API 응답 파서 & MOCK 어댑터 (models.js)
 * - 배송비 4가지 공식 type & pay 타입 처리
 * - 수량별차등 / 수량별비례 개별 파서 구현
 * - 가짜 기본값 (1002, 3000원, 999개, 1등급, 판매중) 전면 제거
 * - MOCK 데이터를 공식 v4.6 구조로 변환하는 MockDomeProductAdapter 분리
 */

export class DomeProductModel {
  /**
   * 수량별 차등가격 파서
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
   * 수량별차등 배송비 파서
   * tbl = "1+2500|20+2350|40+2100|60+2000"
   */
  static parseTieredShippingFee(tbl, orderQty = 1) {
    if (!tbl) return null;
    try {
      const parts = String(tbl).split('|');
      let matchedFee = null;
      for (const part of parts) {
        const [qtyStr, fStr] = part.split('+');
        if (orderQty >= Number(qtyStr)) {
          matchedFee = Number(fStr);
        }
      }
      return matchedFee;
    } catch (e) {
      console.warn('수량별차등 배송비 파싱 오류:', e);
      return null;
    }
  }

  /**
   * 수량별비례 배송비 파서
   * tbl = "50+2500|100+2000" (기본 50개까지 2,500원, 이후 초과 100개 단위마다 2,000원 추가)
   */
  static parseProportionalShippingFee(tbl, orderQty = 1) {
    if (!tbl) return null;
    try {
      const parts = String(tbl).split('|');
      if (parts.length === 0) return null;

      const [baseQtyStr, baseFeeStr] = parts[0].split('+');
      const baseQty = Number(baseQtyStr);
      const baseFee = Number(baseFeeStr);

      if (isNaN(baseQty) || isNaN(baseFee)) return null;

      if (orderQty <= baseQty) {
        return baseFee;
      }

      if (parts.length > 1) {
        const [stepQtyStr, stepFeeStr] = parts[1].split('+');
        const stepQty = Number(stepQtyStr);
        const stepFee = Number(stepFeeStr);

        if (!isNaN(stepQty) && !isNaN(stepFee) && stepQty > 0) {
          const extraUnits = Math.ceil((orderQty - baseQty) / stepQty);
          return baseFee + (extraUnits * stepFee);
        }
      }

      return baseFee;
    } catch (e) {
      console.warn('수량별비례 배송비 파싱 오류:', e);
      return null;
    }
  }

  /**
   * 공식 배송비 파서 (deli.supply.pay & deli.supply.type)
   */
  static parseShippingFee(rawData, orderQty = 1) {
    const deli = rawData.deli?.supply || rawData.deli?.dome || rawData.deli || {};

    const payType = deli.pay;
    const deliType = deli.type;
    const rawFee = deli.fee;
    const tbl = deli.tbl;

    // 1. 배송 결제 방식(pay) 최우선 확인
    if (payType === '무료배송') {
      return { fee: 0, type: '무료배송', status: '확인됨', isExact: true };
    }

    if (payType === '착불') {
      return { fee: null, type: '착불배송 확인필요', status: '미확인', isExact: false };
    }

    if (payType === '구매자선택') {
      return { fee: null, type: '배송조건 확인필요', status: '미확인', isExact: false };
    }

    // 2. 배송비 유형(type) 공식 문자열 처리
    if (deliType === '수량별차등' && tbl) {
      const fee = DomeProductModel.parseTieredShippingFee(tbl, orderQty);
      if (fee !== null) {
        return { fee, type: '수량별차등배송비', status: '확인됨', isExact: true };
      }
    }

    if (deliType === '수량별비례' && tbl) {
      const fee = DomeProductModel.parseProportionalShippingFee(tbl, orderQty);
      if (fee !== null) {
        return { fee, type: '수량별비례배송비', status: '확인됨', isExact: true };
      }
    }

    if ((deliType === '고정배송비' || deliType === '고정') && rawFee !== undefined && rawFee !== null && !isNaN(Number(rawFee))) {
      return { fee: Number(rawFee), type: '고정배송비', status: '확인됨', isExact: true };
    }

    if (rawFee !== undefined && rawFee !== null && !isNaN(Number(rawFee))) {
      return { fee: Number(rawFee), type: `${deliType || '고정'}배송비`, status: '확인됨', isExact: true };
    }

    if (deliType === '금액비노출') {
      return { fee: null, type: '배송비확인필요', status: '미확인', isExact: false };
    }

    return { fee: null, type: '배송비확인필요', status: '미확인', isExact: false };
  }

  constructor(rawData = {}) {
    this.raw = rawData;
    this.isMock = Boolean(rawData.isMock);

    // 1. getItemView v4.6 실제 필드 파싱 (basis.no, basis.status, basis.title)
    const basis = rawData.basis || {};
    this.itemNo = String(basis.no || rawData.itemNo || '');
    this.title = basis.title !== undefined ? String(basis.title) : null;
    this.status = basis.status !== undefined && basis.status !== null ? String(basis.status) : null;
    this.statusLabel = this.status ? this.status : '판매상태 확인필요';

    // 2. 가격 파싱 (price.supply, price.resale.minumum, price.resale.Recommand)
    const priceObj = rawData.price || {};
    const parsedSupply = DomeProductModel.parseSupplyPrice(priceObj.supply);

    this.wholesalePrice = parsedSupply.unitPrice;
    this.pricingType = parsedSupply.pricingType;
    this.isPriceExact = parsedSupply.isExact;

    this.minResalePrice = priceObj.resale?.minumum !== undefined && priceObj.resale?.minumum !== null
      ? Number(priceObj.resale.minumum)
      : null;

    this.recommendResalePrice = priceObj.resale?.Recommand !== undefined && priceObj.resale?.Recommand !== null
      ? Number(priceObj.resale.Recommand)
      : null;

    // 3. 배송비 파싱 (deli.supply.type / fee / tbl 파서)
    const parsedShipping = DomeProductModel.parseShippingFee(rawData);
    this.wholesaleShippingFee = parsedShipping.fee;
    this.shippingTypeLabel = parsedShipping.type;
    this.isShippingExact = parsedShipping.isExact;

    // 4. 수량 & 공급단위 파싱 (qty.inventory, qty.supplyUnit)
    const qtyObj = rawData.qty || {};
    this.inventoryQty = qtyObj.inventory !== undefined && qtyObj.inventory !== null
      ? Number(qtyObj.inventory)
      : null;
    this.inventoryStatusLabel = this.inventoryQty !== null ? `${this.inventoryQty.toLocaleString()}개` : '재고 확인 필요';

    this.supplyUnit = qtyObj.supplyUnit !== undefined && qtyObj.supplyUnit !== null
      ? Number(qtyObj.supplyUnit)
      : null;

    if (this.supplyUnit === 1) {
      this.supplyUnitStatus = '단건공급';
    } else if (this.supplyUnit > 1) {
      this.supplyUnitStatus = '구성확인필요';
    } else {
      this.supplyUnitStatus = '공급단위확인필요';
    }

    // 5. 공급사 정보 (seller.rank, seller.vacation)
    const sellerObj = rawData.seller || {};
    this.sellerRank = sellerObj.rank !== undefined && sellerObj.rank !== null
      ? Number(sellerObj.rank)
      : null;
    this.sellerRankLabel = this.sellerRank !== null ? `${this.sellerRank}등급` : '공급사 등급 확인필요';

    this.sellerVacation = sellerObj.vacation !== undefined && sellerObj.vacation !== null
      ? Boolean(sellerObj.vacation)
      : null;
    this.sellerVacationStatus = this.sellerVacation === true
      ? '휴가중'
      : (this.sellerVacation === false ? '정상영업' : '확인필요');

    // 6. 도매매 판매채널 파싱 (channel.supply - boolean 공식 타입 지원)
    const channelObj = rawData.channel || {};
    const channelSupply = channelObj.supply;

    if (channelSupply === true) {
      this.dropShippingStatus = '위탁 가능';
      this.channelLabel = '도매매 판매중';
    } else if (channelSupply === false) {
      this.dropShippingStatus = '위탁 불가';
      this.channelLabel = '도매매 판매중 아님';
    } else {
      this.dropShippingStatus = '확인 필요';
      this.channelLabel = '확인 필요';
    }
    this.isDropShippingAvailable = this.dropShippingStatus === '위탁 가능';

    // 7. 이미지 사용권 파싱 (desc.license.usable - boolean 공식 타입 지원)
    const descObj = rawData.desc || {};
    const licenseUsable = descObj.license?.usable;
    if (licenseUsable === true) {
      this.imageLicenseStatus = '사용가능';
    } else if (licenseUsable === false) {
      this.imageLicenseStatus = '사용불가';
    } else {
      this.imageLicenseStatus = '확인불가';
    }

    // 8. 썸네일 & 카테고리 (category.current가 없으면 null!)
    const thumbObj = rawData.thumb || {};
    this.imageUrl = thumbObj.large || thumbObj.original || 'https://via.placeholder.com/80';
    this.itemUrl = this.itemNo ? `https://domeggook.com/${this.itemNo}` : '#';

    const categoryObj = rawData.category || {};
    this.categoryCode = categoryObj.current ? String(categoryObj.current) : null;

    // 9. 사용자 쿠팡가 (실제 API 상품은 null로 시작!)
    if (rawData.userCoupangPrice !== undefined && rawData.userCoupangPrice !== null) {
      this.userCoupangPrice = Number(rawData.userCoupangPrice);
      this.priceStatus = 'CONFIRMED_USER_INPUT';
    } else {
      this.userCoupangPrice = null;
      this.priceStatus = 'UNCONFIRMED';
    }
  }
}

/**
 * MockDomeProductAdapter: MOCK 데이터를 v4.6 공식 객체 구조로 변환
 */
export class MockDomeProductAdapter {
  static adapt(mockItem) {
    if (!mockItem) return {};

    const supplyPrice = Number(mockItem.price || mockItem.wholesalePrice || 0);
    const shippingFee = Number(mockItem.deliPrice ?? mockItem.wholesaleShippingFee ?? 3000);
    const coupangPrice = Number(mockItem.defaultCoupangPrice ?? mockItem.userCoupangPrice ?? (supplyPrice ? Math.round((supplyPrice + shippingFee) * 1.5 / 100) * 100 : 0));

    return {
      isMock: true,
      basis: {
        no: String(mockItem.no || mockItem.itemNo || '000000'),
        status: mockItem.status || '판매중',
        title: String(mockItem.title || '제목없음')
      },
      price: {
        supply: supplyPrice,
        resale: {
          minumum: Number(mockItem.minResalePrice || 0),
          Recommand: Number(mockItem.recommendResalePrice || 0)
        }
      },
      qty: {
        inventory: mockItem.mockInventory ?? mockItem.inventoryQty ?? 999,
        supplyUnit: mockItem.supplyUnit ?? 1
      },
      deli: {
        supply: {
          pay: mockItem.deliPay || '선결제',
          type: '고정배송비',
          fee: shippingFee
        }
      },
      seller: {
        rank: mockItem.sellerRank ?? 1,
        vacation: mockItem.sellerVacation ?? false
      },
      channel: {
        supply: mockItem.agencyFlag === 'Y' || mockItem.channelSupply === true || mockItem.channelSupply === 'Y'
      },
      desc: {
        license: {
          usable: mockItem.imageLicenseStatus === '사용가능' || mockItem.licenseUsable === true || mockItem.licenseUsable === 'Y'
        }
      },
      category: {
        current: String(mockItem.category || mockItem.categoryCode || '1002')
      },
      thumb: {
        large: mockItem.thumb || mockItem.imageUrl || 'https://via.placeholder.com/80'
      },
      userCoupangPrice: coupangPrice
    };
  }
}
