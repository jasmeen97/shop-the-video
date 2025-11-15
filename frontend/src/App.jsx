import Header from './components/Header'
import VideoIntelligence from './components/VideoIntelligence'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-ghost via-primary-whisper to-primary-neutral">
      <Header />

      <main className="mx-auto px-4 md:px-6 lg:px-8 pt-20 pb-16 flex flex-col items-center">
        <section className="w-full max-w-6xl">
          <VideoIntelligence />
        </section>
      </main>
    </div>
  )
}

export default App
