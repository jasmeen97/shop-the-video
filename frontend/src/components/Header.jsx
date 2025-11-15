const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary-ghost/85 backdrop-blur border-b border-primary-slate/30">
      <div 
        className="mx-auto px-4 md:px-6 lg:px-8 h-16
                   flex items-center justify-between gap-6
                   transition-all duration-200 ease-out"
      >
        <div className="flex items-center space-x-3">
          <svg 
            className="w-6 h-6 text-primary-obsidian flex-shrink-0" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-primary-obsidian leading-tight">
              Shop the Video
            </h1>
            <p className="text-xs md:text-sm text-primary-charcoal/80">
              Beautiful product intelligence for every frame.
            </p>
          </div>
        </div>

        <div 
          className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-full
                     bg-primary-whisper/80 border border-primary-neutral/40
                     shadow-sm shadow-primary-obsidian/5"
        >
          <div className="w-2 h-2 rounded-full bg-accents-sage animate-pulse" />
          <span className="text-xs md:text-sm font-medium text-primary-obsidian">
            Video Intelligence Ready
          </span>
        </div>
      </div>
    </header>
  )
}

export default Header
