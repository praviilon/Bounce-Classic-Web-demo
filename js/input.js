/* ==========================================================
   InputManager
   Отслеживает состояние клавиш стрелок и служебных клавиш.
   Поддерживает "justPressed" для однократных срабатываний
   (например, переход по пунктам меню).
   ========================================================== */

class InputManager{
  constructor(){
    this.keys = {};        // текущее состояние (удержание)
    this.justPressed = {}; // true один кадр после нажатия
    this.onAnyKey = null;  // колбэк для разблокировки звука по первому вводу

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if(this._isTrackedKey(code)){
        e.preventDefault();
      }
      if(!this.keys[code]){
        this.justPressed[code] = true;
      }
      this.keys[code] = true;
      this._highlightPhoneKey(code, true);
      if(this.onAnyKey) this.onAnyKey();
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      this.keys[code] = false;
      this._highlightPhoneKey(code, false);
    });

    // декоративные экранные кнопки телефона — тоже кликабельны
    document.querySelectorAll('.key').forEach(btn => {
      const keyName = btn.dataset.key;
      const codeMap = {
        ArrowUp:'ArrowUp', ArrowDown:'ArrowDown',
        ArrowLeft:'ArrowLeft', ArrowRight:'ArrowRight', Enter:'Enter'
      };
      const code = codeMap[keyName];
      const press = (ev) => {
        ev.preventDefault();
        if(!this.keys[code]) this.justPressed[code] = true;
        this.keys[code] = true;
        btn.classList.add('active');
        if(this.onAnyKey) this.onAnyKey();
      };
      const release = (ev) => {
        ev.preventDefault();
        this.keys[code] = false;
        btn.classList.remove('active');
      };
      btn.addEventListener('mousedown', press);
      btn.addEventListener('touchstart', press, {passive:false});
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
      btn.addEventListener('touchend', release);
    });
  }

  _isTrackedKey(code){
    return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape','KeyP','KeyR'].includes(code);
  }

  _highlightPhoneKey(code, on){
    const map = { ArrowUp:'.key-up', ArrowDown:'.key-down', ArrowLeft:'.key-left', ArrowRight:'.key-right', Enter:'.key-center' };
    const sel = map[code];
    if(!sel) return;
    const el = document.querySelector(sel);
    if(el) el.classList.toggle('active', on);
  }

  isDown(code){ return !!this.keys[code]; }

  wasPressed(code){
    if(this.justPressed[code]){
      return true;
    }
    return false;
  }

  /** Вызывается в конце каждого кадра игрового цикла */
  clearFrame(){
    this.justPressed = {};
  }
}
