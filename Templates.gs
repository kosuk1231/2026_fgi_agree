/*********************************************************************
 * PDF 템플릿 — 동의서(안내문 포함) · 영수증
 * Utilities.newBlob(html).getAs(PDF) 로 변환됩니다.
 *********************************************************************/

const PDF_CSS = `
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'Noto Sans CJK KR','Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif; font-size:10.5pt; line-height:1.6; color:#111; }
  h1 { text-align:center; font-size:17pt; letter-spacing:.3em; margin:0 0 4px; }
  .sub { text-align:center; font-size:11pt; margin:0 0 14px; }
  h2 { font-size:11.5pt; margin:12px 0 2px; }
  p { margin:0 0 5px; text-align:justify; }
  ol { margin:0 0 5px; padding-left:18px; }
  li { margin-bottom:2px; }
  table { border-collapse:collapse; width:100%; }
  td, th { border:1px solid #333; padding:6px 8px; font-size:10.5pt; vertical-align:middle; }
  th { background:#eef1f5; font-weight:bold; text-align:center; width:26%; }
  .box { border:1px solid #333; padding:10px 12px; margin:8px 0; }
  .sig { height:46px; vertical-align:middle; }
  .sigrow { display:flex; justify-content:space-between; align-items:center; margin:8px 0; }
  .sigline { border-bottom:1px solid #333; display:inline-block; min-width:150px; text-align:center; height:52px; vertical-align:bottom; }
  .small { font-size:9.5pt; color:#444; }
  .center { text-align:center; }
  .right { text-align:right; }
  .pb { page-break-before:always; }
  .chk { font-family:'Noto Sans CJK KR','Malgun Gothic',sans-serif; }
</style>`;

