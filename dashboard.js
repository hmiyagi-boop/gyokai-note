// ダッシュボード：回答履歴（quiz.js が保存）から正答率の傾向を表示する

const WEAK_THRESHOLD = 60; // これ未満の正答率を「要復習」とする

function percent(s) {
  return Math.round((s.correct / s.total) * 100);
}

// 横棒グラフ（正答率の低い順に並べる）
function rateBars(stats, { linkToZukan = false } = {}) {
  const rows = Object.entries(stats).sort((a, b) => percent(a[1]) - percent(b[1]));
  if (!rows.length) return `<p class="hint">まだデータがありません。</p>`;
  return rows.map(([name, s]) => {
    const p = percent(s);
    const weak = p < WEAK_THRESHOLD && s.total >= 2;
    const ind = INDUSTRIES.find((i) => i.name === name);
    const label = linkToZukan && ind ? `<button class="link-btn" data-industry="${ind.id}">${name}</button>` : name;
    return `
      <div class="bar-row" title="${name}：${s.correct}/${s.total}問正解（${p}%）">
        <span>${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${p}%"></div></div>
        <span class="bar-value">${p}% <small>(${s.correct}/${s.total})</small>${weak ? ` <span class="mark-bad">⚠ 要復習</span>` : ""}</span>
      </div>
    `;
  }).join("");
}

// 直近のプレーごとの正答率（縦棒）
function roundColumns(history) {
  const recent = history.slice(-20);
  return `
    <div class="columns">
      ${recent.map((r, i) => {
        const c = r.results.filter((x) => x.correct).length;
        const p = Math.round((c / r.results.length) * 100);
        const d = new Date(r.at);
        const when = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
        return `<div class="column" title="${when}：${c}/${r.results.length}問正解（${p}%）">
          <div class="column-fill" style="height:${Math.max(p, 2)}%"></div>
          <span class="column-label">${history.length - recent.length + i + 1}</span>
        </div>`;
      }).join("")}
    </div>
    <div class="columns-axis"><span>古い</span><span>プレー回（直近${recent.length}回）</span><span>新しい</span></div>
  `;
}

function renderDashboard() {
  const history = loadHistory();
  const box = $("dashboardBox");
  if (!history.length) {
    box.innerHTML = `<div class="card"><p>まだ回答履歴がありません。クイズで3問チャレンジしてみましょう。</p>
      <button class="btn" id="dashGoQuiz">クイズへ</button></div>`;
    $("dashGoQuiz").addEventListener("click", () => openTab("quiz"));
    return;
  }

  const all = history.flatMap((r) => r.results);
  const overall = Math.round((all.filter((r) => r.correct).length / all.length) * 100);
  const recentAll = history.slice(-5).flatMap((r) => r.results);
  const recent = Math.round((recentAll.filter((r) => r.correct).length / recentAll.length) * 100);
  const diff = recent - overall;

  const byIndustry = statsBy("industry");
  const weakest = Object.entries(byIndustry)
    .filter(([, s]) => percent(s) < WEAK_THRESHOLD)
    .sort((a, b) => percent(a[1]) - percent(b[1]))
    .slice(0, 3);

  box.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="label">通算の正答率</div><div class="value">${overall}%</div><div class="sub">${all.length}問回答</div></div>
      <div class="stat"><div class="label">直近5回の正答率</div><div class="value">${recent}%</div>
        <div class="sub">通算より ${diff >= 0 ? "▲" : "▼"}${Math.abs(diff)}pt</div></div>
      <div class="stat"><div class="label">プレー回数</div><div class="value">${history.length}回</div></div>
      <div class="stat"><div class="label">学習した業界</div><div class="value">${Object.keys(byIndustry).length} / ${INDUSTRIES.length}</div></div>
    </div>

    ${weakest.length ? `
      <div class="card">
        <h3>次に復習したい業界</h3>
        <p>${weakest.map(([name, s]) => `<strong>${name}</strong>（${percent(s)}%）`).join("、")}</p>
        <button class="btn" id="dashWeakQuiz">苦手を優先して3問</button>
      </div>` : ""}

    <div class="card"><h3>プレーごとの正答率</h3>${roundColumns(history)}</div>
    <div class="card"><h3>分野別の正答率</h3><div class="bar-chart">${rateBars(statsBy("category"))}</div></div>
    <div class="card"><h3>問題の種類別の正答率</h3><div class="bar-chart">${rateBars(statsBy("type"))}</div></div>
    <div class="card"><h3>業界別の正答率</h3><p class="hint">業界名をクリックすると図鑑が開きます。</p>
      <div class="bar-chart">${rateBars(byIndustry, { linkToZukan: true })}</div></div>

    <button class="btn btn-secondary" id="dashReset">履歴をリセット</button>
  `;

  $("dashWeakQuiz")?.addEventListener("click", () => {
    openTab("quiz");
    startRound("weak");
  });
  box.querySelectorAll("[data-industry]").forEach((b) => b.addEventListener("click", () => {
    openTab("zukan");
    renderIndustryDetail(b.dataset.industry);
  }));
  $("dashReset").addEventListener("click", () => {
    if (confirm("回答履歴をすべて消去します。よろしいですか？")) {
      clearHistory();
      renderDashboard();
    }
  });
}

// ダッシュボードを開くたびに最新の履歴で描き直す
document.addEventListener("tabchange", (e) => {
  if (e.detail === "dashboard") renderDashboard();
});
renderDashboard();
