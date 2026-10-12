// 業界理解ノート - アプリ本体
// データは data/industries.js（window.INDUSTRIES / window.COMMON_TERMS）から読み込みます。

const INDUSTRIES = window.INDUSTRIES;
const COMMON_TERMS = window.COMMON_TERMS;
const LOCATION_RANK = { "少ない": 1, "中": 2, "多い": 3, "非常に多い": 4 };
const SCALE_NAMES = ["小規模", "中堅", "準大手", "大手"];

// ---------- 共通の小さな道具 ----------

const $ = (id) => document.getElementById(id);

// 入力された文字をそのまま画面に出すときに、HTMLとして解釈されないようにする
function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function findIndustry(id) {
  return INDUSTRIES.find((ind) => ind.id === id);
}

function marginText(ind) {
  return `${ind.margin.min}〜${ind.margin.max}%`;
}

function marginMid(ind) {
  return (ind.margin.min + ind.margin.max) / 2;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 売上（億円）が業界内のどの規模にあたるかを 0〜3 で返す
function scaleIndex(revenue, bands) {
  if (revenue < bands.small) return 0;
  if (revenue < bands.mid) return 1;
  if (revenue < bands.large) return 2;
  return 3;
}

function fillIndustrySelect(select) {
  select.innerHTML = INDUSTRIES.map((ind) => `<option value="${ind.id}">${ind.name}</option>`).join("");
}

// ---------- タブ切り替え ----------

function setupTabs() {
  $("tabs").addEventListener("click", (e) => {
    const tab = e.target.dataset.tab;
    if (!tab) return;
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === tab));
  });
}

// ---------- 業界図鑑 ----------

function renderIndustryList(activeId) {
  const groups = [...new Set(INDUSTRIES.map((ind) => ind.group))];
  $("industryList").innerHTML = groups.map((group) => `
    <div class="group-label">${group}</div>
    ${INDUSTRIES.filter((ind) => ind.group === group).map((ind) => `
      <button data-id="${ind.id}" class="${ind.id === activeId ? "active" : ""}">${ind.name}</button>
    `).join("")}
  `).join("");
}

function chainHtml(ind) {
  const c = ind.hiringChain;
  return `
    <div class="chain">
      <div class="step"><div class="label">業界の構造</div>${c.cause}</div>
      <div class="arrow">↓</div>
      <div class="step"><div class="label">採用への影響</div>${c.hiring}</div>
      <div class="arrow">↓</div>
      <div class="step"><div class="label">経営への影響</div>${c.management}</div>
    </div>
    <div class="hook"><strong>切り出しの一言：</strong>${c.hook}</div>
  `;
}

function renderIndustryDetail(id) {
  const ind = findIndustry(id);
  renderIndustryList(id);
  $("industryDetail").innerHTML = `
    <h2>${ind.name}</h2>
    <p>${ind.summary}</p>

    <div class="stats">
      <div class="stat"><div class="label">営業利益率の目安</div><div class="value">${marginText(ind)}</div></div>
      <div class="stat"><div class="label">拠点数の傾向</div><div class="value">${ind.locations.level}</div></div>
      <div class="stat"><div class="label">中堅企業の売上目安</div><div class="value">${ind.revenueBands.small}〜${ind.revenueBands.mid}億円</div></div>
      <div class="stat"><div class="label">労働集約度</div><div class="value" style="font-size:1rem">${ind.laborIntensity}</div></div>
    </div>

    <div class="card"><h3>含まれる業種</h3><div class="chips">${ind.subIndustries.map((s) => `<span class="chip">${s}</span>`).join("")}</div></div>
    <div class="card"><h3>儲けのしくみ</h3><p>${ind.businessModel}</p><p class="hint">利益率：${ind.margin.note}</p></div>
    <div class="card"><h3>売上規模の感覚</h3><p>${ind.revenueNote}</p></div>
    <div class="card"><h3>拠点の特徴</h3><p>${ind.locations.note}</p></div>
    <div class="card"><h3>最近の動きと影響</h3>
      ${ind.trends.map((t) => `<div class="trend"><div class="period">${t.period}</div><strong>${t.title}</strong><div>→ ${t.impact}</div></div>`).join("")}
    </div>
    <div class="card"><h3>よくある経営課題</h3><div class="chips">${ind.issues.map((s) => `<span class="chip">${s}</span>`).join("")}</div></div>
    <div class="card"><h3>採用の文脈での仮説</h3>${chainHtml(ind)}</div>
    <div class="card"><h3>知っておきたい用語</h3>
      <dl class="terms">${ind.keyTerms.map((t) => `<dt>${t.term}</dt><dd>${t.meaning}</dd>`).join("")}</dl>
    </div>
  `;
}

