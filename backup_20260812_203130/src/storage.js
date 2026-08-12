/**
 * STEP 2: 관심상품 저장소 (BookmarkStore)
 * - LocalStorage를 사용한 관심상품 추가/삭제/복원 관리
 */

const STORAGE_KEY = 'coupang_bookmarked_products_v2';

export class BookmarkStore {
  static getBookmarks() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn('Failed to load bookmarks from LocalStorage:', e);
      return [];
    }
  }

  static isBookmarked(itemNo) {
    const list = this.getBookmarks();
    return list.some(item => String(item.itemNo) === String(item.itemNo));
  }

  static toggleBookmark(item, calcResult = {}) {
    const list = this.getBookmarks();
    const index = list.findIndex(b => String(b.itemNo) === String(item.itemNo));

    if (index >= 0) {
      list.splice(index, 1);
      this.saveList(list);
      return false; // Removed
    } else {
      const bookmarkData = {
        itemNo: String(item.itemNo),
        title: item.title,
        wholesalePrice: item.wholesalePrice,
        wholesaleShippingFee: item.wholesaleShippingFee,
        categoryCode: item.categoryCode,
        imageUrl: item.imageUrl,
        isDropShippingAvailable: item.isDropShippingAvailable,
        productUrl: item.productUrl,
        coupangPrice: calcResult.coupangPrice || 0,
        basicNetProfit: calcResult.basicNetProfit || 0,
        conservativeNetProfit: calcResult.conservativeNetProfit || 0,
        marginRate: calcResult.marginRate || 0,
        roi: calcResult.roi || 0,
        candidateTier: calcResult.candidateTier || 'EXCLUDE',
        candidateTierName: calcResult.candidateTierName || '제외 후보',
        savedAt: new Date().toISOString()
      };
      list.unshift(bookmarkData);
      this.saveList(list);
      return true; // Added
    }
  }

  static removeBookmark(itemNo) {
    const list = this.getBookmarks();
    const filtered = list.filter(b => String(b.itemNo) !== String(itemNo));
    this.saveList(filtered);
  }

  static saveList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save bookmarks to LocalStorage:', e);
    }
  }
}
