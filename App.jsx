import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { CATEGORIES, DEFAULT_CAFES } from "./defaultCafes.js";
import {
  filterDrinkSummaries,
  formatWon,
  getDrinkSummaries,
  getRankings,
  makeId,
  todayString,
  toCafeList,
  toMenuList
} from "./ranking.js";

const h = React.createElement;
const CATEGORY_OPTIONS = ["전체", ...CATEGORIES];

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

function Button({ children, className, tone, ...props }) {
  return h(
    "button",
    {
      ...props,
      className: cx("button", tone ? `button-${tone}` : "", className)
    },
    children
  );
}

function Field({ label, children }) {
  return h("label", { className: "field" }, h("span", null, label), children);
}

function EmptyState({ children }) {
  return h("div", { className: "empty-state" }, children);
}

function App() {
  const [cafes, setCafes] = useState(DEFAULT_CAFES);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDrink, setSelectedDrink] = useState("");
  const [activeCafeId, setActiveCafeId] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setCafes(DEFAULT_CAFES);
      setStatusMessage(
        "Firebase 설정값이 아직 없어 기본 데이터 미리보기로 실행 중입니다. .env에 Firebase Web config를 넣으면 Realtime Database와 연결됩니다."
      );
      setIsLoading(false);
      return undefined;
    }

    const cafesRef = ref(db, "cafes");
    let seedRequested = false;

    const unsubscribe = onValue(
      cafesRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setCafes(snapshot.val());
          setStatusMessage("");
          setIsLoading(false);
          return;
        }

        setCafes(DEFAULT_CAFES);
        setIsLoading(false);

        if (!seedRequested) {
          seedRequested = true;
          set(cafesRef, DEFAULT_CAFES)
            .then(() => {
              setStatusMessage("cafes 데이터가 없어 기본 카페 6곳을 한 번 저장했습니다.");
            })
            .catch((error) => {
              setStatusMessage(`기본 데이터 저장 실패: ${error.message}`);
            });
        }
      },
      (error) => {
        setCafes(DEFAULT_CAFES);
        setIsLoading(false);
        setStatusMessage(`Firebase 읽기 실패: ${error.message}`);
      }
    );

    return unsubscribe;
  }, []);

  const cafeList = useMemo(() => toCafeList(cafes), [cafes]);
  const drinkSummaries = useMemo(() => getDrinkSummaries(cafes), [cafes]);
  const filteredDrinks = useMemo(
    () => filterDrinkSummaries(drinkSummaries, selectedCategory, searchTerm),
    [drinkSummaries, searchTerm, selectedCategory]
  );
  const rankings = useMemo(() => getRankings(cafes, selectedDrink), [cafes, selectedDrink]);
  const activeCafe = cafeList.find((cafe) => cafe.id === activeCafeId);

  function selectDrink(drinkName) {
    setSelectedDrink(drinkName);
    setActiveCafeId("");
  }

  function openReport(row) {
    setReportTarget({
      cafeName: row.cafeName,
      drinkName: row.drinkName,
      oldPrice: row.price
    });
  }

  return h(
    "div",
    { className: "app-shell" },
    h(Header, { showAdmin, setShowAdmin }),
    statusMessage ? h("div", { className: "status-banner" }, statusMessage) : null,
    showAdmin
      ? h(AdminPanel, { cafes, cafeList })
      : h(
          "main",
          { className: "main-grid" },
          h(DrinkPicker, {
            filteredDrinks,
            isLoading,
            searchTerm,
            selectedCategory,
            selectedDrink,
            setSearchTerm,
            setSelectedCategory,
            selectDrink
          }),
          h(
            "section",
            { className: "results-column", "aria-live": "polite" },
            h(RankingPanel, {
              activeCafeId,
              rankings,
              selectedDrink,
              setActiveCafeId,
              openReport
            }),
            activeCafe
              ? h(CafeDetail, {
                  cafe: activeCafe,
                  openReport
                })
              : null
          )
        ),
    reportTarget
      ? h(ReportDialog, {
          target: reportTarget,
          onClose: () => setReportTarget(null)
        })
      : null
  );
}

