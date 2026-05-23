# 🍜 식품 뉴스 대시보드 - 무료 버전 (Replit)

## ✨ 특징

✅ **완전 무료** - 비용 0원
✅ **실시간 크롤링** - 분 단위 업데이트 가능
✅ **무료 호스팅** - Replit에서 100% 무료 운영
✅ **5분 내 배포** - 복잡하지 않음
✅ **팀 공유** - URL만 공유하면 누구나 접속

---

## 📋 포함되는 뉴스 소스

| 카테고리 | 소스 | 개수 |
|---------|------|------|
| 업계뉴스 | 네이버 뉴스 | 10개 |
| 원재료동향 | 네이버 뉴스 | 10개 |
| 규제안전 | 네이버 뉴스 | 10개 |
| 해외뉴스 | Google News | 5개 |
| **합계** | - | **35개** |

---

## 🚀 5분 안에 시작하기

### 1단계: Replit 프로젝트 생성 (1분)

1. https://replit.com 방문
2. "Create" → "Node.js" 선택
3. 프로젝트명: `food-news-dashboard` 입력

### 2단계: 파일 업로드 (2분)

다음 파일들을 Replit에 복사:

#### 프로젝트 루트 (`~/`)

**package.json**
```json
{
  "name": "food-news-dashboard",
  "version": "1.0.0",
  "description": "식품 뉴스 실시간 대시보드 - 무료 버전",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.2",
    "node-cache": "^5.1.2",
    "node-schedule": "^2.1.1",
    "xml2js": "^0.6.2"
  },
  "engines": {
    "node": "18.x"
  }
}
```

**server.js** - 아래에 제공

#### public 폴더 생성

**public/index.html** - 아래에 제공

### 3단계: 의존성 설치 (1분)

Replit 터미널:
```bash
npm install
```

### 4단계: 실행 (1분)

```bash
npm start
```

콘솔에 다음 메시지가 나타나면 성공:
```
🚀 서버 시작: http://localhost:3000
```

### 5단계: 대시보드 접속 (0분)

Replit 우측 "Open in new tab" 클릭 또는
```
https://[프로젝트명].replit.dev
```

---

## 💡 사용 방법

### 뉴스 업데이트하기
1. 대시보드 우상단 "🔄 지금 업데이트" 버튼 클릭
2. 1-3분 대기
3. 완료 메시지 확인

### 뉴스 검색하기
1. 검색창에 키워드 입력 (예: 농심, 대두, 할당관세)
2. 카테고리 탭으로 필터링

### 팀원과 공유하기
```
URL 공유: https://[프로젝트명].replit.dev
```

---

## 🔄 자동 크롤링 설정 (선택)

정기적으로 자동으로 뉴스를 업데이트하려면:

1. `server.js` 마지막 부분 수정:

```javascript
// 6시간마다 자동 크롤링
schedule.scheduleJob('0 */6 * * *', async () => {
  console.log('⏰ 정기 크롤링 시작...');
  await crawlAllNews();
});
```

2. Replit 저장 후 재실행

---

## 📊 데이터 흐름

```
Replit 서버
├── Naver RSS 크롤링
│   ├── 업계뉴스 (10개)
│   ├── 원재료동향 (10개)
│   └── 규제안전 (10개)
├── Google News 크롤링
│   └── 해외뉴스 (5개)
└── 키워드 자동 추출
    └── 농심, 대두, 할당관세 등
```

---

## ⚙️ 시스템 요구사항

- Node.js 18.x 이상
- 인터넷 연결
- Replit 계정 (무료)

---

## 🐛 문제 해결

### "Module not found" 에러
```bash
npm install
npm start
```

### 뉴스가 안 보임
1. "🔄 지금 업데이트" 버튼 클릭
2. 1-3분 대기
3. 새로고침 (F5)

### Replit이 실행되지 않음
1. 코드에 문법 오류가 없는지 확인
2. `npm install` 다시 실행
3. Replit 재시작

---

## 📞 기술 지원

- **Replit 문제**: https://replit.com/help
- **Node.js 문제**: https://nodejs.org/docs

---

## 💰 비용

| 항목 | 비용 |
|------|------|
| Replit 호스팅 | **무료** ✅ |
| Node.js | **무료** ✅ |
| 네이버 RSS | **무료** ✅ |
| Google News | **무료** ✅ |
| **총 월 비용** | **$0** ✅ |

---

## 📝 다음 단계 (선택)

### 더 고급 기능
- 데이터베이스 연동 (Firebase, MongoDB)
- 슬랙 자동 알림
- Google Sheets 내보내기
- 이메일 뉴스레터

---

**준비됐으면 지금 시작하세요! 🚀**
