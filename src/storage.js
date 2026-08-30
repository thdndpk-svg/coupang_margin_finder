/**
 * STEP 2.1.1: LocalStorage 관심상품 및 설정 보관함 (storage.js)
 */

export class BookmarkStore {
  constructor() {
    this.storageKey = 'coupang_bookmarked_products_v2_1_1';
  }

  getBookmarks() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(this.storageKey);
        return saved ? JSON.parse(saved) : [];
      }
    } catch (e) {
      console.error('관심상품 불러오기 실패:', e);
    }
    return [];
  }

  isBookmarked(itemNo) {
    const list = this.getBookmarks();
    return list.some(item => String(item.itemNo) === String(itemNo));
  }

  toggleBookmark(productData) {
    let list = this.getBookmarks();
    const targetId = String(productData.itemNo);
    const existingIndex = list.findIndex(item => String(item.itemNo) === targetId);

    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
    } else {
      list.push({
        itemNo: targetId,
        title: productData.title,
        wholesalePrice: productData.wholesalePrice,
        wholesaleShippingFee: productData.wholesaleShippingFee,
        userCoupangPrice: productData.userCoupangPrice,
        categoryCode: productData.categoryCode,
        imageUrl: productData.imageUrl,
        savedAt: new Date().toISOString()
      });
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(list));
      }
    } catch (e) {
      console.error('관심상품 저장 실패:', e);
    }

    return this.isBookmarked(targetId);
  }

  removeBookmark(itemNo) {
    let list = this.getBookmarks();
    list = list.filter(item => String(item.itemNo) !== String(itemNo));
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(list));
      }
    } catch (e) {
      console.error('관심상품 삭제 실패:', e);
    }
  }

  exportBookmarksJSON() {
    const list = this.getBookmarks();
    return JSON.stringify(list, null, 2);
  }

  importBookmarksJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(parsed));
        return true;
      }
    } catch (e) {
      console.error('JSON 가져오기 실패:', e);
    }
    return false;
  }
}

export const bookmarkStore = new BookmarkStore();