function Header({ showAdmin, setShowAdmin }) {
  return h(
    "header",
    { className: "top-bar" },
    h(
      "div",
      null,
      h("p", { className: "eyebrow" }, "Pukyong Cafe Price Rank"),
      h("h1", null, "부경 카페랭크"),
      h("p", { className: "subtitle" }, "부경대 주변 카페 최저가 비교")
    ),
    h(
      "nav",
      { className: "top-actions", "aria-label": "화면 전환" },
      Button({
        tone: showAdmin ? "ghost" : "primary",
        onClick: () => setShowAdmin(false),
        children: "랭킹"
      }),
      Button({
        tone: showAdmin ? "primary" : "ghost",
        onClick: () => setShowAdmin(true),
        children: "관리자"
      })
    )
  );
}

function DrinkPicker({
  filteredDrinks,
  isLoading,
  searchTerm,
  selectedCategory,
  selectedDrink,
  setSearchTerm,
  setSelectedCategory,
  selectDrink
}) {
  return h(
    "section",
    { className: "picker-panel" },
    h(
      "div",
      { className: "section-title-row" },
      h("div", null, h("h2", null, "음료 선택"), h("p", null, "카테고리나 검색으로 메뉴를 고르세요."))
    ),
    h(
      "label",
      { className: "search-box" },
      h("span", null, "검색"),
      h("input", {
        type: "search",
        value: searchTerm,
        placeholder: "예: 라떼, 아메리카노, 아이스티",
        onChange: (event) => setSearchTerm(event.target.value)
      })
    ),
    h(
      "div",
      { className: "category-tabs", role: "tablist", "aria-label": "음료 카테고리" },
      CATEGORY_OPTIONS.map((category) =>
        h(
          "button",
          {
            key: category,
            type: "button",
            className: cx("category-tab", selectedCategory === category && "is-active"),
            onClick: () => setSelectedCategory(category)
          },
          category
        )
      )
    ),
    h(
      "div",
      { className: "drink-list" },
      isLoading
        ? h(EmptyState, null, "카페 데이터를 불러오는 중입니다.")
        : filteredDrinks.length
          ? filteredDrinks.map((drink) =>
              h(DrinkCard, {
                key: drink.name,
                drink,
                isSelected: selectedDrink === drink.name,
                onSelect: () => selectDrink(drink.name)
              })
            )
          : h(EmptyState, null, "검색된 음료가 없습니다.")
    )
  );
}

function DrinkCard({ drink, isSelected, onSelect }) {
  return h(
    "button",
    {
      type: "button",
      className: cx("drink-card", isSelected && "is-selected"),
      onClick: onSelect
    },
    h("span", { className: "drink-name" }, drink.name),
    h(
      "span",
      { className: "drink-meta" },
      `${drink.count}곳 · 최저 ${formatWon(drink.minPrice)}`
    )
  );
}

