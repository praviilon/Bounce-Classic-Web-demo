/* ==========================================================
   Game
   Центральный класс: конечный автомат состояний экрана
   (меню/игра/пауза/результаты), физика и коллизии, рендер
   на Canvas, обновление HUD.
   ========================================================== */

// ---- Константы физики (px и секунды) --------------------------------
const GRAVITY = 900;
const MAX_FALL_SPEED = 620;   // предельная скорость падения вниз
const MAX_RISE_SPEED = 860;   // предельная скорость движения вверх (нужна для супер-батута)
const JUMP_SPEED = 300;
const DOWN_CANCEL_RATE = 1500;   // ускоренное гашение прыжка при нажатой "вниз"
const MOVE_MAX_SPEED = 120;
const AIR_ACCEL = 500;

const SURFACE_PARAMS = {
  normal: { accel: 900,  decel: 900,  speedMult: 1.0 },
  ice:    { accel: 220,  decel: 90,   speedMult: 1.0 },
  mud:    { accel: 1400, decel: 2600, speedMult: 0.55 }
};

const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 300;
const FALL_DEATH_Y = WORLD_HEIGHT + 60;
const WATER_DEATH_TIME = 2.6; // сек в воде в обычном состоянии до гибели
const INVULN_TIME = 1.1;

const MENUS = {
  menu:      ['play','howto','settings','about'],
  pause:     ['resume','restart','menu'],
  complete:  ['restart','menu'],
  gameOver:  ['restart','menu']
};

class Game{
  constructor(canvas, input, audio, save){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.audio = audio;
    this.save = save;

    this.state = 'menu';           // menu | howto | settings | about | playing | paused | levelComplete | gameOver
    this.menuSelection = { menu:0, pause:0, complete:0, gameOver:0 };

    this.dom = {
      hud: document.getElementById('hud'),
      hudRings: document.getElementById('hudRings'),
      hudTimer: document.getElementById('hudTimer'),
      hudBallState: document.getElementById('hudBallState'),
      hudLives: document.getElementById('hudLives'),
      overlays: {
        menu: document.getElementById('menu'),
        howto: document.getElementById('howto'),
        settings: document.getElementById('settings'),
        about: document.getElementById('about'),
        pause: document.getElementById('pause'),
        levelComplete: document.getElementById('levelComplete'),
        gameOver: document.getElementById('gameOver')
      },
      resultsText: document.getElementById('resultsText'),
      resultsRating: document.getElementById('resultsRating')
    };

    this._bindOverlayClicks();
    this._returnState = 'menu'; // куда вернуться из howto/settings/about

    this.showOverlay('menu');
  }

  // ---------------------------------------------------------------
  // Инициализация нового прохождения уровня
  // ---------------------------------------------------------------
  startLevel(){
    this.level = createLevel();
    this.ball = new Ball(this.level.spawn.x, this.level.spawn.y);
    this.camera = 0;
    this.lives = 3;
    this.deaths = 0;
    this.elapsed = 0;
    this.ringsTotal = this.level.ringsData.length;
    this.ringsCollected = 0;
    this.finished = false;
    this.state = 'playing';
    this.hideAllOverlays();
    this.dom.hud.classList.remove('hidden');
    this.audio.startMusic();
  }

  restartLevel(){
    this.startLevel();
  }

  // ---------------------------------------------------------------
  // Обработка ввода в меню (используется в update() при !playing)
  // ---------------------------------------------------------------
  _handleMenuInput(menuKey, overlayId, listId){
    const items = MENUS[menuKey];
    const input = this.input;
    let sel = this.menuSelection[menuKey];

    if(input.wasPressed('ArrowUp')){
      sel = (sel - 1 + items.length) % items.length;
      this.audio.menuMove();
    }
    if(input.wasPressed('ArrowDown')){
      sel = (sel + 1) % items.length;
      this.audio.menuMove();
    }
    this.menuSelection[menuKey] = sel;
    this._renderMenuSelection(listId, sel);

    if(input.wasPressed('Enter')){
      this.audio.menuSelect();
      this._runMenuAction(items[sel]);
    }
  }