function setupZukan() {
  $("industryList").addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (id) renderIndustryDetail(id);
  });
  renderIndustryDetail(INDUSTRIES[0].id);
}

// ---------- 業界比較 ----------

const compareColumns = [
  { label: "業界", value: (ind) => ind.name },
  { label: "営業利益率", value: marginMid, display: marginText, num: true },
  { label: "拠点数", value: (ind) => LOCATION_RANK[ind.locations.level], display: (ind) => ind.locations.level, num: true },
  { label: "中堅の売上目安(億円)", value: (ind) => ind.revenueBands.small, display: (ind) => `${ind.revenueBands.small}〜${ind.revenueBands.mid}`, num: true },
  { label: "労働集約度", value: (ind) => ind.laborIntensity },
  { label: "主な課題", value: (ind) => ind.issues.slice(0, 3).join("、") }
];
let compareSort = { col: 1, desc: true };

function renderCompare() {
  const col = compareColumns[compareSort.col];
  const rows = [...INDUSTRIES].sort((a, b) => {
    const va = col.value(a), vb = col.value(b);
    const diff = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "ja");
    return compareSort.desc ? -diff : diff;
  });

  $("compareTable").innerHTML = `
    <thead><tr>${compareColumns.map((c, i) => `<th data-col="${i}">${c.label}${i === compareSort.col ? (compareSort.desc ? " ▼" : " ▲") : ""}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((ind) => `<tr>${compareColumns.map((c) => `<td class="${c.num ? "num" : ""}">${(c.display || c.value)(ind)}</td>`).join("")}</tr>`).join("")}</tbody>
  `;

  // 利益率の幅を横棒で表示（-5%〜20%の範囲）
  const lo = -5, hi = 20;
  const toPct = (v) => ((v - lo) / (hi - lo)) * 100;
  const byMargin = [...INDUSTRIES].sort((a, b) => marginMid(b) - marginMid(a));
  $("marginChart").innerHTML = `<h3>営業利益率の幅（目安）</h3>` + byMargin.map((ind) => `
    <div class="bar-row">
      <span>${ind.name}</span>
      <div class="bar-track"><div class="bar-range" style="left:${toPct(ind.margin.min)}%;width:${toPct(ind.margin.max) - toPct(ind.margin.min)}%"></div></div>
      <span>${marginText(ind)}</span>
    </div>
  `).join("");
}

function setupCompare() {
  $("compareTable").addEventListener("click", (e) => {
    const col = e.target.closest("th")?.dataset.col;
    if (col === undefined) return;
    const n = Number(col);
    compareSort = { col: n, desc: compareSort.col === n ? !compareSort.desc : true };
    renderCompare();
  });
  renderCompare();
}

// ---------- 売上ものさし ----------

function renderRuler() {
  const revenue = Number($("rulerRevenue").value);
  const ind = findIndustry($("rulerIndustry").value);
  const b = ind.revenueBands;
  const idx = scaleIndex(revenue, b);

  // 目盛りは対数スケール。4区間を等幅に並べ、区間内の位置を計算する
  const edges = [b.small / 10, b.small, b.mid, b.large, b.large * 10];
  const clamped = Math.min(Math.max(revenue, edges[0]), edges[4]);
  const within = (Math.log10(clamped) - Math.log10(edges[idx])) / (Math.log10(edges[idx + 1]) - Math.log10(edges[idx]));
  const pos = ((idx + Math.min(Math.max(within, 0), 1)) / 4) * 100;

  $("rulerResult").innerHTML = `
    <div class="card">
      <div class="verdict">売上${revenue}億円は、${ind.name}では「${SCALE_NAMES[idx]}」</div>
      <div class="scale">
        <div class="s1">小規模</div><div class="s2">中堅</div><div class="s3">準大手</div><div class="s4">大手</div>
        <div class="scale-marker" style="left:calc(${pos}% - 1px)"></div>
      </div>
      <div class="scale-labels"><span>${b.small}億</span><span>${b.mid}億</span><span>${b.large}億</span><span></span></div>
      <p>${ind.revenueNote}</p>
      <p class="hint">利益率${marginText(ind)}で計算すると、営業利益はおよそ ${(revenue * ind.margin.min / 100).toFixed(1)}〜${(revenue * ind.margin.max / 100).toFixed(1)}億円。</p>
    </div>
  `;

  $("rulerAll").innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>業界</th><th>規模感</th><th>想定営業利益</th></tr></thead>
    <tbody>${INDUSTRIES.map((i) => `<tr>
      <td>${i.name}</td>
      <td>${SCALE_NAMES[scaleIndex(revenue, i.revenueBands)]}</td>
      <td class="num">${(revenue * marginMid(i) / 100).toFixed(2)}億円</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function setupRuler() {
  fillIndustrySelect($("rulerIndustry"));
  $("rulerRevenue").addEventListener("input", renderRuler);
  $("rulerIndustry").addEventListener("change", renderRuler);
  renderRuler();
}

