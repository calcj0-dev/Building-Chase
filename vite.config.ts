/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: ホーム画面に追加でき、一度開けばオフラインでも遊べる（Service Worker が全ファイルを保存する）
    VitePWA({
      // 新しい版を公開したら、次に開いたときに自動で入れ替わる
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Building Chase',
        short_name: 'Building Chase',
        description: 'ビル街で繰り広げる、推理の鬼ごっこ',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 縦向き・横向きのどちらのレイアウトも用意しているので固定しない
        orientation: 'any',
        background_color: '#070b16',
        theme_color: '#070b16',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // 共有カードの画像はゲームでは使わないので、オフライン用に保存しない
        globIgnores: ['**/og-image.png'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
