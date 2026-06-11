export function formatWon(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "가격 확인 필요";
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

export function isValidPrice(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function objectEntries(value) {
  return Object.entries(value || {});
}

export function toCafeList(cafes) {
  return objectEntries(cafes).map(([id, cafe]) => ({
    id,
    ...cafe,
    tags: Array.isArray(cafe.tags) ? cafe.tags : [],
    menus: cafe.menus || {}
  }));
}

export function toMenuList(menus) {
  return objectEntries(menus).map(([id, menu]) => ({
    id,
    ...menu
  }));
}

export function getDrinkSummaries(cafes) {
  const summaries = new Map();

  toCafeList(cafes).forEach((cafe) => {
    toMenuList(cafe.menus).forEach((menu) => {
      if (!menu.name || !isValidPrice(menu.price)) {
        return;
      }

      const current = summaries.get(menu.name) || {
        name: menu.name,
        category: menu.category,
        count: 0,
        minPrice: menu.price
      };

      current.count += 1;
      current.minPrice = Math.min(current.minPrice, menu.price);
      summaries.set(menu.name, current);
    });
  });

  return Array.from(summaries.values()).sort((a, b) => {
    if (a.category !== b.category) {
      return String(a.category).localeCompare(String(b.category), "ko-KR");
    }

    if (a.minPrice !== b.minPrice) {
      return a.minPrice - b.minPrice;
    }

    return a.name.localeCompare(b.name, "ko-KR");
  });
}

export function getRankings(cafes, selectedDrink) {
  if (!selectedDrink) {
    return [];
  }

  const rows = [];

  toCafeList(cafes).forEach((cafe) => {
    toMenuList(cafe.menus).forEach((menu) => {
      if (menu.name !== selectedDrink || !isValidPrice(menu.price)) {
        return;
      }

      rows.push({
        cafeId: cafe.id,
        cafeName: cafe.name,
        location: cafe.location,
        distanceText: cafe.distanceText,
        distanceMeters: cafe.distanceMeters,
        hours: cafe.hours,
        tags: cafe.tags,
        menuId: menu.id,
        drinkName: menu.name,
        category: menu.category,
        price: menu.price,
        updatedAt: menu.updatedAt
      });
    });
  });

  return rows.sort((a, b) => {
    if (a.price !== b.price) {
      return a.price - b.price;
    }

    const aDistance = Number.isFinite(a.distanceMeters) ? a.distanceMeters : null;
    const bDistance = Number.isFinite(b.distanceMeters) ? b.distanceMeters : null;

    if (aDistance !== null && bDistance !== null) {
      return aDistance - bDistance;
    }

    return 0;
  });
}

export function filterDrinkSummaries(drinks, category, searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);

  return drinks.filter((drink) => {
    const categoryMatches = category === "전체" || drink.category === category;
    const searchMatches = !normalizedSearch || normalizeText(drink.name).includes(normalizedSearch);
    return categoryMatches && searchMatches;
  });
}

export function makeId(prefix, source) {
  const normalized = normalizeText(source)
    .replace(/[^a-z0-9가-힣]/gi, "")
    .slice(0, 24);
  return `${prefix}_${normalized || Date.now()}`;
}
