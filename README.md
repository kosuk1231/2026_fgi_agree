# FGI 연구참여 동의서 · 참여수당 영수증 — 설치 안내

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 참여자용 페이지(스마트폰 기준, JS 포함 단일 파일) → Vercel 배포 |
| `gas/Code.gs` | Apps Script 백엔드: 시트 저장 · PDF 생성 · 이메일 발송 |
| `gas/Templates.gs` | 동의서(안내문 포함)·영수증 PDF HTML 템플릿 |

## 1. Apps Script (kosuk1231@sasw.or.kr 로 로그인)
1. 시트 `1myUZVlr4cAau9mAoAM4sDfrq6uLp0bxBk3tpqy8lOqM` 열기 → **확장 프로그램 > Apps Script**
2. 기본 `Code.gs` 내용을 `gas/Code.gs` 로 덮어쓰기, 파일 추가(+) → `Templates.gs` 생성 후 붙여넣기
3. 함수 선택 `setup` → **실행** → 권한 승인(스프레드시트·드라이브·Gmail)
   - 시트 4개(participants / consent / receipt / log) 생성, 명단 15명 입력, 드라이브에 `FGI_2026_동의서_영수증` 폴더 생성
4. (선택) `testPdf` 실행 → 드라이브 `FGI_2026_동의서_영수증/TEST` 폴더에서 PDF 2개 열어 한글·레이아웃 확인
5. **배포 > 새 배포** → 유형 **웹 앱** → 실행 계정 **나** / 액세스 **모든 사용자** → 배포 → `/exec` URL 복사

## 2. 프론트
1. `index.html` 상단 `const GAS_URL = "";` 에 복사한 `/exec` URL 붙여넣기
2. Vercel 배포 (`vercel --prod`) 또는 GitHub 연결
3. 그룹별 QR/링크
   - 실무자(10:00) `https://<도메인>/?g=C`
   - 중간관리자(14:00) `https://<도메인>/?g=B`
   - 최고관리자(16:00) `https://<도메인>/?g=A`
   - 파라미터 없이 접속하면 그룹 선택 화면부터 시작

## 3. 현장 운영
- 참여자: 성명 선택 → 이메일 → 안내문 확인 → 동의 4항목 + 기본사항 + 서명 → **연구자에게 폰을 건네 연구자 서명** → 영수증 정보 + 서명 → 제출
- 제출 즉시: 참여자 메일(PDF 2종 첨부) + 담당자 메일(사본) 발송, Drive `A_최고관리자/` 등 그룹 폴더에 PDF 저장, 시트 기록
- **재제출**이 필요하면 `participants` 시트에서 해당 행 `status` 를 지우면 다시 제출 가능

## 데이터 처리 메모
- 주민등록번호: 시트에 저장하지 않음. 영수증 PDF(메일 첨부 + Drive 보관본)에만 기재
- 원천징수: 10만원 이하라 0원, 실수령 100,000원 고정
- 계좌번호는 앞에 `'`를 붙여 저장(숫자 변환 방지)
- Drive 폴더는 배포 계정 외 공유되지 않음. 회계 제출 후 폴더 접근권한 점검 권장

## 문제가 생기면
- PDF 한글이 깨짐 → `Templates.gs` 의 `PDF_CSS` font-family 순서에 `'Noto Sans CJK KR'` 가 가장 앞에 있는지 확인(GAS 기본 변환기는 Noto CJK 지원)
- 제출 실패 메시지 → 시트 `log` 탭에 실패 사유 기록됨
- 메일 미수신 → Gmail 보낸편지함 확인, 참여자 스팸함 확인. 일일 발송 한도(Workspace 1,500통)와 무관한 규모
- 수정 배포 → Apps Script에서 **배포 관리 > 편집 > 새 버전** 으로 올려야 반영됨(URL은 그대로)
