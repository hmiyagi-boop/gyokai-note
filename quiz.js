// クイズ（1回3問）と回答履歴の保存
// 回答履歴はブラウザの localStorage に保存され、dashboard.js が集計に使います。

const QUESTIONS_PER_ROUND = 3;
const HISTORY_KEY = "gyokai-note-history";

// ---------- 回答履歴の保存・読み込み ----------

// localStorage が使えない環境（プライベートブラウズ等）でも動くよう、メモリにも持っておく
let memoryHistory = [];

function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) memoryHistory = JSON.parse(saved);
  } catch (e) { /* 読めなければメモリの履歴を使う */ }
  return memoryHistory;
}

function saveRound(results) {
  const history = loadHistory();
  history.push({ at: new Date().toISOString(), results });
  memoryHistory = history;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) { /* 保存できなくても続行 */ }
}

function clearHistory() {
  memoryHistory = [];
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* 何もしない */ }
}

// 業界ごとの正答率 { 業界名: { correct, total } }
function statsBy(key) {
  const stats = {};
  loadHistory().flatMap((round) => round.results).forEach((r) => {
    const name = r[key];
    stats[name] = stats[name] || { correct: 0, total: 0 };
    stats[name].total++;
    if (r.correct) stats[name].correct++;
  });
  return stats;
}

// ---------- 問題をつくる ----------
// 各関数は業界を1つ受け取り、その業界についての問題を返す。
// 返す形：{ type, industry, question, choices, answer, explain }

const DEDUPED_TERMS = (() => {
  const all = INDUSTRIES.flatMap((ind) => ind.keyTerms.map((t) => ({ ...t, ind })));
  return all.filter((t, i) => all.findIndex((u) => u.term === t.term) === i);
})();

const questionMakers = [
  {
    type: "業種分類",
    make: (ind) => {
      const sub = pick(ind.subIndustries);
      const others = shuffle(INDUSTRIES.filter((i) => i !== ind)).slice(0, 3);
      return {
        question: `「${sub}」はどの業界に分類される？`,
        choices: shuffle([ind, ...others]).map((i) => i.name),
        answer: ind.name,
        explain: `${sub} は ${ind.name} に分類されます。${ind.summary}`
      };
    }
  },
  {
    type: "利益率",
    make: (ind) => {
      const candidates = INDUSTRIES.filter((i) => i !== ind && Math.abs(marginMid(i) - marginMid(ind)) >= 3);
      const other = pick(candidates);
      const high = marginMid(ind) > marginMid(other) ? ind : other;
      return {
        question: `営業利益率が高い傾向にあるのはどっち？`,
        choices: shuffle([ind.name, other.name]),
        answer: high.name,
        explain: `${ind.name}：${marginText(ind)}、${other.name}：${marginText(other)}。${high.margin.note}`
      };
    }
  },
  {
    type: "用語",
    make: (ind) => {
      const target = pick(ind.keyTerms);
      const others = shuffle(DEDUPED_TERMS.filter((t) => t.term !== target.term)).slice(0, 3);
      return {
        question: `${ind.name}でよく使う「${target.meaning}」を表す用語は？`,
        choices: shuffle([target.term, ...others.map((t) => t.term)]),
        answer: target.term,
        explain: `${target.term}：${target.meaning}`
      };
    }
  },
  {
    type: "拠点数",
    make: (ind) => ({
      question: `${ind.name}の拠点数（店舗・営業所・事業所）の傾向は？`,
      choices: Object.keys(LOCATION_RANK),
      answer: ind.locations.level,
      explain: `${ind.name}は「${ind.locations.level}」。${ind.locations.note}`
    })
  },
  {
    type: "売上規模",
    make: (ind) => {
      const revenue = pick([3, 10, 30, 100, 500, 2000]);
      const idx = scaleIndex(revenue, ind.revenueBands);
      const b = ind.revenueBands;
      return {
        question: `売上${revenue}億円の${ind.name}の会社。業界内の規模感は？`,
        choices: SCALE_NAMES,
        answer: SCALE_NAMES[idx],
        explain: `${ind.name}の目安は「〜${b.small}億円：小規模／〜${b.mid}億円：中堅／〜${b.large}億円：準大手／それ以上：大手」。${ind.revenueNote}`
      };
    }
  },
  {
    type: "最近の動き",
    make: (ind) => {
      const trend = pick(ind.trends);
      // 同じテーマ（2024年問題など）が他業界にもある場合は、紛らわしいので選択肢から外す
      const keywords = ["2024", "時間外", "最低賃金", "人手不足", "生成AI", "インバウンド", "物価", "高騰", "DX"];
      const shared = keywords.filter((k) => trend.title.includes(k));
      const others = shuffle(INDUSTRIES.filter((i) => i !== ind &&
        !i.trends.some((t) => shared.some((k) => t.title.includes(k))))).slice(0, 3);
      return {
        question: `「${trend.title}」の影響を特に受けているのは？`,
        choices: shuffle([ind, ...others]).map((i) => i.name),
        answer: ind.name,
        explain: `${ind.name}：${trend.impact}`
      };
    }
  },
  {
    type: "採用→経営",
    make: (ind) => {
      const others = shuffle(INDUSTRIES.filter((i) => i !== ind)).slice(0, 3);
      return {
        question: `「${ind.hiringChain.cause}」という構造があり、採用・経営に影響が出やすいのは？`,
        choices: shuffle([ind, ...others]).map((i) => i.name),
        answer: ind.name,
        explain: `${ind.name}：${ind.hiringChain.hiring} → ${ind.hiringChain.management}`
      };
    }
  }
];