function RankingPanel({ activeCafeId, rankings, selectedDrink, setActiveCafeId, openReport }) {
  return h(
    "section",
    { className: "ranking-panel" },
    h(
      "div",
      { className: "section-title-row" },
      h(
        "div",
        null,
        h("h2", null, selectedDrink ? `${selectedDrink} 최저가 랭킹` : "최저가 랭킹"),
        h(
          "p",
          null,
          selectedDrink
            ? `${rankings.length}곳의 가격 정보를 낮은 순서로 정렬했습니다.`
            : "먹고 싶은 음료를 선택해주세요."
        )
      )
    ),
    !selectedDrink
      ? h(EmptyState, null, "먹고 싶은 음료를 선택해주세요.")
      : rankings.length === 0
        ? h(EmptyState, null, "해당 음료 가격 정보가 없습니다.")
        : h(
            "div",
            { className: "ranking-list" },
            rankings.map((row, index) =>
              h(
                "article",
                {
                  key: `${row.cafeId}-${row.menuId}`,
                  className: cx("ranking-card", index === 0 && "is-winner")
                },
                h(
                  "div",
                  { className: "rank-main" },
                  h("div", { className: "rank-badge" }, `${index + 1}위`),
                  h(
                    "div",
                    { className: "rank-copy" },
                    h("h3", null, row.cafeName),
                    h("p", { className: "rank-drink" }, row.drinkName),
                    h("p", { className: "rank-location" }, `위치: ${row.location}`),
                    h("p", { className: "rank-location" }, `거리: ${row.distanceText}`),
                    h(
                      "div",
                      { className: "tag-row" },
                      row.tags.map((tag) => h("span", { key: tag }, tag))
                    ),
                    h("p", { className: "updated-at" }, `최근 수정: ${row.updatedAt || "확인 필요"}`)
                  )
                ),
                h(
                  "div",
                  { className: "rank-side" },
                  h("strong", null, formatWon(row.price)),
                  h(
                    "div",
                    { className: "card-actions" },
                    Button({
                      tone: activeCafeId === row.cafeId ? "primary" : "ghost",
                      onClick: () => setActiveCafeId(row.cafeId),
                      children: "상세"
                    }),
                    Button({
                      tone: "light",
                      onClick: () => openReport(row),
                      children: "가격 제보"
                    })
                  )
                )
              )
            )
          )
  );
}

function CafeDetail({ cafe, openReport }) {
  const menus = toMenuList(cafe.menus).sort((a, b) => {
    if (a.category !== b.category) {
      return String(a.category).localeCompare(String(b.category), "ko-KR");
    }
    return a.name.localeCompare(b.name, "ko-KR");
  });

  return h(
    "section",
    { className: "detail-panel" },
    h(
      "div",
      { className: "section-title-row" },
      h(
        "div",
        null,
        h("h2", null, cafe.name),
        h("p", null, `${cafe.location} · ${cafe.hours}`)
      )
    ),
    h(
      "div",
      { className: "detail-meta" },
      h("span", null, cafe.distanceText),
      h("span", null, `${cafe.distanceMeters ?? "거리 확인"}m`),
      cafe.tags.map((tag) => h("span", { key: tag }, tag))
    ),
    h(
      "div",
      { className: "menu-table" },
      menus.map((menu) =>
        h(
          "div",
          { className: "menu-row", key: menu.id },
          h("span", null, menu.name),
          h("span", null, menu.category),
          h("strong", null, formatWon(menu.price)),
          Button({
            tone: "light",
            onClick: () =>
              openReport({
                cafeName: cafe.name,
                drinkName: menu.name,
                oldPrice: menu.price
              }),
            children: "가격 제보"
          })
        )
      )
    )
  );
}

