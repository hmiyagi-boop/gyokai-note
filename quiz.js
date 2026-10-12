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

// key（"industry" / "type" / "category"）ごとの正答数 { 名前: { correct, total } }
function statsBy(key) {
  const stats = {};
  loadHistory().flatMap((round) => round.results).forEach((r) => {
    const name = r[key];
    if (!name) return;
    stats[name] = stats[name] || { correct: 0, total: 0 };
    stats[name].total++;
    if (r.correct) stats[name].correct++;
  });
  return stats;
}

// ---------- 問題づくりの道具 ----------

// 複数業界に同じ名前がある項目（「2024年問題」「稼働率」など）は1つにまとめる
function uniqueBy(list, key) {
  return list.filter((x, i) => list.findIndex((y) => y[key] === x[key]) === i);
}

const ALL_TERMS = uniqueBy(INDUSTRIES.flatMap((ind) => ind.keyTerms.map((t) => ({ ...t, ind }))), "term");
const ALL_KPIS = uniqueBy(INDUSTRIES.flatMap((ind) => ind.kpis.map((k) => ({ ...k, ind }))), "name");
const ALL_REGS = uniqueBy(INDUSTRIES.flatMap((ind) => ind.regulations.map((r) => ({ ...r, ind }))), "name");

// 正解1つ＋他の候補から3つを選んで4択にする
function fourChoices(answer, pool) {
  const others = shuffle([...new Set(pool)].filter((x) => x !== answer)).slice(0, 3);
  return shuffle([answer, ...others]);
}

function otherIndustryNames(ind) {
  return INDUSTRIES.filter((i) => i !== ind).map((i) => i.name);
}

// 万円単位の数値を「〇億〇万円」に整形
function formatMan(man) {
  const v = Math.round(man);
  if (v >= 10000) {
    const oku = Math.floor(v / 10000), rest = v % 10000;
    return rest ? `${oku}億${rest.toLocaleString()}万円` : `${oku}億円`;
  }
  return `${v.toLocaleString()}万円`;
}

// 計算問題の選択肢：正解と、よくある間違い（計算ミス）を並べる
function numericChoices(answer, wrongs, format) {
  const uniq = [...new Set([answer, ...wrongs].map((v) => Math.round(v * 100) / 100))].filter((v) => v > 0);
  const choices = [uniq[0], ...shuffle(uniq.slice(1)).slice(0, 3)];
  return { choices: shuffle(choices.map(format)), answer: format(uniq[0]) };
}

// ---------- 問題の種類 ----------
// industry: true の問題は業界を1つ受け取り、その業界についての問題を返す（業界別の正答率に反映）
// 返す形：{ question, choices, answer, explain }

