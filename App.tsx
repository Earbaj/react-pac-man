import React from 'react';
import PacmanGame from './components/PacmanGame';

function App() {
  return (
    <div 
      className="min-h-screen text-white flex justify-center bg-cover bg-center bg-no-repeat bg-fixed relative"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop')", // Retro Arcade Tech Background
        backgroundColor: '#0f172a'
      }}
    >
      {/* Dark Overlay for readability */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] z-0 pointer-events-none"></div>
      
      {/* Game Content */}
      <div className="relative z-10 w-full flex justify-center">
        <PacmanGame />
      </div>
    </div>
  );
}

export default App;