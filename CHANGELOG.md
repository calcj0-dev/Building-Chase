# Changelog

バージョン規則は [document.md](document.md) 5.1.1 を参照（push ごとに PATCH +1 / フェーズ完了で MINOR +1 / 一般公開で v1.0.0）。

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
