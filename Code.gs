/*********************************************************************
 * FGI 연구참여 동의서 · 참여수당 영수증  — Google Apps Script 백엔드
 * 배포 계정: kosuk1231@sasw.or.kr
 *
 * 흐름: 참여자 제출(submit, 저장만·3~5초) → 서명대기
 *       → 연구자 일괄 서명(sign) → 동의서·영수증 PDF 생성 + 이메일 발송 → 완료
 * 주민등록번호·서명 등 제출 원본은 Drive `_대기자료/{id}.json`에만 임시 보관되고,
 * PDF가 만들어지는 즉시 삭제됩니다(시트에는 저장 안 함).
 *
 * 1) 이 파일 + Templates.gs 를 **같은** Apps Script 프로젝트에 넣는다.
 *    (Templates.gs 가 없으면 "buildConsentHtml is not defined" 오류)
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
  AMOUNT: 100000,
  ADMIN_KEY: "2962"                              // 연구자용 서명 페이지(sign.html) 비밀번호 — 바꿔서 쓰세요
};

const SHEETS = {
  participants: ["id","group","groupName","no","name","org","position","email","status","submittedAt"],
  consent:  ["id","group","name","email","org","position","안내문열람","동의1","동의2","동의3","동의4",
             "생년월일","성별","소속기관/직급","근무지역","주요업무","현기관근무기간","사회복지경력","학력","자격증",
             "동의일","대기자료파일ID","상태","연구자","연구자서명일","PDF_URL","발송일시","submittedAt"],
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
  const p = (e && e.parameter) || {};
  if (p.action === "pending") {
    if (p.key !== CONFIG.ADMIN_KEY) return json({ ok:false, error:"비밀번호가 올바르지 않습니다." });
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const prow = ss.getSheetByName("participants").getDataRange().getValues().slice(1);
    const out = prow.filter(r => r[0]).map(r => ({
      id:r[0], group:r[1], name:r[4], org:r[5], email:r[7], status:r[8]||"미작성"
    }));
    return json({ ok:true, participants: out });
  }
  // 기본: 그룹별 현황(공개 정보만)
  const rows = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("participants").getDataRange().getValues().slice(1);
  return json({ ok:true, participants: rows.filter(r=>r[0]).map(r => ({ id:r[0], group:r[1], name:r[4], status:r[8] })) });
}

function doPost(e) {
  let d = null;
  try {
    d = JSON.parse(e.postData.contents);
    if (d.action === "sign") return json(handleSign(d));
    return json(handleSubmit(d));
  } catch (err) {
    log(d && d.id, d && d.name, d && d.email, "실패", err);
    return json({ ok:false, error: String(err && err.message || err) });
  }
}

/* ---------- 1) 참여자 제출: 저장만 (PDF·메일은 연구자 서명 때) ---------- */
function handleSubmit(d) {
  validate(d);
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const ps = ss.getSheetByName("participants");
  const now = new Date();
  const b = d.consent.basic, r = d.receipt;

  // 원본(서명 이미지·주민번호 포함)은 Drive JSON에만 임시 보관 → PDF 생성 후 삭제
  const pending = getFolder("_대기자료").createFile(
    Utilities.newBlob(JSON.stringify(d), "application/json", `${d.id}_${d.name}.json`));

  // 시트 기록 구간만 짧게 잠금(중복 제출 방지)
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { pending.setTrashed(true); throw new Error("서버가 잠시 바쁩니다. 10초 뒤 다시 제출해 주세요."); }
  try {
    const prow = findRow(ps, d.id);
    if (prow) {
      const st = ps.getRange(prow, 9).getValue();
      if (st === "서명대기" || st === "완료") { pending.setTrashed(true); throw new Error("이미 제출된 참여자입니다. 수정이 필요하면 담당자(02-786-2962)에게 연락해 주세요."); }
    }
    ss.getSheetByName("consent").appendRow([
      d.id, d.group, d.name, d.email, d.org, d.position, "Y", "Y","Y","Y","Y",
      "'" + b.birth, b.gender, b.orgPos, b.region, b.job, b.tenure, b.career, b.edu, b.cert,
      d.consent.date, pending.getId(), "서명대기", "", "", "", "", now
    ]);
    ss.getSheetByName("receipt").appendRow([
      d.id, d.group, d.name, d.fgiDate, r.address, r.phone, r.bank, "'" + r.account,
      CONFIG.AMOUNT, 0, CONFIG.AMOUNT, r.privacyAgree, r.uidAgree, r.date, "", now
    ]);
    if (prow) ps.getRange(prow, 8, 1, 3).setValues([[d.email, "서명대기", now]]);
    else ps.appendRow([d.id, d.group, d.groupName, 99, d.name, d.org, d.position, d.email, "서명대기", now]);
  } finally { lock.releaseLock(); }

  log(d.id, d.name, d.email, "제출", "서명대기");
  return { ok:true, id:d.id };
}