  _renderMenuSelection(listId, sel){
    const list = document.getElementById(listId);
    if(!list) return;
    [...list.children].forEach((li, i) => {
      li.classList.toggle('selected', i === sel);
      const label = li.textContent.replace(/^[>\s]+/, '');
      li.innerHTML = (i === sel ? '&gt; ' : '&nbsp;&nbsp;') + label;
    });
  }

  _runMenuAction(action){
    switch(action){
      case 'play': this.startLevel(); break;
      case 'howto': this._openSubScreen('howto'); break;
      case 'settings': this._openSubScreen('settings'); break;
      case 'about': this._openSubScreen('about'); break;
      case 'resume': this.resume(); break;
      case 'restart': this.restartLevel(); break;
      case 'menu': this.goToMenu(); break;
    }
  }

  /**
   * Открыть вспомогательный экран (управление/настройки/об игре).
   * ВАЖНО: раньше здесь менялся только видимый оверлей, а this.state
   * оставался прежним ('menu') — из-за этого клавиши Esc/Enter переставали
   * что-либо делать, так как update() проверяет именно this.state.
   */
  _openSubScreen(id){
    this._returnState = this.state === 'menu' || this.state === 'paused' ? this.state : 'menu';
    this.state = id;
    this.showOverlay(id);
  }

  /** Вернуться из вспомогательного экрана туда, откуда пришли */
  _closeSubScreen(){
    this.state = this._returnState || 'menu';
    this.showOverlay(this.state);
  }

  goToMenu(){
    this.state = 'menu';
    this.audio.stopMusic();
    this.dom.hud.classList.add('hidden');
    this.showOverlay('menu');
  }

  pause(){
    if(this.state !== 'playing') return;
    this.state = 'paused';
    this.showOverlay('pause');
  }

  resume(){
    this.state = 'playing';
    this.hideAllOverlays();
    this.dom.hud.classList.remove('hidden');
  }

