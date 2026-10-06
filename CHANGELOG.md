# Changelog

バージョン規則は [document.md](document.md) 5.1.1 を参照（push ごとに PATCH +1 / フェーズ完了で MINOR +1 / 一般公開で v1.0.0）。

## [0.2.0] - 2026-10-06
Phase 1（ゲームロジック）完了。

### Added
- 盤面モデル（`src/core/board.ts`）: ビル 5×5 / 交差点 4×4、隣接関係、交差点と周囲4棟の対応
- ゲーム進行（`src/core/game.ts`）: 配置フェーズ、逃亡者の移動と痕跡、警察の移動・捜索、ラウンド進行、勝敗判定（逮捕 / 包囲 / 逃走成功）
- `getLegalActions` / `applyAction`（イミュータブル、不正な行動は `IllegalActionError`）
- 陣営別の見える情報 `getView`（`src/core/view.ts`）: 警察視点では車の位置と未発見の痕跡を隠し、青の痕跡は何手目か伏せる。決着後は両陣営に全公開
- 単体テスト 43 件

## [0.1.0] - 2026-10-06
Phase 0（開発環境セットアップ）完了。

### Added
- Vercel 連携（`main` への push で自動デプロイ）。本番: https://building-chase.vercel.app

## [0.0.1] - 2026-10-06
### Added
- Vite + React + TypeScript プロジェクト（strict モード）
- Tailwind CSS / Zustand / i18next（日本語・英語、デフォルト日本語）
- Vitest / oxlint / Prettier
- ディレクトリ構成（`src/core` / `src/ui` / `src/ai` / `src/audio` / `src/storage` / `src/i18n`）
- 仮のトップページ
- ホスティングに Vercel を使用する方針、バージョン管理の規則を要件定義書・ロードマップに追記

## [0.0.0] - 2026-10-06
### Added
- 要件定義書（document.md）とロードマップ（ROADMAP.md）