// ---------- 業種 → 業界 ----------

function renderLookup() {
  const q = $("lookupInput").value.trim().toLowerCase();
  if (!q) {
    $("lookupResult").innerHTML = INDUSTRIES.map((ind) => `
      <div class="card"><h3>${ind.name}</h3><div class="chips">${ind.subIndustries.map((s) => `<span class="chip">${s}</span>`).join("")}</div></div>
    `).join("");
    return;
  }
  const hits = INDUSTRIES.flatMap((ind) => ind.subIndustries
    .filter((sub) => sub.toLowerCase().includes(q) || ind.name.toLowerCase().includes(q))
    .map((sub) => ({ sub, ind })));
  $("lookupResult").innerHTML = hits.length
    ? hits.map(({ sub, ind }) => `<div class="card"><strong>${sub}</strong> は <strong>${ind.name}</strong> に分類されます。<p class="hint">${ind.summary}</p></div>`).join("")
    : `<p>「${esc(q)}」は登録されていません。data/industries.js の subIndustries に追加してみましょう。</p>`;
}

function setupLookup() {
  $("lookupInput").addEventListener("input", renderLookup);
  renderLookup();
}

// ---------- 架電トーク ----------

function renderTalk() {
  const ind = findIndustry($("talkIndustry").value);
  const c = ind.hiringChain;
  $("talkResult").innerHTML = `
    <div class="card"><h3>仮説のつながり</h3>${chainHtml(ind)}</div>
    <div class="card"><h3>トーク例（まとめて言うと）</h3>
      <p>「${ind.name}の企業様ですと、${c.cause}ケースが多いと伺っています。
      そのため${c.hiring.split("→")[0].trim()}という声をよく聞きます。
      結果として、${c.management.split("。")[0]}、というお話も多いのですが、御社ではいかがでしょうか？」</p>
    </div>
    <div class="card"><h3>話の材料になる最近の動き</h3>
      ${ind.trends.map((t) => `<div class="trend"><div class="period">${t.period}</div><strong>${t.title}</strong><div>→ ${t.impact}</div></div>`).join("")}
    </div>
    <div class="card"><h3>相手が使う言葉（使えると信頼される）</h3>
      <div class="chips">${ind.keyTerms.map((t) => `<span class="chip" title="${t.meaning}">${t.term}</span>`).join("")}</div>
    </div>
  `;
}

function setupTalk() {
  fillIndustrySelect($("talkIndustry"));
  $("talkIndustry").addEventListener("change", renderTalk);
  renderTalk();
}

// ---------- 用語集 ----------

function renderTerms() {
  const q = $("termsInput").value.trim().toLowerCase();
  const all = [
    ...COMMON_TERMS.map((t) => ({ ...t, source: "共通" })),
    ...INDUSTRIES.flatMap((ind) => ind.keyTerms.map((t) => ({ ...t, source: ind.name })))
  ];
  const hits = all.filter((t) => !q || t.term.toLowerCase().includes(q) || t.meaning.toLowerCase().includes(q));
  $("termsResult").innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>用語</th><th>意味</th><th>分野</th></tr></thead>
    <tbody>${hits.map((t) => `<tr><td><strong>${t.term}</strong></td><td>${t.meaning}</td><td>${t.source}</td></tr>`).join("")}</tbody>
  </table></div>`;
}

function setupTerms() {
  $("termsInput").addEventListener("input", renderTerms);
  renderTerms();
}

// ---------- 起動 ----------

setupTabs();
setupZukan();
setupCompare();
setupRuler();
setupLookup();
setupTalk();
setupTerms();
// クイズは quiz.js、ダッシュボードは dashboard.js で起動します
