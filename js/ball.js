/* ==========================================================
   Ball
   Игровой шарик и его физическое поведение.
   Состояние (обычный/надутый/сдутый) меняется ИСКЛЮЧИТЕЛЬНО
   через насосы на уровне — согласно ТЗ, свободного
   переключения клавишей нет.
   ========================================================== */

const BALL_STATES = {
  normal:   { radiusMult: 1.0, jumpMult: 1.0, speedMult: 1.0, color: '#FF3333' },
  inflated: { radiusMult: 1.2, jumpMult: 1.3, speedMult: 0.8, color: '#FF6B6B' },
  deflated: { radiusMult: 0.7, jumpMult: 0.7, speedMult: 1.3, color: '#CC2222' }
};

const BASE_RADIUS = 11;

class Ball{
  constructor(x, y){
    this.spawn = { x, y };
    this.reset(x, y);
  }

  reset(x, y){
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.state = 'normal';
    this.grounded = false;
    this.standingOn = null;   // ссылка на платформу, на которой стоит шарик (для движущихся платформ)
    this.rotation = 0;
    this.waterTimer = 0;      // время нахождения в воде в обычном состоянии
    this.alive = true;
    this.invulnerable = 0;    // короткая неуязвимость после респауна
  }

  get radius(){
    return BASE_RADIUS * BALL_STATES[this.state].radiusMult;
  }
  get jumpMult(){ return BALL_STATES[this.state].jumpMult; }
  get speedMult(){ return BALL_STATES[this.state].speedMult; }
  get color(){ return BALL_STATES[this.state].color; }

  setState(newState, audio){
    if(this.state === newState) return; // насос повторно не действует на тот же размер
    this.state = newState;
    if(audio){
      if(newState === 'inflated') audio.pumpInflate();
      if(newState === 'deflated') audio.pumpDeflate();
    }
  }
}
