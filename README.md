# 부경 카페랭크

부경대학교 대연캠퍼스 주변 카페 6곳의 음료 가격을 비교하는 React + Firebase Realtime Database 웹 앱입니다.

## 사용 카페

- 빽다방 부산부경대점
- 메가MGC커피 부산부경대쪽문점
- 커피로만 부경대점
- 더벤티 경성대부경대점
- 텐퍼센트커피 경성대부경대점
- 컴포즈커피 경성대역사점

## Firebase 설정

Firebase 콘솔 주소:
https://console.firebase.google.com/project/cafe1-6033b/database/cafe1-6033b-default-rtdb/rules?hl=ko

1. Firebase Console > 프로젝트 설정 > 일반 > 내 앱에서 웹 앱을 추가합니다.
2. Firebase Web config 값을 확인합니다.
3. `cafe1/.env.example`을 참고해 `cafe1/.env` 파일을 만듭니다.

```bash
VITE_FIREBASE_API_KEY=Firebase_Web_API_Key
VITE_FIREBASE_AUTH_DOMAIN=cafe1-6033b.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://cafe1-6033b-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=cafe1-6033b
VITE_FIREBASE_APP_ID=Firebase_Web_App_ID
```

콘솔 URL만으로는 `apiKey`와 `appId`를 알 수 없어서, 이 두 값은 Firebase 웹 앱 설정 화면에서 복사해야 합니다.

## Realtime Database 규칙

`cafe1/database.rules.json` 내용을 Firebase Console > Realtime Database > Rules에 붙여 넣고 게시합니다.

- `cafes`는 누구나 읽을 수 있습니다.
- `cafes`가 비어 있을 때만 앱이 기본 6개 카페 데이터를 한 번 저장할 수 있습니다.
- 이후 카페/메뉴 추가, 수정, 삭제는 관리자만 가능합니다.
- `reports`는 사용자가 새 제보를 작성할 수 있고, 관리자가 읽거나 삭제할 수 있습니다.

## 관리자 권한

1. Firebase Console > Authentication > Sign-in method에서 이메일/비밀번호 로그인을 활성화합니다.
2. Authentication > Users에서 관리자 계정을 만듭니다.
3. 해당 사용자의 UID를 복사합니다.
4. Realtime Database > Data에서 아래 값을 직접 추가합니다.

```json
{
  "admins": {
    "관리자_UID": true
  }
}
```

이후 앱의 관리자 화면에서 해당 이메일/비밀번호로 로그인하면 카페, 메뉴, 가격 제보를 관리할 수 있습니다.

## 로컬 실행

```bash
cd cafe1
npm install
npm run dev
```

Firebase 설정 전에도 기본 데이터 미리보기 화면은 열립니다. 실제 제보 저장과 관리자 기능은 `.env` 설정 후 작동합니다.

## Vercel 배포

- Root Directory: `cafe1`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: `.env.example`의 `VITE_FIREBASE_*` 값을 Vercel에 등록

## 데이터 시드 방식

앱 실행 시 `/cafes` 데이터가 없을 때만 `DEFAULT_CAFES`를 저장합니다. `/cafes`가 이미 있으면 새로고침해도 기본 데이터가 다시 생성되지 않습니다.

랭킹은 Firebase의 `cafes/{cafeId}/menus/{menuId}` 데이터에서 `selectedDrink === menu.name`이고 `price`가 숫자인 메뉴만 사용합니다. 가격 오름차순으로 정렬하고, 가격이 같으면 `distanceMeters`가 낮은 카페를 먼저 보여줍니다.