/* ---------- 2) 연구자 일괄 서명: 동의서 PDF 생성 + 이메일 발송 ---------- */
function handleSign(d) {
  if (d.key !== CONFIG.ADMIN_KEY) throw new Error("비밀번호가 올바르지 않습니다.");
  if (!d.ids || !d.ids.length) throw new Error("대상이 없습니다.");
  if (!d.researcherName || !d.researcherSig) throw new Error("연구자 성명/서명 누락");

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const cs = ss.getSheetByName("consent"), rs = ss.getSheetByName("receipt"), ps = ss.getSheetByName("participants");
  const cHead = cs.getDataRange().getValues(), rAll = rs.getDataRange().getValues();
  const signDate = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy년 M월 d일");
  const results = [];

  const stamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyyMMdd_HHmm");
  d.ids.forEach(id => {
    let name = id;
    try {
      const ci = cHead.findIndex((r,i) => i>0 && r[0] === id);
      if (ci < 0) throw new Error("동의서 데이터 없음");
      const c = cHead[ci]; name = c[2];
      if (c[22] === "완료") throw new Error("이미 서명·발송 완료");
      const ri = rAll.findIndex((r,i) => i>0 && r[0] === id);
      if (ri < 0) throw new Error("영수증 데이터 없음");

      // 제출 원본 복원
      const pendingFile = DriveApp.getFileById(c[21]);
      const data = JSON.parse(pendingFile.getBlob().getDataAsString());
      data.consent.researcherName = d.researcherName;
      data.consent.researcherSig  = d.researcherSig;
      data.consent.researcherDate = signDate;

      const folder = getFolder(`${data.group}_${data.groupName}`);
      const consentPdf = htmlToPdf(buildConsentHtml(data), `동의서_${data.group}_${name}_${stamp}.pdf`);
      const receiptPdf = htmlToPdf(buildReceiptHtml(data), `영수증_${data.group}_${name}_${stamp}.pdf`);
      const f1 = folder.createFile(consentPdf), f2 = folder.createFile(receiptPdf);

      sendMails(data, [consentPdf, receiptPdf]);

      const now = new Date();
      cs.getRange(ci+1, 23, 1, 5).setValues([["완료", d.researcherName, signDate, f1.getUrl(), now]]);
      rs.getRange(ri+1, 15).setValue(f2.getUrl());
      const prow = findRow(ps, id); if (prow) ps.getRange(prow, 9).setValue("완료");
      pendingFile.setTrashed(true);   // 주민번호 포함 원본 삭제
      log(id, name, data.email, "발송", d.researcherName + " 서명 / " + f1.getUrl());
      results.push({ id, name, ok:true, msg:"PDF 2종 생성, 이메일 발송 완료" });
    } catch (err) {
      log(id, name, "", "서명실패", err);
      results.push({ id, name, ok:false, msg:String(err && err.message || err) });
    }
  });
  return { ok:true, results };
}

