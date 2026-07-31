/* ==========================================================
   SaveManager
   Хранение прогресса и настроек в localStorage браузера.
   ========================================================== */

class SaveManager{
  constructor(){
    this.key = 'bounceClassicWeb.save.v1';
    this.data = this._load();
  }

  _defaults(){
    return {
      bestTime: null,      // лучшее время прохождения демо-уровня (сек)
      bestRings: 0,        // максимум колец, собранных за одно прохождение
      totalRingsEver: 0,   // суммарно собранных колец за всё время
      musicVolume: 0.6,
      sfxVolume: 0.8,
      levelUnlocked: 1
    };
  }

  _load(){
    try{
      const raw = localStorage.getItem(this.key);
      if(!raw) return this._defaults();
      return Object.assign(this._defaults(), JSON.parse(raw));
    }catch(e){
      console.warn('Save: не удалось прочитать localStorage', e);
      return this._defaults();
    }
  }

  save(){
    try{
      localStorage.setItem(this.key, JSON.stringify(this.data));
    }catch(e){
      console.warn('Save: не удалось записать localStorage', e);
    }
  }

  reportLevelResult({time, rings, totalRings}){
    if(this.data.bestTime === null || time < this.data.bestTime){
      this.data.bestTime = time;
    }
    if(rings > this.data.bestRings) this.data.bestRings = rings;
    this.data.totalRingsEver += rings;
    this.save();
  }

  setVolumes(music, sfx){
    this.data.musicVolume = music;
    this.data.sfxVolume = sfx;
    this.save();
  }
}