function fmtBirth(v){ v=String(v||"").replace(/\D/g,""); if(v.length!==6) return esc(v); const yy=+v.slice(0,2), cur=new Date().getFullYear()%100; const y=(yy<=cur?2000:1900)+yy; return `${y}년 ${+v.slice(2,4)}월 ${+v.slice(4,6)}일`; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function sigImg(dataUrl, h){ return dataUrl ? `<img src="${dataUrl}" style="height:${h||46}px;vertical-align:middle">` : `<span style="display:inline-block;width:120px;height:${h||46}px"></span>`; }

/* ======================= 동의서 (안내문 + 동의서 + 기본사항) ======================= */
function buildConsentHtml(d) {
  const b = d.consent.basic || {};
  const info = `
<h1>연구참여 안내문</h1>
<p class="sub">${esc(CONFIG.STUDY_TITLE)}</p>
<p>귀하는 위 연구의 초점집단면접(FGI)에 참여하도록 요청받으셨습니다. 본 설명문은 연구의 목적과 방법, 참여에 따르는 이익과 위험, 그리고 귀하의 권리에 관한 정보를 담고 있습니다. 아래 내용을 충분히 읽어 보시고, 궁금한 점은 담당 연구자에게 자유롭게 문의하신 뒤 참여 여부를 결정하여 주시기 바랍니다.</p>
<h2>1. 연구 배경 및 목적</h2>
<p>최근 사회복지현장에서 인공지능(AI) 기술의 활용이 빠르게 확산되고 있으나, 그 활용을 뒷받침할 윤리적 기준과 실천 지침은 충분히 마련되어 있지 않은 실정입니다. 본 연구는 사회복지사의 AI 활용 실태와 윤리적 인식, 현장에서 겪는 어려움을 심층적으로 파악하여, 사회복지현장에 적합한 ‘AI 실천윤리 가이드’를 개발하기 위한 기초자료를 수집하는 데 목적이 있습니다.</p>
<h2>2. 연구 참여 대상 및 인원</h2>
<p>사회복지현장에서 근무 중인 사회복지사를 직급별로 구분하여, 최고관리자 · 중간관리자 · 실무자 3개 그룹으로 각 5명씩, 총 15명 내외를 모집합니다. 귀하는 해당 조건에 부합하여 참여를 요청받으셨습니다.</p>
<h2>3. 연구 방법 및 절차</h2>
<ol>
<li>동일 직급의 참여자 5명이 한 그룹을 이루어 진행자와 함께 집단 면담(FGI)을 진행합니다.</li>
<li>면담은 사전에 준비된 반구조화 질문지를 바탕으로, AI 이해와 활용, 윤리적 문제의식, 교육 및 가이드에 관한 의견을 자유롭게 나누는 방식으로 이루어집니다.</li>
<li>면담은 1회, 약 90～120분 소요되며, 정확한 기록과 분석을 위해 참여자의 동의를 받아 면담 내용을 음성 녹음(필요시 영상 녹화)하며, 별도의 현장 기록을 병행합니다.</li>
</ol>
<h2>4. 예상되는 위험 및 불편</h2>
<p>본 연구의 면담은 일상적인 업무 경험과 의견을 나누는 것으로, 신체적 위험은 없습니다. 다만 면담 참여에 따른 시간 소요, 집단 상황에서 의견을 말하는 데 따르는 심리적 부담이 있을 수 있습니다. 답변하기 곤란한 질문에는 답하지 않으실 수 있으며, 언제든지 휴식을 요청하거나 참여를 중단하실 수 있습니다.</p>
<h2>5. 예상되는 이익</h2>
<p>귀하가 본 연구에 참여함으로써 직접적으로 얻는 이익은 없을 수 있습니다. 그러나 귀하의 경험과 의견은 사회복지현장에 실질적으로 도움이 되는 AI 실천윤리 가이드를 개발하는 데 중요한 기초가 되며, 이는 장기적으로 현장 전반의 실천 여건 개선에 기여할 수 있습니다.</p>
<h2>6. 참여에 따른 보상</h2>
<p>면담에 참여하신 분께는 소정의 사례비(100,000원)를 지급합니다. 보상 지급을 위해 필요한 최소한의 정보(성명, 연락처, 지급 관련 정보)는 관련 법령에 따라 처리·보관되며, 연구 목적 외에는 사용되지 않습니다.</p>
<h2>7. 개인정보 보호 및 비밀보장</h2>
<ol>
<li>면담에서 수집된 모든 자료는 연구 목적으로만 사용됩니다.</li>
<li>녹음자료와 녹취록 등 분석 자료에서 참여자의 성명, 소속 기관명 등 개인 식별정보는 익명 처리(예: 참여자 A, B …)되며, 연구 결과 보고 시 특정 개인이나 기관이 식별되지 않도록 합니다.</li>
<li>수집된 자료는 비밀번호가 설정된 저장매체 또는 접근이 제한된 공간에 보관하며, 연구책임자와 지정된 연구원만 접근할 수 있습니다.</li>
<li>집단 면담의 특성상, 같은 그룹의 다른 참여자에게 공유된 내용에 대해서는 연구진이 완전한 비밀을 보장하기 어려우므로, 참여자 전원에게 면담 중 알게 된 내용을 외부에 발설하지 않을 것을 요청드립니다.</li>
</ol>
<h2>8. 자료의 보관 및 폐기</h2>
<p>수집된 자료는 관련 규정에 따라 연구 종료 후 2년 간 보관한 뒤, 복구가 불가능한 방법으로 안전하게 폐기합니다.(전자파일은 영구 삭제, 출력물은 파쇄)</p>
<h2>9. 연구 결과의 활용</h2>
<p>본 연구의 결과는 AI 실천윤리 가이드 개발, 연구보고서, 학술논문 발표, 관련 교육자료 제작 등에 활용될 수 있습니다. 이 경우에도 개인 식별이 불가능한 형태로만 제시됩니다.</p>
<h2>10. 자발적 참여 및 중도 철회</h2>
<p>본 연구에의 참여는 전적으로 자발적입니다. 참여를 원하지 않으시면 거부하실 수 있으며, 이로 인한 어떠한 불이익도 없습니다. 또한 참여에 동의하신 후에도 언제든지 이유를 밝히지 않고 참여를 중단하실 수 있으며, 이 경우 귀하의 자료는 분석에서 제외·폐기됩니다. (단, 이미 익명 처리되어 분리·분석된 자료는 철회가 어려울 수 있습니다.)</p>
<h2>11. 문의처</h2>
<table>
<tr><th>연구책임자</th><td>조소연 (사회복지연구소 마실 공동대표)<br>김아래미 (서울여자대학교 사회복지학과 교수)</td></tr>
<tr><th>연구수행기관</th><td>서울특별시사회복지사협회<br>주소 : 서울시 영등포구 당산로 171, 금강펜테리움 206호 (02-786-2962)</td></tr>
</table>
<p class="small" style="margin-top:6px">※ 연구 참여자로서 귀하의 권리에 관하여 궁금한 점이 있으시거나 불편·피해가 발생한 경우, 위 문의처로 언제든지 연락하실 수 있습니다.</p>`;

  const consent = `
<div class="pb"></div>
<h1>연구참여 동의서</h1>
<p class="sub">연구제목: ${esc(CONFIG.STUDY_TITLE)}</p>
<div class="box">
<p><span class="chk">☑</span> 1. 나는 본 연구에 대한 설명문을 읽었으며, 연구의 목적과 방법에 대해 충분히 설명을 들었습니다.</p>
<p><span class="chk">☑</span> 2. 나는 나의 연구 참여가 자발적인 것이며, 언제든지 불이익 없이 참여를 중단할 수 있음을 이해합니다.</p>
<p><span class="chk">☑</span> 3. 나는 면담 내용이 익명으로 처리되고 연구 목적으로만 사용되며, 관련 규정에 따라 보관·폐기됨을 이해합니다. 나는 수집된 개인정보의 처리 및 이용에 동의합니다.</p>
<p><span class="chk">☑</span> 4. 나는 정확한 기록을 위해 면담 내용이 음성 녹음되는 것에 동의합니다.</p>
</div>
<p style="margin:12px 0 10px"><strong>본인은 위 사항을 확인하였으며, 위 연구에 자발적으로 참여할 것에 동의합니다.</strong></p>
<table>
<tr><th style="width:22%">연구 참여자</th>
    <td style="width:38%">성명: <strong>${esc(d.name)}</strong> &nbsp; ${sigImg(d.consent.sig, 44)} <span class="small">(서명)</span></td>
    <td>날짜: ${esc(d.consent.date)}</td></tr>
<tr><th>동의를 받은 연구자</th>
    <td>성명: <strong>${esc(d.consent.researcherName)}</strong> &nbsp; ${sigImg(d.consent.researcherSig, 44)} <span class="small">(서명)</span></td>
    <td>날짜: ${esc(d.consent.researcherDate||d.consent.date)}</td></tr>
</table>
<p class="small" style="margin-top:6px">본 동의서는 2부 작성하여 참여자와 연구자가 각 1부씩 보관합니다. (전자서명본 — 참여자 이메일 발송본과 협회 보관본)</p>
<p class="small">FGI 그룹: ${esc(d.group)} · ${esc(d.groupName)} &nbsp;|&nbsp; 일시: ${esc(d.fgiDate)} &nbsp;|&nbsp; 장소: ${esc(d.place||"")}</p>

<h2 style="margin-top:22px">기본사항</h2>
<table>
<tr><th>생년월일</th><td>${fmtBirth(b.birth)}</td><th>성별</th><td>${esc(b.gender)}</td></tr>
<tr><th>소속기관/직급</th><td colspan="3">${esc(b.orgPos)}</td></tr>
<tr><th>근무지역</th><td>${esc(b.region)}</td><th>사회복지 근무 경력</th><td>${esc(b.career)}</td></tr>
<tr><th>주요 업무</th><td colspan="3">${esc(b.job)}</td></tr>
<tr><th>현 기관 근무기간</th><td colspan="3">${esc(b.tenure)}</td></tr>
<tr><th>학력</th><td>${esc(b.edu)}</td><th>자격증</th><td>${esc(b.cert)}</td></tr>
</table>
<p class="small right" style="margin-top:14px">전자서명 일시: ${Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm")} · 접수번호 ${esc(d.id)}</p>`;

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">${PDF_CSS}</head><body>${info}${consent}</body></html>`;
}

/* ======================= 영수증 ======================= */
function buildReceiptHtml(d) {
  const r = d.receipt;
  const amt = CONFIG.AMOUNT.toLocaleString("ko-KR");
  const yy = r.date || Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy년 M월 d일");
  const html = `
<h1 style="letter-spacing:.5em;font-size:20pt;margin-bottom:14px">영 수 증</h1>
<table>
<tr><th>사업명</th><td colspan="3">${esc(CONFIG.PROJECT)}</td></tr>
<tr><th>일&nbsp;&nbsp;시</th><td colspan="3">${esc(d.fgiDate)}</td></tr>
<tr><th>성&nbsp;&nbsp;명</th><td>${esc(d.name)}</td><th>주민등록번호</th><td>${esc(r.rrn)}</td></tr>
<tr><th>주&nbsp;&nbsp;소</th><td colspan="3">${esc(r.address)}</td></tr>
<tr><th>전화번호</th><td>${esc(r.phone)}</td><th>은행명/계좌번호</th><td>${esc(r.bank)} / ${esc(r.account)}</td></tr>
<tr><th>구&nbsp;&nbsp;분</th><td colspan="3"><span class="chk">■</span> FGI 수당 &nbsp;&nbsp; <span class="chk">□</span> 회의수당 &nbsp;&nbsp; <span class="chk">□</span> 기타(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</td></tr>
<tr><th>금&nbsp;&nbsp;액</th><td colspan="3"><strong>금일십만원정 (￦${amt})</strong></td></tr>
<tr><th>원천징수액</th><td colspan="3">0원 &nbsp;&nbsp; <span class="chk">□</span> 사업소득 (3.3%) &nbsp;&nbsp; <span class="chk">□</span> 기타소득 (8.8%) &nbsp;&nbsp; <span class="small">※ 10만원 이하 원천징수 대상 아님</span></td></tr>
<tr><th>실수령액</th><td colspan="3"><strong>${amt}원</strong></td></tr>
</table>

<div class="box" style="margin-top:14px">
<p class="center"><strong>&lt;개인정보수집 및 이용에 대한 동의&gt;</strong></p>
<p>서울특별시사회복지사협회는 아래와 같이 개인정보를 수집․이용하는 내용을 관계 법령에 따라 알리오니, 동의하여 주시기 바랍니다.</p>
<p class="center">- 아 래 -</p>
<p>[수집/이용항목] 성명, 주민등록번호, 주소, 입금계좌</p>
<p>[수집/이용목적] 강사비 및 수당, 원고료 등의 지급을 위한 본인확인 및 입금정보 등으로 이용되며, 수집한 개인정보는 목적 외의 다른 목적으로 사용되지 않습니다.</p>
<p>[이용 및 보유기간] 수집된 개인정보는 강사비 및 수당, 원고료 등의 입금 및 증빙을 위해서만 사용되며 회계 관련서류에 포함되어 증빙됩니다.</p>
<p>[동의거부 및 불이익] 귀하는 상기 동의를 거부할 수 있습니다. 다만, 동의가 없을 경우 강사비 및 수당, 원고료 등 입금처리가 어려울 수 있습니다.</p>
<p style="margin-top:6px">위 개인정보 수집․이용에 동의하십니까? &nbsp;&nbsp; ${r.privacyAgree==="동의" ? '<span class="chk">■</span> 동의 &nbsp;&nbsp; <span class="chk">□</span> 동의하지 않음' : '<span class="chk">□</span> 동의 &nbsp;&nbsp; <span class="chk">■</span> 동의하지 않음'}</p>
</div>
<div class="box">
<p class="center"><strong>&lt;고유식별정보 수집 및 이용에 대한 동의&gt;</strong></p>
<p>서울특별시사회복지사협회는 기타소득세 신고의 목적으로 고유식별정보(주민등록번호)를 수집하고 있습니다.</p>
<p>고유식별정보 수집에 동의하십니까? &nbsp;&nbsp; ${r.uidAgree==="동의" ? '<span class="chk">■</span> 동의 &nbsp;&nbsp; <span class="chk">□</span> 동의하지 않음' : '<span class="chk">□</span> 동의 &nbsp;&nbsp; <span class="chk">■</span> 동의하지 않음'}</p>
</div>

<p class="center" style="margin-top:22px;font-size:12pt"><strong>위 금액을 정히 영수함.</strong></p>
<p class="center" style="margin-top:8px">${esc(yy)}</p>
<p class="right" style="margin-top:10px;font-size:12pt">${esc(d.name)} &nbsp; ${sigImg(r.sig, 50)} <span class="small">(인/서명)</span></p>
<p class="center" style="margin-top:26px;font-size:13pt;letter-spacing:.1em"><strong>서울특별시사회복지사협회 귀중</strong></p>
<p class="small right" style="margin-top:30px">전자서명 일시: ${Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm")} · 접수번호 ${esc(d.id)}</p>`;
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">${PDF_CSS}</head><body>${html}</body></html>`;
}