function validate(d) {
  ["id","group","name","email"].forEach(k => { if (!d[k]) throw new Error("필수값 누락: " + k); });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) throw new Error("이메일 형식 오류");
  if (!d.consent || !d.consent.sig) throw new Error("참여자 서명 누락");
  if (!/^\d{6}$/.test(d.consent.basic.birth)) throw new Error("생년월일 형식 오류");
  if (!d.receipt || !/^\d{6}-\d{7}$/.test(d.receipt.rrn)) throw new Error("주민등록번호 형식 오류");
}
function findRow(sh, id) {
  const n = sh.getLastRow(); if (n < 2) return null;
  const i = sh.getRange(2, 1, n-1, 1).getValues().flat().indexOf(id);
  return i < 0 ? null : i + 2;
}
function htmlToPdf(html, filename) {
  return Utilities.newBlob(html, "text/html", filename.replace(/\.pdf$/, ".html")).getAs("application/pdf").setName(filename);
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function log(id, name, email, result, detail) {
  try { SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName("log").appendRow([new Date(), id||"", name||"", email||"", result, String(detail && detail.message || detail || "")]); } catch(_) {}
}

/* ---------------- 메일 ---------------- */
function sendMails(d, attachments) {
  const subject = `[서울특별시사회복지사협회] FGI 연구참여 동의서·영수증 사본 (${d.name}님)`;
  const body = `
<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;line-height:1.7;color:#1c2430;max-width:600px">
  <p>${d.name}님, 안녕하세요.<br>서울특별시사회복지사협회 정책위원회입니다.</p>
  <p>「${CONFIG.STUDY_TITLE}」 초점집단면접(FGI)에 참여해 주셔서 감사합니다.<br>
  서명하신 <strong>연구참여 동의서</strong>(연구자 ${d.consent.researcherName} 서명 완료)와 <strong>참여수당 영수증</strong> 사본을 PDF로 첨부해 드립니다.</p>
  <table style="border-collapse:collapse;font-size:14px;margin:12px 0">
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">그룹</td><td>${d.group} · ${d.groupName}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">일시</td><td>${d.fgiDate}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#6b7280">참여수당</td><td>100,000원 (입력하신 계좌로 지급 예정)</td></tr>
  </table>
  <p style="font-size:13.5px;color:#4a5565">동의서는 참여자와 연구자가 각 1부씩 보관합니다. 연구 참여와 관련해 궁금한 점이나 불편이 있으시면 언제든지 아래로 연락해 주세요.</p>
  <p style="font-size:13.5px;color:#4a5565">서울특별시사회복지사협회 회원조직팀 고석우 과장<br>02-786-2962 · ${CONFIG.ADMIN_EMAIL}<br>서울시 영등포구 당산로 171, 금강펜테리움 206호</p>
</div>`;
  GmailApp.sendEmail(d.email, subject, "", { htmlBody: body, name: CONFIG.SENDER_NAME, replyTo: CONFIG.REPLY_TO, attachments });
  GmailApp.sendEmail(CONFIG.ADMIN_EMAIL, `[FGI 발송] ${d.group} ${d.name} (${d.org})`, "",
    { htmlBody: `<p>${d.group}·${d.groupName} / ${d.name} / ${d.org} ${d.position}<br>이메일: ${d.email}<br>계좌: ${d.receipt.bank} ${d.receipt.account}<br>연구자: ${d.consent.researcherName}</p>`, name: "FGI 발송 알림", attachments });
}

/* ---------------- 테스트(선택) ---------------- */
function testPdf() {
  const d = {
    id:"A-00", group:"A", groupName:"최고관리자", fgiDate:"2026년 10월 6일(화) 16:00~18:00",
    place:"서울특별시사회복지사협회 304호 다락실", name:"홍길동", org:"테스트복지관", position:"관장", email:CONFIG.ADMIN_EMAIL,
    consent:{ basic:{birth:"800501",gender:"남",orgPos:"테스트복지관 / 관장",region:"영등포구",job:"기관 운영",tenure:"2015년 03월 ~ 현재",career:"20년",edu:"석사졸업",cert:"사회복지사 1급"},
      sig:"", researcherName:"김아래미", researcherSig:"", date:"2026년 10월 6일", researcherDate:"2026년 10월 6일" },
    receipt:{ rrn:"800501-1234567", address:"서울시 영등포구 당산로 171", phone:"010-0000-0000", bank:"국민", account:"000000-00-000000",
      privacyAgree:"동의", uidAgree:"동의", sig:"", date:"2026년 10월 6일" }
  };
  const f = getFolder("TEST");
  f.createFile(htmlToPdf(buildConsentHtml(d), "TEST_동의서.pdf"));
  f.createFile(htmlToPdf(buildReceiptHtml(d), "TEST_영수증.pdf"));
  Logger.log("TEST 폴더에 PDF 2개 생성됨: " + f.getUrl());
}
