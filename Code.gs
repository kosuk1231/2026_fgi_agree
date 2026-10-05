/*********************************************************************
 * FGI 연구참여 동의서 · 참여수당 영수증  — Google Apps Script 백엔드
 * 배포 계정: kosuk1231@sasw.or.kr
 *
 * 1) 이 파일 + Templates.gs 를 Apps Script 프로젝트에 넣는다.
 * 2) setup() 을 한 번 실행 → 시트 4개 생성 + 명단 15명 입력 + Drive 폴더 생성
 * 3) 배포 > 새 배포 > 웹 앱 : 실행 계정 "나", 액세스 "모든 사용자" → /exec URL 복사
 * 4) index.html 의 GAS_URL 에 붙여넣기
 *********************************************************************/

const CONFIG = {
  SHEET_ID: "1myUZVlr4cAau9mAoAM4sDfrq6uLp0bxBk3tpqy8lOqM",
  FOLDER_NAME: "FGI_2026_동의서_영수증",          // 내 드라이브 루트에 생성
  ADMIN_EMAIL: "kosuk1231@sasw.or.kr",           // 사본 수신(담당자)
  SENDER_NAME: "서울특별시사회복지사협회 정책위원회",
  REPLY_TO: "sasw@sasw.or.kr",
  PROJECT: "사회복지사를 위한 AI 실천윤리 가이드라인 개발 연구 FGI",
  STUDY_TITLE: "사회복지현장 인공지능(AI) 윤리 가이드 개발 연구",
  AMOUNT: 100000
};

const SHEETS = {
  participants: ["id","group","groupName","no","name","org","position","email","status","submittedAt"],
  consent:  ["id","group","name","email","org","position","안내문열람","동의1","동의2","동의3","동의4",
             "생년월","성별","소속기관/직급","근무지역","주요업무","현기관근무기간","사회복지경력","학력","자격증",
             "연구자","동의일","PDF_URL","submittedAt"],
  receipt:  ["id","group","name","FGI일시","주소","전화번호","은행명","계좌번호","금액","원천징수액","실수령액",
             "개인정보동의","고유식별정보동의","영수일","PDF_URL","submittedAt"],
  log:      ["timestamp","id","name","email","result","detail"]
};

const ROSTER = [
  ["A","최고관리자",1,"강현덕","영등포구가족센터","센터장"],
  ["A","최고관리자",2,"김대석","쉼터","원장"],
  ["A","최고관리자",3,"김태경","서대문시니어클럽","관장"],
  ["A","최고관리자",4,"엄미경","구립문정1동지역아동센터","센터장"],
  ["A","최고관리자",5,"임성희","아름드리꿈터","센터장"],
  ["B","중간관리자",1,"박부규","한국장애인일자리센터","팀장"],
  ["B","중간관리자",2,"박성목","송정동노인복지관","팀장"],
  ["B","중간관리자",3,"박재훈","서울장애인종합복지관","팀장"],
  ["B","중간관리자",4,"박지형","신목종합사회복지관","과장"],
  ["B","중간관리자",5,"이경태","엔젤스헤이븐지원주거센터","팀장"],
  ["C","실무자",1,"김민정","서대문노인종합복지관","사회복지사"],
  ["C","실무자",2,"박민선","신길종합사회복지관","사회복지사"],
  ["C","실무자",3,"손지연","중부재단","사회복지사"],
  ["C","실무자",4,"유승현","다시서기종합지원센터","사회복지사"],
  ["C","실무자",5,"최은지","태화해뜨는샘","사회복지사"]
];

/* ---------------- 최초 1회 실행 ---------------- */
function setup() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
      sh.getRange(1,1,1,SHEETS[name].length).setFontWeight("bold").setBackground("#e8eef7");
      sh.setFrozenRows(1);
    }
  });
  const ps = ss.getSheetByName("participants");
  if (ps.getLastRow() === 1) {
    ROSTER.forEach(r => ps.appendRow([`${r[0]}-${String(r[2]).padStart(2,"0")}`, r[0], r[1], r[2], r[3], r[4], r[5], "", "미작성", ""]));
  }
  const def = ss.getSheetByName("시트1") || ss.getSheetByName("Sheet1");
  if (def && ss.getSheets().length > 4) ss.deleteSheet(def);
  getFolder();
  Logger.log("setup 완료: 시트 4개, 명단 " + ROSTER.length + "명, 폴더 생성");
}

