/**
 * STEP 2.1.5: 도매꾹/도매매 getItemView v4.6 공식 API 응답 파서 & MOCK 어댑터 (models.js)
 * - itemNo, title, status 등 basis 및 raw fallback 유연 적용
 */

export class DomeProductModel {
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

  static parseShippingFee(rawData, orderQty = 1) {
    const deli = rawData.deli?.supply || rawData.deli?.dome || rawData.deli || {};

    const payType = deli.pay;
    const deliType = deli.type;
    const rawFee = deli.fee !== undefined ? deli.fee : rawData.deliPrice;
    const tbl = deli.tbl;

    if (deliType === '금액비노출') {
      return { fee: null, type: '배송비확인필요', status: '미확인', isExact: false };
    }

    if (payType === '무료배송') {
      return { fee: 0, type: '무료배송', status: '확인됨', isExact: true };
    }

    if (payType === '착불') {
      return { fee: null, type: '착불배송 확인필요', status: '미확인', isExact: false };
    }

    if (payType === '구매자선택') {
      return { fee: null, type: '배송조건 확인필요', status: '미확인', isExact: false };
    }

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

    if ((deliType === '고정배송비' || deliType === '고정' || !deliType) && rawFee !== undefined && rawFee !== null && !isNaN(Number(rawFee))) {
      return { fee: Number(rawFee), type: '고정배송비', status: '확인됨', isExact: true };
    }

    return { fee: null, type: '배송비확인필요', status: '미확인', isExact: false };
  }

  static parseSellerVacation(vacationObj, now = new Date()) {
    if (!vacationObj || typeof vacationObj !== 'object') {
      return { isVacation: null, statusLabel: '확인정보 없음', details: null };
    }

    const { startDate, endDate, days } = vacationObj;
    if (!startDate || !endDate) {
      return { isVacation: null, statusLabel: '확인정보 없음', details: vacationObj };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { isVacation: null, statusLabel: '확인정보 없음', details: vacationObj };
    }

    const curTime = now.getTime();
    if (curTime >= start.getTime() && curTime <= end.getTime()) {
      return { isVacation: true, statusLabel: '휴가중', details: { startDate, endDate, days } };
    } else if (curTime > end.getTime()) {
      return { isVacation: false, statusLabel: '휴가종료', details: { startDate, endDate, days } };
    } else {
      return { isVacation: false, statusLabel: '휴가예정', details: { startDate, endDate, days } };
    }
  }

