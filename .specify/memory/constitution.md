<!--
Sync Impact Report
- Version change: (template, unratified) → 1.0.0
- Modified principles: N/A (initial ratification) — defined 5 principles:
  I. Static-Only / Serverless
  II. Lightweight & Performance-First
  III. Geospatial Correctness
  IV. Simplicity (YAGNI)
  V. Core Logic Must Be Tested
- Added sections: Technology Constraints; Development Workflow & Quality Gates
- Removed sections: none
- Templates requiring review (not modified by this command):
  - .specify/templates/plan-template.md ⚠ pending manual check against new principles
  - .specify/templates/spec-template.md ⚠ pending manual check against new principles
  - .specify/templates/tasks-template.md ⚠ pending manual check against new principles
  - .specify/templates/checklist-template.md ⚠ pending manual check against new principles
- Follow-up TODOs: none
-->

# MapProfiler Constitution

## Core Principles

### I. 静的サイト・サーバーレス原則 (Static-Only / Serverless)
本サービスは GitHub Pages 上でホスティングされる静的サイトとして実装する。API サーバー、
データベース、認証基盤など、サーバーサイドの実行環境を前提とする機能を追加してはならない。
座標変換、DEM サンプリング、断面図生成といった処理はすべてブラウザ内(クライアントサイド)
で完結させること。
**Rationale**: idea.md に定義された「GitHub Pages 上で軽量なサービスとして実装する」という
前提を満たすため。サーバー運用コストとデプロイの複雑さを排除する。

### II. 軽量性・パフォーマンス優先 (Lightweight & Performance-First)
依存ライブラリは必要最小限に絞り、バンドルサイズと初期読み込み時間を意識する。COG (Cloud
Optimized GeoTIFF) 形式の DEM は、ファイル全体を事前ダウンロードするのではなく、HTTP Range
Request による部分読み込み(必要な範囲・オーバービューのみ取得)を優先する。
**Rationale**: 対象地域の DEM は 0.5m 解像度で容量が大きく、複数時期分を扱うため、素朴な
全体ダウンロードは実用に耐えない。

### III. 地理空間データの正確性 (Geospatial Correctness)
座標系変換(WGS84 ⇔ EPSG:6675)および DEM サンプリング(測線上の距離 d と標高 z の算出)は、
仕様通りの精度で実装しなければならない。測地系・単位(メートル/度)の取り違えを起こしては
ならない。
**Rationale**: 地形変化を定量的に可視化することがサービスの核心的価値であり、ここが不正確だと
成果物全体の信頼性が失われる。

### IV. シンプルさ優先 (Simplicity / YAGNI)
現時点で要求されていない機能(マルチユーザー対応、認証、サーバー側永続化など)を先回りして
実装しない。早すぎる抽象化よりも、読みやすく直接的な実装を優先する。
**Rationale**: 個人/小規模開発であり、過剰設計は開発速度を落とし保守コストを増やすだけで
価値を生まない。

### V. コアロジックのテスト必須 (Core Logic Must Be Tested)
座標変換、DEM サンプリング、断面図データ(d, z 配列)生成といった計算ロジックには、ユニット
テストを必須とする。UI の見た目・操作性に関するテストは任意とする。
**Rationale**: 計算誤りは目視で気づきにくく、断面図という成果物の信頼性に直結するため、
コア計算部分のみ品質ゲートを厳格にし、開発速度とのバランスを取る。

## Technology Constraints

- マップ表示ライブラリ: Leaflet を使用する。
- タイル配信: タイルアドレス(URL テンプレート)を指定することで、対象地域のタイル地図を
  参照できるようにする。
- DEM データ: COG (Cloud Optimized GeoTIFF) 形式、空間参照系 EPSG:6675、解像度 0.5m を
  想定する。複数時期(地震前後・豪雨前後を含む)の DEM を切り替え/比較できること。
- 対象地域: 能登半島北部(2024年1月地震および2024年9月豪雨による地形変化を対象とする)。
- 出力機能: 断面図(PNG)、および測線をオーバーレイし縮尺を表示した地図(PNG)を、それぞれ
  ダウンロード可能にする。
- ホスティング: GitHub Pages(静的サイトホスティング)。

## Development Workflow & Quality Gates

- 新規機能は speckit のワークフロー(specify → clarify → plan → tasks → implement)に
  従って進める。
- 座標変換・DEM サンプリング・断面図生成ロジックへの変更は、対応するユニットテストの
  追加・更新を伴わない限りマージしてはならない(原則 V)。
- PNG ダウンロード機能(断面図・地図オーバーレイ)は、自動テストに加えて実ブラウザでの
  目視確認を行うこと。
- 原則からの逸脱がやむを得ない場合は、該当する plan.md にその理由を明記すること。

## Governance

本憲法はプロジェクト内の他のすべての実践・慣習に優先する。憲法に反する提案は、逸脱の
理由を明記した上で明示的な承認を得ない限り採用してはならない。

改訂は以下の手順で行う: (1) 変更内容と理由を記録する、(2) セマンティックバージョニングに
従いバージョンを更新する(MAJOR: 原則の後方非互換な削除・再定義、MINOR: 原則・セクションの
追加や実質的拡張、PATCH: 文言修正等の非意味的な変更)、(3) Sync Impact Report をファイル
冒頭にコメントとして記録する。

**Version**: 1.0.0 | **Ratified**: 2026-08-08 | **Last Amended**: 2026-08-08
