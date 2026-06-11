import { DEFAULT_CAFES } from "../src/defaultCafes.js";
import { filterDrinkSummaries, getDrinkSummaries, getRankings } from "../src/ranking.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function names(rows) {
  return rows.map((row) => row.cafeName);
}

const cafeCount = Object.keys(DEFAULT_CAFES).length;
assert(cafeCount === 6, `기본 카페 수가 6이 아닙니다: ${cafeCount}`);

const iceAmericano = getRankings(DEFAULT_CAFES, "아이스 아메리카노");
assert(iceAmericano.length === 4, `아이스 아메리카노 랭킹 수 오류: ${iceAmericano.length}`);
assert(
  names(iceAmericano).join("|") ===
    [
      "컴포즈커피 경성대역사점",
      "메가MGC커피 부산부경대쪽문점",
      "빽다방 부산부경대점",
      "텐퍼센트커피 경성대부경대점"
    ].join("|"),
  `아이스 아메리카노 정렬 오류: ${names(iceAmericano).join(", ")}`
);

const cafeLatte = getRankings(DEFAULT_CAFES, "카페라떼");
assert(cafeLatte.length === 6, `카페라떼 랭킹 수 오류: ${cafeLatte.length}`);
assert(cafeLatte[0].cafeName === "커피로만 부경대점", "카페라떼 최저가가 커피로만이 아닙니다.");

const peachTea = getRankings(DEFAULT_CAFES, "복숭아 아이스티");
assert(peachTea.length === 5, `복숭아 아이스티 랭킹 수 오류: ${peachTea.length}`);
assert(peachTea[0].cafeName === "빽다방 부산부경대점", "복숭아 아이스티 최저가가 빽다방이 아닙니다.");

const drinkSummaries = getDrinkSummaries(DEFAULT_CAFES);
const latteResults = filterDrinkSummaries(drinkSummaries, "전체", "라떼");
assert(latteResults.some((drink) => drink.name === "카페라떼"), "라떼 검색에 카페라떼가 없습니다.");
assert(latteResults.some((drink) => drink.name === "바닐라라떼"), "라떼 검색에 바닐라라떼가 없습니다.");
assert(latteResults.some((drink) => drink.name === "초코라떼"), "라떼 검색에 초코라떼가 없습니다.");

const peachSummary = drinkSummaries.find((drink) => drink.name === "복숭아 아이스티");
assert(peachSummary.count === peachTea.length, "음료 카드 판매 카페 수와 랭킹 수가 다릅니다.");

console.log("데이터 검증 통과");