function getFolder(sub) {
  const it = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  const root = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.FOLDER_NAME);
  if (!sub) return root;
  const s = root.getFoldersByName(sub);
  return s.hasNext() ? s.next() : root.createFolder(sub);
}

/* ---------------- 웹앱 엔드포인트 ---------------- */
function doGet(e) {
  // 간단한 상태 확인용: /exec?action=status  → 그룹별 완료 현황
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const rows = ss.getSheetByName("participants").getDataRange().getValues().slice(1);
  const out = rows.map(r => ({ id:r[0], group:r[1], name:r[4], status:r[8], submittedAt:r[9] }));
  return json({ ok:true, participants: out });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let d = null;
  try {
    d = JSON.parse(e.postData.contents);
    validate(d);

    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const ps = ss.getSheetByName("participants");

    // 중복 제출 방지
    const prow = findRow(ps, d.id);
    if (prow && ps.getRange(prow, 9).getValue() === "완료") {
      throw new Error("이미 제출된 참여자입니다. 수정이 필요하면 담당자(02-786-2962)에게 연락해 주세요.");
    }

    // PDF 생성
    const stamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyyMMdd_HHmm");
    const folder = getFolder(`${d.group}_${d.groupName}`);
    const consentPdf = htmlToPdf(buildConsentHtml(d), `동의서_${d.group}_${d.name}_${stamp}.pdf`);
    const receiptPdf = htmlToPdf(buildReceiptHtml(d), `영수증_${d.group}_${d.name}_${stamp}.pdf`);
    const f1 = folder.createFile(consentPdf);
    const f2 = folder.createFile(receiptPdf);

    const now = new Date();
    const b = d.consent.basic, r = d.receipt;

    // consent 시트
    ss.getSheetByName("consent").appendRow([
      d.id, d.group, d.name, d.email, d.org, d.position, "Y", "Y","Y","Y","Y",
      b.birth, b.gender, b.orgPos, b.region, b.job, b.tenure, b.career, b.edu, b.cert,
      d.consent.researcherName, d.consent.date, f1.getUrl(), now
    ]);
    // receipt 시트 (주민등록번호는 저장하지 않음 — PDF에만 기재)
    ss.getSheetByName("receipt").appendRow([
      d.id, d.group, d.name, d.fgiDate, r.address, r.phone, r.bank, "'" + r.account,
      CONFIG.AMOUNT, 0, CONFIG.AMOUNT, r.privacyAgree, r.uidAgree, r.date, f2.getUrl(), now
    ]);
    // participants 상태
    if (prow) {
      ps.getRange(prow, 8, 1, 3).setValues([[d.email, "완료", now]]);
    } else {
      ps.appendRow([d.id, d.group, d.groupName, 99, d.name, d.org, d.position, d.email, "완료(직접입력)", now]);
    }

    // 메일 발송
    sendMails(d, [consentPdf, receiptPdf]);

    ss.getSheetByName("log").appendRow([now, d.id, d.name, d.email, "성공", f1.getUrl()]);
    return json({ ok:true, id:d.id });

  } catch (err) {
    try {
      SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("log")
        .appendRow([new Date(), d && d.id, d && d.name, d && d.email, "실패", String(err && err.message || err)]);
    } catch (_) {}
    return json({ ok:false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function validate(d) {
  const need = ["id","group","name","email"];
  need.forEach(k => { if (!d[k]) throw new Error("필수값 누락: " + k); });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) throw new Error("이메일 형식 오류");
  if (!d.consent || !d.consent.sig || !d.consent.researcherSig) throw new Error("서명 누락");
  if (!d.receipt || !/^\d{6}-\d{7}$/.test(d.receipt.rrn)) throw new Error("주민등록번호 형식 오류");
}

function findRow(sh, id) {
  const ids = sh.getRange(2, 1, Math.max(sh.getLastRow()-1, 1), 1).getValues().flat();
  const i = ids.indexOf(id);
  return i < 0 ? null : i + 2;
}

function htmlToPdf(html, filename) {
  return Utilities.newBlob(html, "text/html", filename.replace(/\.pdf$/, ".html"))
    .getAs("application/pdf").setName(filename);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- 메일 ---------------- */
function sendMails(d, attachments) {
  const subject = `[서울특별시사회복지사협회] FGI 연구참여 동의서·영수증 사본 (${d.name}님)`;
  const body = `
<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;line-height:1.7;color:#1c2430;max-width:600px">
  <p>${d.name}님, 안녕하세요.<br>서울특별시사회복지사협회 정책위원회입니다.</p>
  <p>「${CONFIG.STUDY_TITLE}」 초점집단면접(FGI)에 참여해 주셔서 감사합니다.<br>
  방금 서명하신 <strong>연구참여 동의서</strong>와 <strong>참여수당 영수증</strong> 사본을 PDF로 첨부해 드립니다.</p>
  <table style="border-collapse:collapse;font-size:14px;margin:12px 0">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">그룹</td><td>${d.group} · ${d.groupName}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">일시</td><td>${d.fgiDate}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">참여수당</td><td>100,000원 (입력하신 계좌로 지급 예정)</td></tr>
  </table>
  <p style="font-size:13.5px;color:#4a5565">동의서는 참여자와 연구자가 각 1부씩 보관합니다. 연구 참여와 관련해 궁금한 점이나 불편이 있으시면 언제든지 아래로 연락해 주세요.</p>
  <p style="font-size:13.5px;color:#4a5565">서울특별시사회복지사협회 회원조직팀 고석우 과장<br>02-786-2962 · ${CONFIG.ADMIN_EMAIL}<br>서울시 영등포구 당산로 171, 금강펜테리움 206호</p>
</div>`;
  GmailApp.sendEmail(d.email, subject, "", { htmlBody: body, name: CONFIG.SENDER_NAME, replyTo: CONFIG.REPLY_TO, attachments });
  // 담당자 사본
  GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, `[FGI 접수] ${d.group} ${d.name} (${d.org})`, "",
    { htmlBody: `<p>${d.group}·${d.groupName} / ${d.name} / ${d.org} ${d.position}<br>이메일: ${d.email}<br>계좌: ${d.receipt.bank} ${d.receipt.account}<br>연구자: ${d.consent.researcherName}</p>`, name: "FGI 접수 알림", attachments });
}

/* ---------------- 테스트(선택) ---------------- */
function testPdf() {
  const d = {
    id:"A-00", group:"A", groupName:"최고관리자", fgiDate:"2026년 10월 6일(화) 16:00~18:00",
    place:"서울특별시사회복지사협회 304호 다락실", name:"홍길동", org:"테스트복지관", position:"관장", email:CONFIG.ADMIN_EMAIL,
    consent:{ basic:{birth:"1980년 05월",gender:"남",orgPos:"테스트복지관 / 관장",region:"영등포구",job:"기관 운영",tenure:"2015년 03월 ~ 현재",career:"20년",edu:"석사졸업",cert:"사회복지사 1급"},
      sig:"", researcherName:"김아래미", researcherSig:"", date:"2026년 10월 6일" },
    receipt:{ rrn:"800501-1234567", address:"서울시 영등포구 당산로 171", phone:"010-0000-0000", bank:"국민", account:"000000-00-000000",
      privacyAgree:"동의", uidAgree:"동의", sig:"", date:"2026년 10월 6일" }
  };
  const f = getFolder("TEST");
  f.createFile(htmlToPdf(buildConsentHtml(d), "TEST_동의서.pdf"));
  f.createFile(htmlToPdf(buildReceiptHtml(d), "TEST_영수증.pdf"));
  Logger.log("TEST 폴더에 PDF 2개 생성됨: " + f.getUrl());
}
