class GameAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Background Loops
  private currentOsc: OscillatorNode | null = null;
  private currentGain: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private currentLoopType: 'NONE' | 'SIREN' | 'SCARED' = 'NONE';

  public isMuted: boolean = false;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.2;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.2, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // --- Sound Effects ---

  playWaka() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;
    
    // Simple "Waka" - short chirp
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playEatGhost() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1600, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playDie() {
    if (this.isMuted) return;
    this.init();
    this.stopBackground();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 1);
  }

  playGameStart() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 523.25, 392.00, 329.63, 261.63, 392.00, 261.63]; // C4 C5 G4 E4 C4 G4 C4
    const duration = 0.15;

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.1, now + i * duration);
      gain.gain.linearRampToValueAtTime(0, now + i * duration + duration - 0.05);
      
      osc.connect(gain);
      gain.connect(this.masterGain!);
      
      osc.start(now + i * duration);
      osc.stop(now + i * duration + duration);
    });
  }

  // --- Background Loops ---

  private startOscillator(type: 'SIREN' | 'SCARED') {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    // Stop existing
    this.stopBackground();

    this.currentLoopType = type;
    
    this.currentOsc = this.ctx.createOscillator();
    this.currentGain = this.ctx.createGain();
    this.lfoOsc = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    if (type === 'SIREN') {
      // Slow pulsing low drone
      this.currentOsc.type = 'triangle';
      this.currentOsc.frequency.value = 150; 
      this.currentGain.gain.value = 0.15;
      
      this.lfoOsc.type = 'sine';
      this.lfoOsc.frequency.value = 0.5; // Slow Pulse
      lfoGain.gain.value = 20; // Pitch modulation depth
    } else {
      // Faster, higher pulsing for Scared/Power mode
      this.currentOsc.type = 'sawtooth';
      this.currentOsc.frequency.value = 300;
      this.currentGain.gain.value = 0.1;

      this.lfoOsc.type = 'square';
      this.lfoOsc.frequency.value = 4; // Fast Pulse
      lfoGain.gain.value = 50;
    }

    // Connect LFO to Frequency of main Osc
    this.lfoOsc.connect(lfoGain);
    lfoGain.connect(this.currentOsc.frequency);

    this.currentOsc.connect(this.currentGain);
    this.currentGain.connect(this.masterGain);

    this.lfoOsc.start();
    this.currentOsc.start();
  }

  startSiren() {
    if (this.currentLoopType === 'SIREN') return;
    this.startOscillator('SIREN');
  }

  startScared() {
    if (this.currentLoopType === 'SCARED') return;
    this.startOscillator('SCARED');
  }

  stopBackground() {
    if (this.currentOsc) {
      try { this.currentOsc.stop(); } catch(e) {}
      this.currentOsc.disconnect();
      this.currentOsc = null;
    }
    if (this.lfoOsc) {
       try { this.lfoOsc.stop(); } catch(e) {}
       this.lfoOsc.disconnect();
       this.lfoOsc = null;
    }
    this.currentLoopType = 'NONE';
  }
}

export const gameAudio = new GameAudio();