// 苦手な業界ほど選ばれやすくする（正答率が低いほど重みが大きい。未回答は標準）
function pickIndustry(mode) {
  if (mode !== "weak") return pick(INDUSTRIES);
  const stats = statsBy("industry");
  const weights = INDUSTRIES.map((ind) => {
    const s = stats[ind.name];
    return s ? 1 - s.correct / s.total + 0.2 : 0.6;
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < INDUSTRIES.length; i++) {
    r -= weights[i];
    if (r <= 0) return INDUSTRIES[i];
  }
  return INDUSTRIES[INDUSTRIES.length - 1];
}

// 1回分の問題をつくる。問題の種類は重複しないように選ぶ。
// ※ 将来AIに出題させる場合は、この関数をAI呼び出しに差し替える
async function buildRound(mode) {
  const makers = shuffle(questionMakers).slice(0, QUESTIONS_PER_ROUND);
  return makers.map((m) => {
    const ind = pickIndustry(mode);
    return { type: m.type, industry: ind.name, industryId: ind.id, ...m.make(ind) };
  });
}

// ---------- 画面 ----------

const round = { questions: [], index: 0, results: [] };

function overallRate() {
  const all = loadHistory().flatMap((r) => r.results);
  if (!all.length) return null;
  return { rate: Math.round((all.filter((r) => r.correct).length / all.length) * 100), total: all.length };
}

function renderQuizStart() {
  const overall = overallRate();
  $("quizBox").innerHTML = `
    <div class="card quiz-start">
      <h3>${QUESTIONS_PER_ROUND}問チャレンジ</h3>
      <p class="hint">業種分類・利益率・用語・売上規模・最近の動き・採用→経営などから出題します。</p>
      <label>出題モード
        <select id="quizMode">
          <option value="random">全業界からランダム</option>
          <option value="weak">苦手な業界を優先</option>
        </select>
      </label>
      <button class="btn" id="quizStartBtn">スタート</button>
      <p class="hint">${overall ? `これまでの正答率：${overall.rate}%（${overall.total}問）` : "まだ回答履歴はありません。"}</p>
    </div>
  `;
  $("quizStartBtn").addEventListener("click", () => startRound($("quizMode").value));
}

async function startRound(mode) {
  round.questions = await buildRound(mode);
  round.index = 0;
  round.results = [];
  renderQuestion();
}

function renderQuestion() {
  const q = round.questions[round.index];
  const isLast = round.index === round.questions.length - 1;
  $("quizBox").innerHTML = `
    <div class="card">
      <div class="quiz-progress">${round.index + 1} / ${round.questions.length}問目 <span class="chip">${q.type}</span></div>
      <div class="quiz-q">${q.question}</div>
      <div class="choices">${q.choices.map((c) => `<button data-choice="${esc(c)}">${c}</button>`).join("")}</div>
      <div id="quizAfter"></div>
    </div>
  `;
  $("quizBox").querySelector(".choices").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    const chosen = btn.dataset.choice;
    const correct = chosen === q.answer;
    round.results.push({
      type: q.type, industry: q.industry, industryId: q.industryId,
      question: q.question, chosen, answer: q.answer, explain: q.explain, correct
    });
    $("quizBox").querySelectorAll(".choices button").forEach((b) => {
      b.disabled = true;
      if (b.dataset.choice === q.answer) b.classList.add("correct");
    });
    if (!correct) btn.classList.add("wrong");
    $("quizAfter").innerHTML = `
      <p class="${correct ? "mark-good" : "mark-bad"}">${correct ? "○ 正解" : "× 不正解"}</p>
      <button class="btn" id="quizNext">${isLast ? "結果と解説を見る" : "次の問題"}</button>
    `;
    $("quizNext").addEventListener("click", () => {
      if (isLast) {
        saveRound(round.results);
        renderResult();
      } else {
        round.index++;
        renderQuestion();
      }
    });
  });
}