  showOverlay(id){
    Object.entries(this.dom.overlays).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== id);
    });
  }
  hideAllOverlays(){
    Object.values(this.dom.overlays).forEach(el => el.classList.add('hidden'));
  }

  _bindOverlayClicks(){
    document.querySelectorAll('.menu-list').forEach(list => {
      list.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if(!li) return;
        this.audio.unlock();
        this.audio.menuSelect();
        this._runMenuAction(li.dataset.action);
      });
    });
  }

  // ---------------------------------------------------------------
  // Главный апдейт (вызывается каждый кадр из main.js)
  // ---------------------------------------------------------------
  update(dt){
    dt = Math.min(dt, 1/30); // защита от скачков при потере фокуса вкладки

    if(this.state === 'menu'){ this._handleMenuInput('menu', 'menu', 'menuList'); return; }
    if(this.state === 'paused'){ this._handleMenuInput('pause', 'pause', 'pauseList');
      if(this.input.wasPressed('Escape') || this.input.wasPressed('KeyP')) this.resume();
      return;
    }
    if(this.state === 'levelComplete'){ this._handleMenuInput('complete', 'levelComplete', 'completeList'); return; }
    if(this.state === 'gameOver'){ this._handleMenuInput('gameOver', 'gameOver', 'gameOverList'); return; }

    if(this.state === 'howto' || this.state === 'about'){
      if(this.input.wasPressed('Enter') || this.input.wasPressed('Escape')) this._closeSubScreen();
      return;
    }
    if(this.state === 'settings'){
      if(this.input.wasPressed('Escape') || this.input.wasPressed('Enter')) this._closeSubScreen();
      return;
    }

    if(this.state !== 'playing') return;

    // --- Пауза/рестарт с клавиатуры во время игры ---
    if(this.input.wasPressed('Escape') || this.input.wasPressed('KeyP')){ this.pause(); return; }
    if(this.input.wasPressed('KeyR')){ this.restartLevel(); return; }

    this._updatePhysics(dt);
    this._updateHud();
  }

  // ---------------------------------------------------------------
  // Физика и коллизии
  // ---------------------------------------------------------------
  _updatePhysics(dt){
    const ball = this.ball;
    const level = this.level;
    const input = this.input;

    this.elapsed += dt;
    if(ball.invulnerable > 0) ball.invulnerable -= dt;

    // ---- Обновление движущихся платформ (горизонтальных и вертикальных) ----
    level.movingPlatforms.forEach(mp => {
      const axis = mp.axis || 'x';
      if(axis === 'x'){
        const prevX = mp.x;
        mp.x += mp.dir * mp.speed * dt;
        if(mp.x <= mp.rangeStart){ mp.x = mp.rangeStart; mp.dir = 1; }
        if(mp.x >= mp.rangeEnd){ mp.x = mp.rangeEnd; mp.dir = -1; }
        mp._deltaX = mp.x - prevX;
      } else {
        // Вертикальные платформы (лифты): вертикальное сопровождение шарика
        // уже обеспечивается самим разрешением коллизии (см. ниже), поэтому
        // отдельная дельта по X здесь не нужна.
        mp.y += mp.dir * mp.speed * dt;
        if(mp.y <= mp.rangeStart){ mp.y = mp.rangeStart; mp.dir = 1; }
        if(mp.y >= mp.rangeEnd){ mp.y = mp.rangeEnd; mp.dir = -1; }
        mp._deltaX = 0;
      }
    });

    // ---- Ломающиеся платформы: таймер разрушения ----
    level.breakablePlatforms.forEach(bp => {
      if(bp.state === 'breaking'){
        bp.timer += dt;
        if(bp.timer >= bp.breakDelay){ bp.state = 'gone'; this.audio.breakPlatform(); }
      }
    });

    // ---- Горизонтальное движение ----
    const params = ball.grounded ? (SURFACE_PARAMS[ball.currentSurface || 'normal']) : null;
    const maxSpeed = MOVE_MAX_SPEED * ball.speedMult * (params ? params.speedMult : 1);
    let targetVx = 0;
    if(input.isDown('ArrowLeft')) targetVx = -maxSpeed;
    if(input.isDown('ArrowRight')) targetVx = maxSpeed;

    const accelRate = ball.grounded
      ? (targetVx === 0 ? params.decel : params.accel)
      : AIR_ACCEL;

    if(ball.vx < targetVx) ball.vx = Math.min(targetVx, ball.vx + accelRate * dt);
    else if(ball.vx > targetVx) ball.vx = Math.max(targetVx, ball.vx - accelRate * dt);

    // ---- Прыжок ----
    if(input.wasPressed('ArrowUp') && ball.grounded){
      ball.vy = -JUMP_SPEED * ball.jumpMult;
      ball.grounded = false;
      ball.standingOn = null;
      this.audio.jump();
    }

    // ---- Гашение прыжка / отскока клавишей "вниз" ----
    if(input.isDown('ArrowDown') && ball.vy < 0){
      ball.vy = Math.min(0, ball.vy + DOWN_CANCEL_RATE * dt);
    }

    // ---- Гравитация (модифицируется водой и вентилятором, см. ниже) ----
    const inWater = level.water.find(w => circleOverlapsRect(ball.x, ball.y, ball.radius*0.6, w));
    const inFan = level.fans.find(f => ball.state === 'inflated' && circleOverlapsRect(ball.x, ball.y, ball.radius, f));

    if(inWater){
      this._applyWaterPhysics(ball, inWater, dt);
    } else if(inFan){
      // БАГФИКС: раньше подъёмная сила вентилятора прибавлялась ПОСЛЕ обычной
      // гравитации (900) и была слабее её (480), поэтому шарик всё равно падал
      // вниз и тонул в пропасти. Теперь внутри зоны вентилятора обычная
      // гравитация не применяется вовсе — её полностью заменяет подъёмная сила.
      ball.waterTimer = 0;
      ball.vy -= inFan.force * dt;
    } else {
      ball.waterTimer = 0;
      ball.vy += GRAVITY * dt;
    }

    ball.vy = clamp(ball.vy, -MAX_RISE_SPEED, MAX_FALL_SPEED);

    // ---- Интеграция позиции ----
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // ---- Сбор твёрдых поверхностей для коллизии ----
    const solids = [];
    level.platforms.forEach(p => solids.push(p));
    level.movingPlatforms.forEach(p => solids.push(p));
    level.breakablePlatforms.forEach(p => { if(p.state !== 'gone') solids.push(p); });
    level.tunnels.forEach(p => solids.push(p));

    ball.grounded = false;
    ball.currentSurface = 'normal';
    ball.standingOn = null;

    solids.forEach(rect => {
      const hit = resolveCircleRect(ball.x, ball.y, ball.radius, rect);
      if(!hit) return;
      ball.x += hit.normal.x * hit.penetration;
      ball.y += hit.normal.y * hit.penetration;

      if(hit.normal.y < -0.5){ // приземление сверху
        if(!ball.grounded) this._onLand(ball, rect);
        ball.grounded = true;
        ball.vy = 0;
        ball.standingOn = rect;
        ball.currentSurface = rect.surface || 'normal';
        if(level.breakablePlatforms.includes(rect) && rect.state === 'stable'){
          rect.state = 'breaking';
        }
      } else if(hit.normal.y > 0.5){ // удар головой снизу
        if(ball.vy < 0) ball.vy = 0;
      } else { // боковое столкновение
        ball.vx = 0;
      }
    });

    // ---- Катание на движущейся платформе (только горизонтальная составляющая;
    //      вертикальное движение уже учтено самим разрешением коллизии выше) ----
    if(ball.standingOn && ball.standingOn.rangeStart !== undefined){
      ball.x += ball.standingOn._deltaX || 0;
    }

    // ---- Батуты ----
    // БАГФИКС: раньше батуты только рисовались, но никак не участвовали в физике,
    // поэтому шарик просто стоял на платформе под ними, будто это обычный пол.
    // Теперь: если шарик стоит на платформе точно под зоной батута — подбрасываем.
    if(ball.grounded){
      const tramp = level.trampolines.find(t => ball.x >= t.x && ball.x <= t.x + t.w);
      if(tramp){
        ball.vy = -JUMP_SPEED * tramp.mult * ball.jumpMult;
        ball.grounded = false;
        ball.standingOn = null;
        this.audio.trampoline(tramp.mult);
      }
    }

    // ---- Катающиеся камни (смертельные подвижные препятствия) ----
    level.rollingRocks.forEach(rock => {
      const prevX = rock.x;
      rock.x += rock.dir * rock.speed * dt;
      if(rock.x <= rock.rangeStart){ rock.x = rock.rangeStart; rock.dir = 1; }
      if(rock.x >= rock.rangeEnd){ rock.x = rock.rangeEnd; rock.dir = -1; }
      if(ball.invulnerable <= 0 && Math.hypot(ball.x - rock.x, ball.y - rock.y) < ball.radius + rock.r){
        this._die();
      }
    });

    // ---- Маятники (смертельные качающиеся препятствия) ----
    level.pendulums.forEach(p => {
      const angle = Math.sin(this.elapsed * p.speed) * (p.amplitudeDeg * Math.PI / 180);
      p._bobX = p.pivotX + p.length * Math.sin(angle);
      p._bobY = p.pivotY + p.length * Math.cos(angle);
      if(ball.invulnerable <= 0 && Math.hypot(ball.x - p._bobX, ball.y - p._bobY) < ball.radius + p.r){
        this._die();
      }
    });

    // ---- Шипы ----
    level.spikes.forEach(s => {
      if(ball.invulnerable <= 0 && circleOverlapsRect(ball.x, ball.y, ball.radius*0.7, s)){
        this._die();
      }
    });

    // ---- Насосы ----
    level.pumps.forEach(p => {
      if(circleOverlapsRect(ball.x, ball.y, ball.radius, p)){
        ball.setState(p.type === 'inflate' ? 'inflated' : 'deflated', this.audio);
      }
    });

    // ---- Кольца ----
    level.ringsData.forEach(r => {
      if(!r.collected && Math.hypot(ball.x - r.x, ball.y - r.y) < ball.radius + r.r){
        r.collected = true;
        this.ringsCollected++;
        this.audio.ring();
      }
    });

    // ---- Контрольные точки ----
    level.checkpointsData.forEach(cp => {
      if(!cp.activated && circleOverlapsRect(ball.x, ball.y, ball.radius, cp)){
        cp.activated = true;
        level.spawn = cp.respawn;
        this.audio.checkpoint();
      }
    });

    // ---- Финиш ----
    if(!this.finished && circleOverlapsRect(ball.x, ball.y, ball.radius, level.finish)){
      this._completeLevel();
    }

    // ---- Смерть от падения в пропасть ----
    if(ball.y - ball.radius > FALL_DEATH_Y){
      this._die();
    }

    // ---- Камера (плавное следование, с ограничением по краям уровня) ----
    const targetCam = clamp(ball.x - VIEW_WIDTH/2, 0, Math.max(0, level.width - VIEW_WIDTH));
    this.camera = lerp(this.camera, targetCam, 0.12);

    // ---- Визуальное вращение шарика при качении ----
    ball.rotation += (ball.vx / ball.radius) * dt;
  }

  _onLand(ball, rect){
    // лёгкий звук приземления, не спамим при статичном стоянии на месте
    if(ball.vy > 60) this.audio.land();
  }

  _applyWaterPhysics(ball, water, dt){
    const surfaceY = water.y;
    if(ball.state === 'inflated'){
      const targetY = surfaceY - ball.radius * 0.55;
      ball.vy += (targetY - ball.y) * 6 * dt;
      ball.vy *= 0.92;
    } else if(ball.state === 'normal'){
      ball.vy += GRAVITY * 0.28 * dt;
      ball.vy *= 0.97;
      ball.waterTimer += dt;
      if(ball.waterTimer > WATER_DEATH_TIME){ this._die(); }
    } else { // deflated
      this._die();
    }
    ball.vx += water.current * dt * 0.6;
  }

  _die(){
    if(this.ball.invulnerable > 0 || !this.ball.alive) return;
    this.deaths++;
    this.lives--;
    this.audio.death();
    if(this.lives <= 0){
      this.audio.stopMusic();
      this.state = 'gameOver';
      this.showOverlay('gameOver');
      return;
    }
    const respawn = this.level.spawn;
    this.ball.reset(respawn.x, respawn.y);
    this.ball.invulnerable = INVULN_TIME;
  }

  _completeLevel(){
    this.finished = true;
    this.audio.stopMusic();
    this.audio.finish();
    const rating = this._computeRating();
    const mm = Math.floor(this.elapsed/60).toString().padStart(2,'0');
    const ss = Math.floor(this.elapsed%60).toString().padStart(2,'0');
    this.dom.resultsText.innerHTML =
      `Время: ${mm}:${ss}<br>Колец: ${this.ringsCollected}/${this.ringsTotal}<br>Смертей: ${this.deaths}`;
    this.dom.resultsRating.textContent = rating;
    this.save.reportLevelResult({ time:this.elapsed, rings:this.ringsCollected, totalRings:this.ringsTotal });
    this.state = 'levelComplete';
    this.dom.hud.classList.add('hidden');
    this.showOverlay('levelComplete');
  }

  _computeRating(){
    const allRings = this.ringsCollected >= this.ringsTotal;
    const t = this.elapsed;
    if(allRings && this.deaths === 0 && t <= 110) return 'S';
    if(this.ringsCollected >= Math.ceil(this.ringsTotal*0.7) && this.deaths <= 2 && t <= 170) return 'A';
    if(this.deaths <= 6 && t <= 260) return 'B';
    return 'C';
  }

  // ---------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------
  _updateHud(){
    this.dom.hudRings.textContent = `${this.ringsCollected}/${this.ringsTotal}`;
    const mm = Math.floor(this.elapsed/60).toString().padStart(2,'0');
    const ss = Math.floor(this.elapsed%60).toString().padStart(2,'0');
    this.dom.hudTimer.textContent = `${mm}:${ss}`;
    this.dom.hudLives.textContent = '●'.repeat(Math.max(0,this.lives)) + '○'.repeat(Math.max(0,3-this.lives));
    this.dom.hudBallState.style.color = this.ball.color;
    this.dom.hudBallState.textContent = this.ball.state === 'inflated' ? '◯' : (this.ball.state === 'deflated' ? '•' : '●');
  }

  // ---------------------------------------------------------------
  // Рендер
  // ---------------------------------------------------------------
  render(){
    const ctx = this.ctx;
    ctx.clearRect(0,0,VIEW_WIDTH,VIEW_HEIGHT);

    if(this.state !== 'playing' && this.state !== 'paused'){
      // фоновый спокойный градиент для меню
      const g = ctx.createLinearGradient(0,0,0,VIEW_HEIGHT);
      g.addColorStop(0,'#6CB4EE'); g.addColorStop(1,'#3d7bb0');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,VIEW_WIDTH,VIEW_HEIGHT);
      return;
    }

    const cam = this.camera;
    const level = this.level;
    const ball = this.ball;
    const t = performance.now()/1000;

    // небо
    const sky = ctx.createLinearGradient(0,0,0,VIEW_HEIGHT);
    sky.addColorStop(0,'#8fd3ff'); sky.addColorStop(1,'#5aa8dd');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,VIEW_WIDTH,VIEW_HEIGHT);

    const sx = (wx) => wx - cam;

    // ---- вода (рисуем под платформами, за исключением поверхности) ----
    level.water.forEach(w => {
      ctx.fillStyle = 'rgba(42,117,181,0.85)';
      ctx.fillRect(sx(w.x), w.y, w.w, VIEW_HEIGHT - w.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      for(let i=0;i<w.w;i+=14){
        const wave = Math.sin(t*2 + i*0.3)*2;
        ctx.beginPath();
        ctx.moveTo(sx(w.x)+i, w.y+wave);
        ctx.lineTo(sx(w.x)+i+8, w.y+wave);
        ctx.stroke();
      }
    });

    // ---- платформы ----
    level.platforms.forEach(p => this._drawPlatform(p, sx));
    level.movingPlatforms.forEach(p => this._drawPlatform(p, sx, '#7a4fd6'));
    level.breakablePlatforms.forEach(p => {
      if(p.state === 'gone') return;
      const flicker = p.state === 'breaking' && Math.floor(t*12)%2===0;
      this._drawPlatform(p, sx, flicker ? '#ff9966' : '#b0553a');
    });

    // ---- тоннели (потолок) ----
    level.tunnels.forEach(tu => {
      ctx.fillStyle = '#1A3A5C';
      ctx.fillRect(sx(tu.x), tu.y, tu.w, tu.h);
      ctx.fillStyle = '#0b2036';
      ctx.fillRect(sx(tu.x), tu.y+tu.h-6, tu.w, 6);
    });

    // ---- шипы ----
    ctx.fillStyle = '#000000';
    level.spikes.forEach(s => {
      const n = Math.round(s.w/10);
      for(let i=0;i<n;i++){
        const bx = sx(s.x) + i*(s.w/n);
        ctx.beginPath();
        ctx.moveTo(bx, s.y+s.h);
        ctx.lineTo(bx + s.w/n/2, s.y);
        ctx.lineTo(bx + s.w/n, s.y+s.h);
        ctx.closePath();
        ctx.fill();
      }
    });

    // ---- батуты ----
    level.trampolines.forEach(tr => {
      const colors = { normal:'#33CC33', strong:'#1f9e1f', super:'#0f7a0f' };
      ctx.fillStyle = colors[tr.type] || '#33CC33';
      ctx.fillRect(sx(tr.x), tr.y, tr.w, tr.h);
      ctx.fillStyle = '#0b3d0b';
      ctx.fillRect(sx(tr.x), tr.y+tr.h-3, tr.w, 3);
    });

    // ---- катающиеся камни ----
    level.rollingRocks.forEach(rock => {
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.arc(sx(rock.x), rock.y, rock.r, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // ---- маятники ----
    level.pendulums.forEach(p => {
      const bobX = p._bobX !== undefined ? p._bobX : p.pivotX;
      const bobY = p._bobY !== undefined ? p._bobY : p.pivotY + p.length;
      // крепление
      ctx.fillStyle = '#333';
      ctx.fillRect(sx(p.pivotX)-4, p.pivotY-4, 8, 8);
      // трос
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(p.pivotX), p.pivotY);
      ctx.lineTo(sx(bobX), bobY);
      ctx.stroke();
      // шар маятника (шипастый)
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(sx(bobX), bobY, p.r, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.stroke();
    });

    // ---- насосы ----
    level.pumps.forEach(p => {
      const inflate = p.type === 'inflate';
      ctx.fillStyle = inflate ? '#66CCFF' : '#FF9933';
      ctx.fillRect(sx(p.x), p.y, p.w, p.h);
      ctx.fillStyle = '#062033';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(inflate ? '↑' : '↓', sx(p.x)+p.w/2, p.y+p.h*0.72);
    });

    // ---- вентилятор ----
    level.fans.forEach(f => {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      for(let i=0;i<3;i++){
        const yy = f.y + f.h - ((t*80 + i*30) % f.h);
        ctx.beginPath();
        ctx.moveTo(sx(f.x)+f.w*0.3, yy);
        ctx.lineTo(sx(f.x)+f.w*0.7, yy-8);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(sx(f.x), f.y, f.w, f.h);
    });

    // ---- кольца ----
    level.ringsData.forEach(r => {
      if(r.collected) return;
      const squish = Math.abs(Math.sin(t*3 + r.x*0.05));
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(sx(r.x), r.y, r.r*(0.4+0.6*squish), r.r, 0, 0, Math.PI*2);
      ctx.stroke();
    });

    // ---- контрольные точки ----
    level.checkpointsData.forEach(cp => {
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx(cp.x)+2, cp.y+cp.h);
      ctx.lineTo(sx(cp.x)+2, cp.y);
      ctx.stroke();
      ctx.fillStyle = cp.activated ? '#33CC33' : '#999';
      ctx.beginPath();
      ctx.moveTo(sx(cp.x)+2, cp.y);
      ctx.lineTo(sx(cp.x)+cp.w, cp.y+cp.h*0.3);
      ctx.lineTo(sx(cp.x)+2, cp.y+cp.h*0.6);
      ctx.closePath();
      ctx.fill();
    });

    // ---- финиш ----
    const fin = level.finish;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(sx(fin.x)+fin.w/2, fin.y+fin.h/2, fin.w/2, fin.h/2, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,0,0.15)';
    ctx.fill();

    // ---- шарик ----
    if(!(ball.invulnerable > 0 && Math.floor(t*14)%2===0)){
      ctx.save();
      ctx.translate(sx(ball.x), ball.y);
      ctx.rotate(ball.rotation);
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(0,0,ball.radius,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // полоска для визуализации вращения
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(-ball.radius*0.6,0); ctx.lineTo(ball.radius*0.6,0);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawPlatform(p, sx, overrideColor){
    const ctx = this.ctx;
    const colors = { normal:'#1A3A5C', ice:'#BFEFFF', mud:'#6B4A2B' };
    ctx.fillStyle = overrideColor || colors[p.surface] || colors.normal;
    ctx.fillRect(sx(p.x), p.y, p.w, p.h);
    // верхняя грань — более светлая полоска для читаемости
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(sx(p.x), p.y, p.w, 3);
  }
}
