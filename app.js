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

// PCの上部タブ・スマホの下部ナビ・「その他」メニューのどれから押しても同じ画面に切り替わる
// 「その他」に入っている画面を開いたときは、下部ナビの「その他」を選択状態にする
const MORE_TABS = ["compare", "ruler", "lookup", "terms", "guide", "more"];

function openTab(tab) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".bottom-nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab || (b.dataset.tab === "more" && MORE_TABS.includes(tab)));
  });
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === tab));
  document.dispatchEvent(new CustomEvent("tabchange", { detail: tab }));
  window.scrollTo(0, 0);
}

function setupTabs() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (btn) openTab(btn.dataset.tab);
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

const THEMES = ["売上", "コスト", "人材", "DX・業務"];

function chainHtml(c) {
  return `
    <div class="chain">
      <div class="step"><div class="label">業界の構造（原因）</div>${c.cause}</div>
      <div class="arrow">↓</div>
      <div class="step"><div class="label">起きること</div>${c.effect}</div>
      <div class="arrow">↓</div>
      <div class="step"><div class="label">経営への影響</div>${c.impact}</div>
    </div>
    <div class="hook"><strong>切り出しの一言：</strong>${c.hook}</div>
  `;
}

// 売上／コスト／人材／DX の切り替え付きで課題の連鎖を表示する
function themedChainsHtml(ind, prefix) {
  return `
    <div class="segmented" data-chain-switch="${prefix}">
      ${ind.issueChains.map((c, i) => `<button data-chain-index="${i}" class="${i === 0 ? "active" : ""}">${c.theme}</button>`).join("")}
    </div>
    <div id="${prefix}-chain">${chainHtml(ind.issueChains[0])}</div>
  `;
}

function bindChainSwitch(ind, prefix) {
  const sw = document.querySelector(`[data-chain-switch="${prefix}"]`);
  sw.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-chain-index]");
    if (!btn) return;
    sw.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    $(`${prefix}-chain`).innerHTML = chainHtml(ind.issueChains[Number(btn.dataset.chainIndex)]);
  });
}

function listCard(title, items) {
  return `<div class="card"><h3>${title}</h3><dl class="terms">${items.map((t) => `<dt>${t.name || t.term}</dt><dd>${t.meaning}</dd>`).join("")}</dl></div>`;
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

    <div class="card"><h3>市場規模</h3><p>${ind.marketSize}</p></div>
    <div class="card"><h3>含まれる業種</h3><div class="chips">${ind.subIndustries.map((s) => `<span class="chip">${s}</span>`).join("")}</div></div>
    <div class="card"><h3>儲けのしくみ</h3><p>${ind.businessModel}</p>
      <p><strong>コスト構造：</strong>${ind.costStructure}</p><p class="hint">利益率：${ind.margin.note}</p></div>
    <div class="card"><h3>経営課題の仮説（原因 → 影響）</h3>${themedChainsHtml(ind, "zukan")}</div>
    <div class="card"><h3>最近の動きと影響</h3>
      ${ind.trends.map((t) => `<div class="trend"><div class="period">${t.period}</div><strong>${t.title}</strong><div>→ ${t.impact}</div></div>`).join("")}
    </div>
    ${listCard("経営者が見ているKPI", ind.kpis)}
    ${listCard("押さえておきたい法律・制度", ind.regulations)}
    <div class="card"><h3>主な大手企業</h3><div class="chips">${ind.majorPlayers.map((s) => `<span class="chip">${s}</span>`).join("")}</div></div>
    <div class="card"><h3>売上規模・拠点・季節性</h3>
      <p>${ind.revenueNote}</p><p>${ind.locations.note}</p><p>${ind.seasonality}</p></div>
    <div class="card"><h3>よくある経営課題</h3><div class="chips">${ind.issues.map((s) => `<span class="chip">${s}</span>`).join("")}</div></div>
    ${listCard("知っておきたい用語", ind.keyTerms)}
  `;
  bindChainSwitch(ind, "zukan");
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
  const c = ind.issueChains.find((x) => x.theme === $("talkTheme").value) || ind.issueChains[0];
  $("talkResult").innerHTML = `
    <div class="card"><h3>仮説のつながり（${c.theme}）</h3>${chainHtml(c)}</div>
    <div class="card"><h3>トーク例（まとめて言うと）</h3>
      <p>「${ind.name}の企業様ですと、${c.cause}というケースが多いと伺っています。
      その結果、${c.effect}というお声をよく聞きます。
      ${c.impact.split("。")[0]}、というお話も多いのですが、御社ではいかがでしょうか？」</p>
    </div>
    <div class="card"><h3>数字で確認するなら（KPI）</h3>
      <dl class="terms">${ind.kpis.map((k) => `<dt>${k.name}</dt><dd>${k.meaning}</dd>`).join("")}</dl>
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
  $("talkTheme").innerHTML = THEMES.map((t) => `<option>${t}</option>`).join("");
  $("talkIndustry").addEventListener("change", renderTalk);
  $("talkTheme").addEventListener("change", renderTalk);
  renderTalk();
}

// ---------- 用語集 ----------

function renderTerms() {
  const q = $("termsInput").value.trim().toLowerCase();
  const all = [
    ...COMMON_TERMS,
    ...INDUSTRIES.flatMap((ind) => [
      ...ind.keyTerms.map((t) => ({ ...t, source: ind.name })),
      ...ind.kpis.map((k) => ({ term: k.name, meaning: k.meaning, source: `${ind.name}・KPI` })),
      ...ind.regulations.map((r) => ({ term: r.name, meaning: r.meaning, source: `${ind.name}・法律/制度` }))
    ])
  ];
  const hits = all.filter((t) => !q || t.term.toLowerCase().includes(q) || t.meaning.toLowerCase().includes(q));
  $("termsResult").innerHTML = `<p class="hint">${hits.length}件</p>` + hits.map((t) => `
    <div class="term-item"><div><strong>${t.term}</strong> <span class="chip">${t.source}</span></div><div>${t.meaning}</div></div>
  `).join("");
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
$("updatedAt").textContent = window.DATA_UPDATED_AT;
// クイズは quiz.js、ダッシュボードは dashboard.js で起動します