function renderResult() {
  const correctCount = round.results.filter((r) => r.correct).length;
  const rate = Math.round((correctCount / round.results.length) * 100);
  const overall = overallRate();
  $("quizBox").innerHTML = `
    <div class="card">
      <h3>結果</h3>
      <div class="stats">
        <div class="stat"><div class="label">今回</div><div class="value">${correctCount} / ${round.results.length}問</div><div class="sub">正答率 ${rate}%</div></div>
        <div class="stat"><div class="label">通算の正答率</div><div class="value">${overall.rate}%</div><div class="sub">${overall.total}問中</div></div>
      </div>
    </div>
    ${round.results.map((r, i) => `
      <div class="card result-item">
        <div class="quiz-progress">${i + 1}問目 <span class="chip">${r.type}</span> <span class="chip">${r.industry}</span>
          <span class="${r.correct ? "mark-good" : "mark-bad"}">${r.correct ? "○ 正解" : "× 不正解"}</span></div>
        <div class="quiz-q">${r.question}</div>
        <p>あなたの回答：<strong>${r.chosen}</strong>${r.correct ? "" : ` ／ 正解：<strong>${r.answer}</strong>`}</p>
        <div class="explain"><strong>解説</strong> ${r.explain}</div>
        <button class="link-btn" data-industry="${r.industryId}">${r.industry}を図鑑で復習する →</button>
      </div>
    `).join("")}
    <button class="btn" id="quizAgain">もう一度（3問）</button>
    <button class="btn btn-secondary" id="quizToDashboard">ダッシュボードを見る</button>
  `;
  $("quizAgain").addEventListener("click", renderQuizStart);
  $("quizToDashboard").addEventListener("click", () => openTab("dashboard"));
  $("quizBox").querySelectorAll("[data-industry]").forEach((b) => b.addEventListener("click", () => {
    openTab("zukan");
    renderIndustryDetail(b.dataset.industry);
  }));
}

function openTab(tab) {
  document.querySelector(`.tabs button[data-tab="${tab}"]`).click();
  window.scrollTo(0, 0);
}

renderQuizStart();
