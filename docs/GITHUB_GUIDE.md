# GitHub 入門（このアプリで練習する）

## まず全体像

| 言葉 | たとえ | 意味 |
|---|---|---|
| Git | 変更履歴を記録するノート | 手元のPCでファイルの変更を記録するツール |
| GitHub | ノートを置くクラウドの本棚 | Gitの履歴をネット上に保管・共有するサービス |
| リポジトリ（repo） | 1冊のノート | 1つのプロジェクトのフォルダ＋変更履歴 |
| コミット（commit） | セーブポイント | 「ここまでの変更」を1つの記録として保存 |
| プッシュ（push） | 本棚に送る | 手元のコミットをGitHubへアップロード |
| プル（pull） | 本棚から取ってくる | GitHub上の最新を手元に取り込む |
| ブランチ（branch） | 下書き用のコピー | 本番（main）を壊さずに作業するための分岐 |
| プルリクエスト（PR） | 「この下書きを本番に入れていい？」の申請 | 変更内容をレビューしてからmainに取り込む仕組み |

お客様にシステムを納品・保守するときも、この流れ（ブランチ → PR → レビュー → マージ）が基本になります。

## 毎回の基本の流れ

```bash
git status                  # 何が変わったか確認
git add .                   # 変更をコミット対象に入れる
git commit -m "物流業界のトレンドを追加"   # セーブポイントを作る
git push                    # GitHubに送る
```

## 練習ステップ

### Step 1. GitHubにリポジトリを作って送る（初回だけ）

```bash
gh auth login               # GitHubにログイン（ブラウザが開く）
gh repo create gyokai-note --private --source=. --push
```

`--private` にすると自分だけが見られます。

### Step 2. ブランチを切って業界を1つ追加する

```bash
git switch -c add-insurance          # 「保険業界追加」用のブランチを作る
# data/industries.js に保険業界を追加して保存
git add .
git commit -m "保険業界を追加"
git push -u origin add-insurance
gh pr create --fill                  # プルリクエストを作る
```

GitHubの画面でPRを開き、「Files changed」で差分を見てから「Merge」を押します。

```bash
git switch main
git pull                             # マージ後の最新を手元に取り込む
```

### Step 3. GitHub Pagesで公開する（スマホから見られるようにする）

GitHubのリポジトリ画面 → Settings → Pages → Branch を `main` / `(root)` にして Save。
数分後に `https://<ユーザー名>.github.io/gyokai-note/` で見られます。

※ 無料プランで Pages を使うには、リポジトリを public にする必要があります（社外秘の情報は入れないこと）。

### Step 4. Issueでやることを管理する

「建設業の利益率を最新値に更新」などのやることを Issues に登録し、
コミットメッセージに `fixes #3` と書くと、マージ時に自動で閉じられます。

## 困ったとき

| 状況 | コマンド |
|---|---|
| 直前のコミットを見たい | `git log --oneline -5` |
| まだコミットしていない変更を取り消したい | `git restore ファイル名` |
| どこが変わったか見たい | `git diff` |