  constructor(rawData = {}) {
    this.raw = rawData;
    this.isMock = Boolean(rawData.isMock);

    const dg = rawData.domeggook || rawData;
    const basis = dg.basis || (rawData.basis !== undefined ? rawData.basis : rawData);
    this.itemNo = String(basis.no || rawData.itemNo || rawData.no || '');
    this.title = basis.title !== undefined ? String(basis.title) : (rawData.title !== undefined ? String(rawData.title) : null);
    this.status = basis.status !== undefined && basis.status !== null ? String(basis.status) : (rawData.status !== undefined ? String(rawData.status) : null);
    this.statusLabel = this.status ? this.status : '판매상태 확인필요';

    const priceObj = dg.price || rawData.price || {};
    const parsedSupply = DomeProductModel.parseSupplyPrice(priceObj.supply !== undefined ? priceObj.supply : rawData.price);

    this.wholesalePrice = parsedSupply.unitPrice;
    this.pricingType = parsedSupply.pricingType;
    this.isPriceExact = parsedSupply.isExact;

    this.minResalePrice = priceObj.resale?.minumum !== undefined && priceObj.resale?.minumum !== null
      ? Number(priceObj.resale.minumum)
      : (rawData.minResalePrice ? Number(rawData.minResalePrice) : 0);

    this.recommendResalePrice = priceObj.resale?.Recommand !== undefined && priceObj.resale?.Recommand !== null
      ? Number(priceObj.resale.Recommand)
      : (rawData.recommendResalePrice ? Number(rawData.recommendResalePrice) : 0);

    const parsedShipping = DomeProductModel.parseShippingFee(rawData);
    this.wholesaleShippingFee = parsedShipping.fee;
    this.shippingTypeLabel = parsedShipping.type;
    this.isShippingExact = parsedShipping.isExact;

    const qtyObj = rawData.qty || {};
    this.inventoryQty = qtyObj.inventory !== undefined && qtyObj.inventory !== null
      ? Number(qtyObj.inventory)
      : (rawData.mockInventory !== undefined ? Number(rawData.mockInventory) : (this.isMock ? 999 : null));
    this.inventoryStatusLabel = this.inventoryQty !== null ? `${this.inventoryQty.toLocaleString()}개` : '재고 확인 필요';

    this.supplyUnit = qtyObj.supplyUnit !== undefined && qtyObj.supplyUnit !== null
      ? Number(qtyObj.supplyUnit)
      : (rawData.supplyUnit ? Number(rawData.supplyUnit) : 1);

    if (this.supplyUnit === 1) {
      this.supplyUnitStatus = '단건공급';
    } else if (this.supplyUnit > 1) {
      this.supplyUnitStatus = '구성확인필요';
    } else {
      this.supplyUnitStatus = '공급단위확인필요';
    }

    const sellerObj = rawData.seller || {};
    this.sellerRank = sellerObj.rank !== undefined && sellerObj.rank !== null
      ? Number(sellerObj.rank)
      : (this.isMock ? 1 : null);
    this.sellerRankLabel = this.sellerRank !== null ? `${this.sellerRank}등급` : '공급사 등급 확인필요';

    const parsedVacation = DomeProductModel.parseSellerVacation(sellerObj.vacation || rawData.sellerVacation);
    this.sellerVacation = parsedVacation.isVacation;
    this.sellerVacationStatus = parsedVacation.statusLabel;

    const channelObj = rawData.channel || {};
    const channelSupply = channelObj.supply !== undefined ? channelObj.supply : (rawData.agencyFlag === 'Y' ? true : (rawData.agencyFlag === 'N' ? false : undefined));

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

    const descObj = rawData.desc || {};
    const licenseUsable = descObj.license?.usable !== undefined ? descObj.license?.usable : rawData.licenseUsable;
    if (licenseUsable === true) {
      this.imageLicenseStatus = '사용가능';
    } else if (licenseUsable === false) {
      this.imageLicenseStatus = '사용불가';
    } else {
      this.imageLicenseStatus = '확인불가';
    }

    const thumbObj = rawData.thumb || {};
    this.imageUrl = thumbObj.large || thumbObj.original || rawData.thumb || 'https://via.placeholder.com/80';
    this.itemUrl = this.itemNo ? `https://domeggook.com/${this.itemNo}` : '#';

    const categoryCurrent = rawData.category?.current || rawData.category;
    if (categoryCurrent && typeof categoryCurrent === 'object') {
      this.supplierCategoryCode = String(categoryCurrent.code || '');
      this.supplierCategoryName = String(categoryCurrent.name || '');
      this.supplierCategoryDepth = categoryCurrent.depth ? Number(categoryCurrent.depth) : null;
    } else if (categoryCurrent && typeof categoryCurrent !== 'object') {
      this.supplierCategoryCode = String(categoryCurrent);
      this.supplierCategoryName = '';
      this.supplierCategoryDepth = null;
    } else {
      this.supplierCategoryCode = null;
      this.supplierCategoryName = null;
      this.supplierCategoryDepth = null;
    }

    this.coupangCategoryCode = rawData.coupangCategoryCode || (this.isMock ? this.supplierCategoryCode : null);
    this.coupangFeeRate = rawData.coupangFeeRate !== undefined ? rawData.coupangFeeRate : null;
    this.coupangFeeStatus = rawData.coupangFeeStatus || (this.isMock ? 'TEMPORARY_ASSUMPTION' : 'UNCONFIRMED');

    if (rawData.userCoupangPrice !== undefined && rawData.userCoupangPrice !== null) {
      this.userCoupangPrice = Number(rawData.userCoupangPrice);
      this.priceStatus = 'CONFIRMED_USER_INPUT';
    } else if (rawData.defaultCoupangPrice !== undefined && rawData.defaultCoupangPrice !== null) {
      this.userCoupangPrice = Number(rawData.defaultCoupangPrice);
      this.priceStatus = 'CONFIRMED_USER_INPUT';
    } else {
      this.userCoupangPrice = null;
      this.priceStatus = 'UNCONFIRMED';
    }

    this.minResaleViolation = false;
  }
}

export class MockDomeProductAdapter {
  static adapt(mockItem) {
    if (!mockItem) return {};

    const supplyPrice = Number(mockItem.price || mockItem.wholesalePrice || 0);
    const shippingFee = Number(mockItem.deliPrice ?? mockItem.wholesaleShippingFee ?? 3000);
    const coupangPrice = Number(mockItem.defaultCoupangPrice ?? mockItem.userCoupangPrice ?? (supplyPrice ? Math.round((supplyPrice + shippingFee) * 1.5 / 100) * 100 : 0));
    const mockCat = String(mockItem.category || mockItem.categoryCode || '1002');
    const itemNoStr = String(mockItem.no || mockItem.itemNo || '000000');

    return {
      isMock: true,
      no: itemNoStr,
      itemNo: itemNoStr,
      basis: {
        no: itemNoStr,
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
        vacation: mockItem.sellerVacation || null
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
        current: {
          code: mockCat,
          name: 'MOCK카테고리',
          depth: 2
        }
      },
      thumb: {
        large: mockItem.thumb || mockItem.imageUrl || 'https://via.placeholder.com/80'
      },
      userCoupangPrice: coupangPrice,
      coupangCategoryCode: mockCat,
      coupangFeeStatus: 'TEMPORARY_ASSUMPTION'
    };
  }
}