const questionMakers = [
  // ===== 業界知識 =====
  {
    category: "業界知識", type: "業種分類", industry: true,
    make: (ind) => {
      const sub = pick(ind.subIndustries);
      return {
        question: `「${sub}」はどの業界に分類される？`,
        choices: fourChoices(ind.name, otherIndustryNames(ind)),
        answer: ind.name,
        explain: `${sub} は ${ind.name} に分類されます。${ind.summary}`
      };
    }
  },
  {
    category: "業界知識", type: "利益率", industry: true,
    make: (ind) => {
      const other = pick(INDUSTRIES.filter((i) => Math.abs(marginMid(i) - marginMid(ind)) >= 3));
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
    category: "業界知識", type: "コスト構造", industry: true,
    make: (ind) => ({
      question: `「${ind.costStructure}」というコスト構造の業界は？`,
      choices: fourChoices(ind.name, otherIndustryNames(ind)),
      answer: ind.name,
      explain: `${ind.name}：${ind.businessModel}`
    })
  },
  {
    category: "業界知識", type: "市場規模", industry: true,
    make: (ind) => ({
      question: `「${ind.marketSize}」に当てはまる業界は？`,
      choices: fourChoices(ind.name, otherIndustryNames(ind)),
      answer: ind.name,
      explain: `${ind.name}：${ind.marketSize}。数字の大きさの感覚を持っておくと、業界の話をするときの土台になります。`
    })
  },
  {
    category: "業界知識", type: "大手企業", industry: true,
    make: (ind) => {
      const player = pick(ind.majorPlayers).replace(/（.*?）/g, "");
      return {
        question: `「${player}」はどの業界の大手？`,
        choices: fourChoices(ind.name, otherIndustryNames(ind)),
        answer: ind.name,
        explain: `${ind.name}の主な大手：${ind.majorPlayers.join("、")}`
      };
    }
  },
  {
    category: "業界知識", type: "売上規模", industry: true,
    make: (ind) => {
      const revenue = pick([3, 10, 30, 100, 500, 2000]);
      const b = ind.revenueBands;
      return {
        question: `売上${revenue}億円の${ind.name}の会社。業界内の規模感は？`,
        choices: SCALE_NAMES,
        answer: SCALE_NAMES[scaleIndex(revenue, b)],
        explain: `${ind.name}の目安は「〜${b.small}億円：小規模／〜${b.mid}億円：中堅／〜${b.large}億円：準大手／それ以上：大手」。${ind.revenueNote}`
      };
    }
  },
  {
    category: "業界知識", type: "拠点数", industry: true,
    make: (ind) => ({
      question: `${ind.name}の拠点数（店舗・営業所・事業所）の傾向は？`,
      choices: Object.keys(LOCATION_RANK),
      answer: ind.locations.level,
      explain: `${ind.name}は「${ind.locations.level}」。${ind.locations.note}`
    })
  },
  {
    category: "業界知識", type: "経営課題", industry: true,
    make: (ind) => {
      const chain = pick(ind.issueChains);
      if (Math.random() < 0.5) {
        // 原因から、経営への影響を選ぶ
        const others = INDUSTRIES.filter((i) => i !== ind).map((i) => i.issueChains.find((c) => c.theme === chain.theme).impact);
        return {
          question: `${ind.name}では「${chain.cause}」。経営への影響として最も当てはまるのは？`,
          choices: fourChoices(chain.impact, others),
          answer: chain.impact,
          explain: `【${chain.theme}】${chain.cause} → ${chain.effect} → ${chain.impact}`
        };
      }
      // 原因と起きることから、業界を当てる
      return {
        question: `「${chain.cause}」→「${chain.effect}」という課題を抱えやすいのは？`,
        choices: fourChoices(ind.name, otherIndustryNames(ind)),
        answer: ind.name,
        explain: `【${chain.theme}】${ind.name}：${chain.impact}。切り出しの一言：${chain.hook}`
      };
    }
  },
  {
    category: "業界知識", type: "KPI", industry: true,
    make: (ind) => {
      const kpi = pick(ind.kpis);
      return {
        question: `${ind.name}で使われる『${kpi.meaning}』を表すKPIは？`,
        choices: fourChoices(kpi.name, ALL_KPIS.map((k) => k.name)),
        answer: kpi.name,
        explain: `${kpi.name}：${kpi.meaning}。お客様のKPIを知っていると、ヒアリングで数字の話ができます。`
      };
    }
  },
  {
    category: "業界知識", type: "法律・制度", industry: true,
    make: (ind) => {
      const reg = pick(ind.regulations);
      return {
        question: `${ind.name}に関わる『${reg.meaning}』はどれ？`,
        choices: fourChoices(reg.name, ALL_REGS.map((r) => r.name)),
        answer: reg.name,
        explain: `${reg.name}：${reg.meaning}`
      };
    }
  },
  {
    category: "業界知識", type: "業界用語", industry: true,
    make: (ind) => {
      const t = pick(ind.keyTerms);
      return {
        question: `${ind.name}でよく使う『${t.meaning}』を表す用語は？`,
        choices: fourChoices(t.term, ALL_TERMS.map((x) => x.term)),
        answer: t.term,
        explain: `${t.term}：${t.meaning}`
      };
    }
  },
  {
    category: "業界知識", type: "最近の動き", industry: true,
    make: (ind) => {
      const trend = pick(ind.trends);
      // 同じテーマ（2024年問題など）が他業界にもある場合は、紛らわしいので選択肢から外す
      const keywords = ["2024", "時間外", "最低賃金", "人手不足", "生成AI", "インバウンド", "物価", "高騰", "DX", "物流", "金利"];
      const shared = keywords.filter((k) => trend.title.includes(k));
      const pool = INDUSTRIES.filter((i) => i !== ind && !i.trends.some((t) => shared.some((k) => t.title.includes(k))));
      return {
        question: `「${trend.title}」の影響を特に受けているのは？`,
        choices: fourChoices(ind.name, pool.map((i) => i.name)),
        answer: ind.name,
        explain: `${ind.name}（${trend.period}）：${trend.impact}`
      };
    }
  },

  // ===== ビジネス基礎 =====
  {
    category: "ビジネス基礎", type: "財務・会計",
    make: () => {
      const t = pick(FINANCE_TERMS);
      return {
        question: `『${t.meaning}』を表す言葉は？`,
        choices: fourChoices(t.term, FINANCE_TERMS.map((x) => x.term)),
        answer: t.term,
        explain: `${t.term}：${t.meaning}`
      };
    }
  },
  {
    category: "ビジネス基礎", type: "フレームワーク",
    make: () => {
      const f = pick(FRAMEWORKS);
      return {
        question: `「${f.use}」に使うフレームワークは？`,
        choices: fourChoices(f.term, FRAMEWORKS.map((x) => x.term)),
        answer: f.term,
        explain: `${f.term}：${f.meaning}`
      };
    }
  },
  {
    category: "ビジネス基礎", type: "ビジネス常識",
    make: () => {
      const f = pick(BUSINESS_FACTS);
      return { question: f.question, choices: shuffle(f.choices), answer: f.answer, explain: f.explain };
    }
  },

  // ===== 計算 =====
  {
    category: "計算", type: "利益率の計算",
    make: () => {
      const sales = pick([5, 10, 20, 50]);
      const rate = pick([2, 3, 5, 8, 10, 15]);
      const profit = (sales * rate) / 100;
      const { choices, answer } = numericChoices(rate, [rate * 10, rate / 10, rate * 2, rate / 2], (v) => `${v}%`);
      return {
        question: `売上${sales}億円、営業利益${formatMan(profit * 10000)}の会社。営業利益率は？`,
        choices, answer,
        explain: `営業利益率 = 営業利益 ÷ 売上 = ${formatMan(profit * 10000)} ÷ ${sales}億円 = ${rate}%`
      };
    }
  },
  {
    category: "計算", type: "損益分岐点",
    make: () => {
      const fixed = pick([1000, 2000, 3000, 6000]);
      const variableRate = pick([40, 50, 60, 75, 80]);
      const bep = fixed / (1 - variableRate / 100);
      const { choices, answer } = numericChoices(bep, [fixed / (variableRate / 100), fixed * (1 + variableRate / 100), fixed, bep * 2], formatMan);
      return {
        question: `固定費が年${formatMan(fixed)}、変動費率が${variableRate}%の会社。損益分岐点の売上高は？`,
        choices, answer,
        explain: `損益分岐点売上高 = 固定費 ÷（1 − 変動費率）= ${formatMan(fixed)} ÷ ${(100 - variableRate) / 100} = ${formatMan(bep)}。売上1円あたり${100 - variableRate}銭が固定費の回収に回る。`
      };
    }
  },
  {
    category: "計算", type: "必要売上の計算",
    make: () => {
      const ind = pick(INDUSTRIES.filter((i) => i.margin.min >= 2));
      const rate = ind.margin.min;
      const cost = pick([50, 100, 200, 500]);
      const need = (cost * 100) / rate;
      const { choices, answer } = numericChoices(need, [cost * rate, need / 10, need * 10, cost * 10], formatMan);
      return {
        question: `営業利益率${rate}%の${ind.name}の会社で、${formatMan(cost)}の追加コスト（採用費・システム費など）を利益で取り戻すには、追加でいくらの売上が必要？`,
        choices, answer,
        explain: `必要な売上 = コスト ÷ 利益率 = ${formatMan(cost)} ÷ ${rate}% = ${formatMan(need)}。利益率が低い業界ほど、コスト削減の価値が大きい（=提案が刺さりやすい）。`
      };
    }
  },
  {
    category: "計算", type: "ROEの計算",
    make: () => {
      const equity = pick([50, 100, 200]);
      const roe = pick([3, 5, 8, 10, 15]);
      const net = (equity * roe) / 100;
      const { choices, answer } = numericChoices(roe, [roe * 2, roe / 2, roe * 10, roe + 5], (v) => `${v}%`);
      return {
        question: `自己資本${equity}億円、当期純利益${formatMan(net * 10000)}の会社。ROEは？`,
        choices, answer,
        explain: `ROE = 当期純利益 ÷ 自己資本 = ${formatMan(net * 10000)} ÷ ${equity}億円 = ${roe}%。日本では8%が一つの目安とされる。`
      };
    }
  }
];

const CATEGORIES = [...new Set(questionMakers.map((m) => m.category))];

// 重み付きで1つ選ぶ
function weightedPick(list, weightOf) {
  const weights = list.map(weightOf);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

// 苦手ほど重みを大きくする（正答率が低いほど大きい。未回答は標準）
function weaknessWeight(stats, name) {
  const s = stats[name];
  return s ? 1 - s.correct / s.total + 0.2 : 0.6;
}

// 1回分の問題をつくる。問題の種類は重複しないように選ぶ。
// mode: random（全分野）/ weak（苦手優先）/ 分野名（その分野だけ）
async function buildRound(mode) {
  let makers = CATEGORIES.includes(mode) ? questionMakers.filter((m) => m.category === mode) : [...questionMakers];
  const typeStats = statsBy("type");
  const industryStats = statsBy("industry");
  const chosen = [];
  while (chosen.length < QUESTIONS_PER_ROUND && makers.length) {
    const m = mode === "weak" ? weightedPick(makers, (x) => weaknessWeight(typeStats, x.type)) : pick(makers);
    makers = makers.filter((x) => x !== m);
    chosen.push(m);
  }
  return chosen.map((m) => {
    if (!m.industry) return { category: m.category, type: m.type, ...m.make() };
    const ind = mode === "weak" ? weightedPick(INDUSTRIES, (i) => weaknessWeight(industryStats, i.name)) : pick(INDUSTRIES);
    return { category: m.category, type: m.type, industry: ind.name, industryId: ind.id, ...m.make(ind) };
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
      <p class="hint">業界知識（利益率・KPI・法律・経営課題など）、ビジネス基礎（財務・フレームワーク・常識）、計算問題から出題します。</p>
      <label>出題範囲
        <select id="quizMode">
          <option value="random">すべての分野からランダム</option>
          <option value="weak">苦手を優先</option>
          ${CATEGORIES.map((c) => `<option value="${c}">${c}だけ</option>`).join("")}
        </select>
      </label>
      <button class="btn btn-block" id="quizStartBtn">スタート</button>
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
      <div class="quiz-progress">${round.index + 1} / ${round.questions.length}問目 <span class="chip">${q.category}・${q.type}</span></div>
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
      category: q.category, type: q.type, industry: q.industry, industryId: q.industryId,
      question: q.question, chosen, answer: q.answer, explain: q.explain, correct
    });
    $("quizBox").querySelectorAll(".choices button").forEach((b) => {
      b.disabled = true;
      if (b.dataset.choice === q.answer) b.classList.add("correct");
    });
    if (!correct) btn.classList.add("wrong");
    $("quizAfter").innerHTML = `
      <p class="${correct ? "mark-good" : "mark-bad"}">${correct ? "○ 正解" : "× 不正解"}</p>
      <button class="btn btn-block" id="quizNext">${isLast ? "結果と解説を見る" : "次の問題"}</button>
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
        <div class="quiz-progress">${i + 1}問目 <span class="chip">${r.category}・${r.type}</span>
          <span class="${r.correct ? "mark-good" : "mark-bad"}">${r.correct ? "○ 正解" : "× 不正解"}</span></div>
        <div class="quiz-q">${r.question}</div>
        <p>あなたの回答：<strong>${r.chosen}</strong>${r.correct ? "" : ` ／ 正解：<strong>${r.answer}</strong>`}</p>
        <div class="explain"><strong>解説</strong> ${r.explain}</div>
        ${r.industryId ? `<button class="link-btn" data-industry="${r.industryId}">${r.industry}を図鑑で復習する →</button>` : ""}
      </div>
    `).join("")}
    <div class="result-actions">
      <button class="btn" id="quizAgain">もう一度（3問）</button>
      <button class="btn btn-secondary" data-tab="dashboard">ダッシュボードを見る</button>
    </div>
  `;
  $("quizAgain").addEventListener("click", renderQuizStart);
  $("quizBox").querySelectorAll("[data-industry]").forEach((b) => b.addEventListener("click", () => {
    openTab("zukan");
    renderIndustryDetail(b.dataset.industry);
  }));
}

renderQuizStart();
