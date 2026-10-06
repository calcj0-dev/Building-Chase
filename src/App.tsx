import { useTranslation } from 'react-i18next'

function App() {
  const { t } = useTranslation()

  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold tracking-wide">{t('app.title')}</h1>
      <p className="text-slate-400">{t('app.comingSoon')}</p>
    </main>
  )
}

export default App