function ReportDialog({ target, onClose }) {
  const [form, setForm] = useState({
    cafeName: target.cafeName,
    drinkName: target.drinkName,
    oldPrice: String(target.oldPrice),
    newPrice: "",
    memo: ""
  });
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitReport(event) {
    event.preventDefault();
    setMessage("");

    if (!isFirebaseConfigured) {
      setMessage("Firebase 설정 후 제보를 저장할 수 있습니다.");
      return;
    }

    const oldPrice = Number(form.oldPrice);
    const newPrice = Number(form.newPrice);

    if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice)) {
      setMessage("가격은 숫자로 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await push(ref(db, "reports"), {
        cafeName: form.cafeName.trim(),
        drinkName: form.drinkName.trim(),
        oldPrice,
        newPrice,
        memo: form.memo.trim(),
        createdAt: new Date().toISOString()
      });
      setMessage("가격 제보가 저장되었습니다.");
      setTimeout(onClose, 700);
    } catch (error) {
      setMessage(`저장 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return h(
    "div",
    { className: "modal-backdrop", role: "presentation" },
    h(
      "form",
      { className: "report-dialog", onSubmit: submitReport },
      h(
        "div",
        { className: "section-title-row" },
        h("div", null, h("h2", null, "가격 제보"), h("p", null, "실제 가격과 다르면 알려주세요.")),
        Button({ type: "button", tone: "ghost", onClick: onClose, children: "닫기" })
      ),
      Field({
        label: "카페명",
        children: h("input", {
          value: form.cafeName,
          onChange: (event) => updateField("cafeName", event.target.value),
          required: true
        })
      }),
      Field({
        label: "음료명",
        children: h("input", {
          value: form.drinkName,
          onChange: (event) => updateField("drinkName", event.target.value),
          required: true
        })
      }),
      h(
        "div",
        { className: "form-grid" },
        Field({
          label: "현재 앱 가격",
          children: h("input", {
            type: "number",
            min: "0",
            value: form.oldPrice,
            onChange: (event) => updateField("oldPrice", event.target.value),
            required: true
          })
        }),
        Field({
          label: "새로운 가격",
          children: h("input", {
            type: "number",
            min: "0",
            value: form.newPrice,
            onChange: (event) => updateField("newPrice", event.target.value),
            required: true
          })
        })
      ),
      Field({
        label: "제보 내용",
        children: h("textarea", {
          value: form.memo,
          rows: 4,
          maxLength: 400,
          placeholder: "메뉴판 확인 날짜나 특이사항을 적어주세요.",
          onChange: (event) => updateField("memo", event.target.value)
        })
      }),
      message ? h("p", { className: "form-message" }, message) : null,
      Button({
        type: "submit",
        tone: "primary",
        disabled: isSubmitting,
        children: isSubmitting ? "저장 중" : "제보 제출"
      })
    )
  );
}

function AdminPanel({ cafes, cafeList }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return undefined;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthMessage("");

      if (!nextUser) {
        setIsAdmin(false);
        return;
      }

      try {
        const snapshot = await get(ref(db, `admins/${nextUser.uid}`));
        const hasAdminRole = snapshot.val() === true;
        setIsAdmin(hasAdminRole);
        if (!hasAdminRole) {
          setAuthMessage(`관리자 권한이 없습니다. Firebase Database의 admins/${nextUser.uid} 값을 true로 설정하세요.`);
        }
      } catch (error) {
        setIsAdmin(false);
        setAuthMessage(`관리자 권한 확인 실패: ${error.message}`);
      }
    });
  }, []);

  async function login(event) {
    event.preventDefault();
    setAuthMessage("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthMessage(`로그인 실패: ${error.message}`);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  if (!isFirebaseConfigured) {
    return h(
      "main",
      { className: "admin-panel" },
      h(EmptyState, null, "관리자 기능은 Firebase Web config를 .env에 입력한 뒤 사용할 수 있습니다.")
    );
  }

  if (!user || !isAdmin) {
    return h(
      "main",
      { className: "admin-panel" },
      h(
        "form",
        { className: "admin-login", onSubmit: login },
        h("h2", null, "관리자 로그인"),
        Field({
          label: "이메일",
          children: h("input", {
            type: "email",
            value: email,
            onChange: (event) => setEmail(event.target.value),
            required: true
          })
        }),
        Field({
          label: "비밀번호",
          children: h("input", {
            type: "password",
            value: password,
            onChange: (event) => setPassword(event.target.value),
            required: true
          })
        }),
        Button({ type: "submit", tone: "primary", children: "로그인" }),
        authMessage ? h("p", { className: "form-message" }, authMessage) : null,
        user ? Button({ type: "button", tone: "ghost", onClick: logout, children: "로그아웃" }) : null
      )
    );
  }

  return h(
    "main",
    { className: "admin-panel" },
    h(
      "div",
      { className: "admin-heading" },
      h("div", null, h("h2", null, "관리자 화면"), h("p", null, "카페, 메뉴, 가격 제보를 관리합니다.")),
      Button({ tone: "ghost", onClick: logout, children: "로그아웃" })
    ),
    h(CafeEditor, { cafes, cafeList }),
    h(ReportsAdmin, { cafes })
  );
}

function CafeEditor({ cafes, cafeList }) {
  const [selectedCafeId, setSelectedCafeId] = useState("");
  const [draft, setDraft] = useState(blankCafeDraft());
  const [message, setMessage] = useState("");

  const selectedCafe = cafeList.find((cafe) => cafe.id === selectedCafeId);

  useEffect(() => {
    if (!selectedCafeId && cafeList.length) {
      setSelectedCafeId(cafeList[0].id);
    }
  }, [cafeList, selectedCafeId]);

  useEffect(() => {
    if (!selectedCafe) {
      setDraft(blankCafeDraft());
      return;
    }

    setDraft({
      name: selectedCafe.name || "",
      location: selectedCafe.location || "",
      distanceText: selectedCafe.distanceText || "",
      distanceMeters: String(selectedCafe.distanceMeters ?? ""),
      hours: selectedCafe.hours || "",
      tags: selectedCafe.tags.join(", ")
    });
  }, [selectedCafeId, selectedCafe]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function cafePayload(existingMenus) {
    const distanceMeters = Number(draft.distanceMeters);
    return {
      name: draft.name.trim(),
      location: draft.location.trim(),
      distanceText: draft.distanceText.trim(),
      ...(Number.isFinite(distanceMeters) ? { distanceMeters } : {}),
      hours: draft.hours.trim(),
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      menus: existingMenus || {}
    };
  }

  async function saveCafe(event) {
    event.preventDefault();
    if (!selectedCafeId) {
      setMessage("수정할 카페를 선택해주세요.");
      return;
    }

    try {
      await set(ref(db, `cafes/${selectedCafeId}`), cafePayload(selectedCafe?.menus));
      setMessage("카페 정보가 저장되었습니다.");
    } catch (error) {
      setMessage(`카페 저장 실패: ${error.message}`);
    }
  }

  async function addCafe() {
    if (!draft.name.trim()) {
      setMessage("새 카페명부터 입력해주세요.");
      return;
    }

    const cafeId = `${makeId("cafe", draft.name)}_${Date.now().toString(36)}`;
    try {
      await set(ref(db, `cafes/${cafeId}`), cafePayload({}));
      setSelectedCafeId(cafeId);
      setMessage("새 카페가 추가되었습니다.");
    } catch (error) {
      setMessage(`카페 추가 실패: ${error.message}`);
    }
  }

  async function deleteCafe() {
    if (!selectedCafeId || !selectedCafe) {
      return;
    }

    if (!window.confirm(`${selectedCafe.name}을 삭제할까요?`)) {
      return;
    }

    try {
      await remove(ref(db, `cafes/${selectedCafeId}`));
      setSelectedCafeId("");
      setMessage("카페가 삭제되었습니다.");
    } catch (error) {
      setMessage(`카페 삭제 실패: ${error.message}`);
    }
  }

  return h(
    "section",
    { className: "admin-section" },
    h("h3", null, "카페 관리"),
    h(
      "div",
      { className: "admin-layout" },
      h(
        "aside",
        { className: "admin-list" },
        cafeList.map((cafe) =>
          h(
            "button",
            {
              type: "button",
              key: cafe.id,
              className: cx("admin-list-item", selectedCafeId === cafe.id && "is-active"),
              onClick: () => setSelectedCafeId(cafe.id)
            },
            cafe.name
          )
        )
      ),
      h(
        "div",
        { className: "admin-edit" },
        h(
          "form",
          { className: "admin-form", onSubmit: saveCafe },
          h(
            "div",
            { className: "form-grid" },
            Field({
              label: "카페명",
              children: h("input", {
                value: draft.name,
                onChange: (event) => updateDraft("name", event.target.value),
                required: true
              })
            }),
            Field({
              label: "위치",
              children: h("input", {
                value: draft.location,
                onChange: (event) => updateDraft("location", event.target.value),
                required: true
              })
            }),
            Field({
              label: "거리 문구",
              children: h("input", {
                value: draft.distanceText,
                onChange: (event) => updateDraft("distanceText", event.target.value),
                required: true
              })
            }),
            Field({
              label: "거리(m)",
              children: h("input", {
                type: "number",
                min: "0",
                value: draft.distanceMeters,
                onChange: (event) => updateDraft("distanceMeters", event.target.value)
              })
            }),
            Field({
              label: "영업시간",
              children: h("input", {
                value: draft.hours,
                onChange: (event) => updateDraft("hours", event.target.value),
                required: true
              })
            }),
            Field({
              label: "태그",
              children: h("input", {
                value: draft.tags,
                onChange: (event) => updateDraft("tags", event.target.value),
                placeholder: "프랜차이즈, 가성비"
              })
            })
          ),
          h(
            "div",
            { className: "admin-actions" },
            Button({ type: "submit", tone: "primary", children: "카페 수정" }),
            Button({ type: "button", tone: "light", onClick: addCafe, children: "카페 추가" }),
            Button({ type: "button", tone: "danger", onClick: deleteCafe, children: "카페 삭제" })
          )
        ),
        selectedCafe ? h(MenuEditor, { cafe: selectedCafe }) : null,
        message ? h("p", { className: "form-message" }, message) : null
      )
    )
  );
}

function MenuEditor({ cafe }) {
  const menus = toMenuList(cafe.menus).sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [draft, setDraft] = useState(blankMenuDraft());
  const [message, setMessage] = useState("");

  const selectedMenu = menus.find((menu) => menu.id === selectedMenuId);

  useEffect(() => {
    setSelectedMenuId("");
    setDraft(blankMenuDraft());
    setMessage("");
  }, [cafe.id]);

  useEffect(() => {
    const menuForDraft = toMenuList(cafe.menus).find((menu) => menu.id === selectedMenuId);
    if (!menuForDraft) {
      return;
    }

    setDraft({
      name: menuForDraft.name || "",
      category: menuForDraft.category || CATEGORIES[0],
      price: String(menuForDraft.price ?? "")
    });
  }, [cafe.menus, selectedMenuId]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function startNewMenu() {
    setSelectedMenuId("");
    setDraft(blankMenuDraft());
    setMessage("");
  }

  async function saveMenu(event) {
    event.preventDefault();
    const price = Number(draft.price);

    if (!Number.isFinite(price)) {
      setMessage("메뉴 가격은 숫자로 입력해주세요.");
      return;
    }

    const menuId = selectedMenuId || `${makeId("menu", draft.name)}_${Date.now().toString(36)}`;

    try {
      await set(ref(db, `cafes/${cafe.id}/menus/${menuId}`), {
        name: draft.name.trim(),
        category: draft.category,
        price,
        updatedAt: todayString()
      });
      setSelectedMenuId(menuId);
      setMessage("메뉴가 저장되었습니다.");
    } catch (error) {
      setMessage(`메뉴 저장 실패: ${error.message}`);
    }
  }

  async function deleteMenu(menuId) {
    if (!window.confirm("이 메뉴를 삭제할까요?")) {
      return;
    }

    try {
      await remove(ref(db, `cafes/${cafe.id}/menus/${menuId}`));
      if (selectedMenuId === menuId) {
        startNewMenu();
      }
      setMessage("메뉴가 삭제되었습니다.");
    } catch (error) {
      setMessage(`메뉴 삭제 실패: ${error.message}`);
    }
  }

  return h(
    "section",
    { className: "menu-admin" },
    h(
      "div",
      { className: "section-title-row" },
      h("div", null, h("h4", null, "메뉴 관리"), h("p", null, "가격 수정 시 최근 수정 날짜가 오늘로 저장됩니다.")),
      Button({ type: "button", tone: "ghost", onClick: startNewMenu, children: "새 메뉴" })
    ),
    h(
      "form",
      { className: "admin-form", onSubmit: saveMenu },
      h(
        "div",
        { className: "form-grid" },
        Field({
          label: "메뉴명",
          children: h("input", {
            value: draft.name,
            onChange: (event) => updateDraft("name", event.target.value),
            required: true
          })
        }),
        Field({
          label: "카테고리",
          children: h(
            "select",
            {
              value: draft.category,
              onChange: (event) => updateDraft("category", event.target.value)
            },
            CATEGORIES.map((category) => h("option", { key: category, value: category }, category))
          )
        }),
        Field({
          label: "가격",
          children: h("input", {
            type: "number",
            min: "0",
            value: draft.price,
            onChange: (event) => updateDraft("price", event.target.value),
            required: true
          })
        })
      ),
      Button({
        type: "submit",
        tone: "primary",
        children: selectedMenuId ? "메뉴 수정" : "메뉴 추가"
      })
    ),
    h(
      "div",
      { className: "admin-menu-list" },
      menus.map((menu) =>
        h(
          "div",
          { className: "admin-menu-row", key: menu.id },
          h("span", null, menu.name),
          h("span", null, menu.category),
          h("strong", null, formatWon(menu.price)),
          h(
            "div",
            { className: "card-actions" },
            Button({
              type: "button",
              tone: selectedMenuId === menu.id ? "primary" : "ghost",
              onClick: () => setSelectedMenuId(menu.id),
              children: "수정"
            }),
            Button({
              type: "button",
              tone: "danger",
              onClick: () => deleteMenu(menu.id),
              children: "삭제"
            })
          )
        )
      )
    ),
    message ? h("p", { className: "form-message" }, message) : null
  );
}

function ReportsAdmin({ cafes }) {
  const [reports, setReports] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reportsRef = ref(db, "reports");
    return onValue(reportsRef, (snapshot) => {
      setReports(snapshot.val() || {});
    });
  }, []);

  async function applyReport(reportId, report) {
    const cafe = toCafeList(cafes).find((item) => item.name === report.cafeName);
    const menu = cafe ? toMenuList(cafe.menus).find((item) => item.name === report.drinkName) : null;
    const newPrice = Number(report.newPrice);

    if (!cafe || !menu || !Number.isFinite(newPrice)) {
      setMessage("일치하는 카페와 메뉴를 찾지 못했습니다. 직접 메뉴를 수정해주세요.");
      return;
    }

    try {
      await update(ref(db, `cafes/${cafe.id}/menus/${menu.id}`), {
        price: newPrice,
        updatedAt: todayString()
      });
      await remove(ref(db, `reports/${reportId}`));
      setMessage("제보 가격을 반영하고 제보를 삭제했습니다.");
    } catch (error) {
      setMessage(`제보 반영 실패: ${error.message}`);
    }
  }

  async function deleteReport(reportId) {
    try {
      await remove(ref(db, `reports/${reportId}`));
      setMessage("제보를 삭제했습니다.");
    } catch (error) {
      setMessage(`제보 삭제 실패: ${error.message}`);
    }
  }

  const reportRows = Object.entries(reports);

  return h(
    "section",
    { className: "admin-section" },
    h("h3", null, "가격 제보 확인"),
    reportRows.length
      ? h(
          "div",
          { className: "reports-list" },
          reportRows.map(([reportId, report]) =>
            h(
              "article",
              { className: "report-card", key: reportId },
              h("h4", null, `${report.cafeName} · ${report.drinkName}`),
              h(
                "p",
                null,
                `${formatWon(report.oldPrice)} → ${formatWon(report.newPrice)}`
              ),
              h("p", null, report.memo || "제보 내용 없음"),
              h("p", { className: "updated-at" }, report.createdAt || "제보 날짜 확인 필요"),
              h(
                "div",
                { className: "card-actions" },
                Button({
                  tone: "primary",
                  onClick: () => applyReport(reportId, report),
                  children: "가격 반영"
                }),
                Button({
                  tone: "danger",
                  onClick: () => deleteReport(reportId),
                  children: "삭제"
                })
              )
            )
          )
        )
      : h(EmptyState, null, "아직 가격 제보가 없습니다."),
    message ? h("p", { className: "form-message" }, message) : null
  );
}

function blankCafeDraft() {
  return {
    name: "",
    location: "",
    distanceText: "",
    distanceMeters: "",
    hours: "영업시간 확인 필요",
    tags: ""
  };
}

function blankMenuDraft() {
  return {
    name: "",
    category: CATEGORIES[0],
    price: ""
  };
}

export default App;
