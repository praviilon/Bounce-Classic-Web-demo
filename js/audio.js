/* ==========================================================
   AudioManager
   Генерирует короткие ретро-звуки "на лету" через Web Audio API,
   без необходимости во внешних аудиофайлах.
   Совместимо с Chrome и Safari (AudioContext создаётся/
   возобновляется по первому пользовательскому действию,
   что удовлетворяет политике автовоспроизведения браузеров).
   ========================================================== */

class AudioManager{
  constructor(){
    this.ctx = null;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.8;
    this.musicNodes = null;
    this.musicTimer = null;
  }

  /** Должен вызываться по первому клику/нажатию клавиши пользователем */
  unlock(){
    if(!this.ctx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    }
    if(this.ctx.state === 'suspended'){
      this.ctx.resume();
    }
  }

  setMusicVolume(v){ this.musicVolume = v; }
  setSfxVolume(v){ this.sfxVolume = v; }

  /** Простой синтезированный "бип" */
  _beep({freq=440, duration=0.12, type='square', volume=1, slideTo=null}){
    if(!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if(slideTo){
      osc.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo), t0 + duration);
    }
    const vol = Math.max(0.0001, this.sfxVolume * volume);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  jump(){ this._beep({freq:520, slideTo:820, duration:0.12, type:'square', volume:0.5}); }
  land(){ this._beep({freq:180, duration:0.06, type:'square', volume:0.3}); }
  ring(){ this._beep({freq:900, slideTo:1400, duration:0.1, type:'triangle', volume:0.6}); }
  trampoline(mult){ this._beep({freq:260*mult*0.5, slideTo:1200, duration:0.18, type:'sawtooth', volume:0.6}); }
  pumpInflate(){ this._beep({freq:300, slideTo:700, duration:0.25, type:'sine', volume:0.6}); }
  pumpDeflate(){ this._beep({freq:700, slideTo:250, duration:0.25, type:'sine', volume:0.6}); }
  splash(){ this._beep({freq:400, slideTo:120, duration:0.3, type:'sine', volume:0.5}); }
  death(){ this._beep({freq:300, slideTo:60, duration:0.4, type:'sawtooth', volume:0.7}); }
  checkpoint(){ this._beep({freq:600, duration:0.08, type:'square', volume:0.4});
    setTimeout(()=>this._beep({freq:900, duration:0.12, type:'square', volume:0.4}), 90); }
  finish(){
    [660,880,1100,1320].forEach((f,i)=>{
      setTimeout(()=>this._beep({freq:f, duration:0.18, type:'square', volume:0.6}), i*110);
    });
  }
  menuMove(){ this._beep({freq:500, duration:0.05, type:'square', volume:0.3}); }
  menuSelect(){ this._beep({freq:700, slideTo:900, duration:0.1, type:'square', volume:0.4}); }
  breakPlatform(){ this._beep({freq:220, slideTo:80, duration:0.2, type:'square', volume:0.5}); }

  /** Простейшая зацикленная чиптюн-подложка из нескольких нот */
  startMusic(){
    if(!this.ctx || this.musicNodes) return;
    const notes = [392, 440, 523.25, 440, 392, 349.23, 392, 523.25];
    let i = 0;
    const playNote = () => {
      if(!this.ctx) return;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(notes[i % notes.length], t0);
      const vol = Math.max(0.0001, this.musicVolume * 0.12);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.3);
      i++;
    };
    this.musicTimer = setInterval(playNote, 320);
    this.musicNodes = true;
  }

  stopMusic(){
    if(this.musicTimer){ clearInterval(this.musicTimer); this.musicTimer = null; }
    this.musicNodes = null;
  }
}
