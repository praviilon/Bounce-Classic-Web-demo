/* ==========================================================
   main.js — точка входа приложения.
   Создаёт менеджеры (ввод, звук, сохранение), игру и
   запускает игровой цикл через requestAnimationFrame.
   ========================================================== */

(function(){
  const canvas = document.getElementById('game-canvas');
  const input = new InputManager();
  const audio = new AudioManager();
  const save = new SaveManager();
  const game = new Game(canvas, input, audio, save);

  // Разблокировка Web Audio по первому пользовательскому вводу
  // (требование политики автовоспроизведения в Chrome/Safari).
  let unlocked = false;
  const unlockAudio = () => {
    if(unlocked) return;
    unlocked = true;
    audio.unlock();
  };
  input.onAnyKey = unlockAudio;
  document.body.addEventListener('click', unlockAudio, { once:false });

  // Настройки громкости из главного меню
  const musicSlider = document.getElementById('musicVol');
  const sfxSlider = document.getElementById('sfxVol');
  musicSlider.value = Math.round(save.data.musicVolume*100);
  sfxSlider.value = Math.round(save.data.sfxVolume*100);
  audio.setMusicVolume(save.data.musicVolume);
  audio.setSfxVolume(save.data.sfxVolume);
  musicSlider.addEventListener('input', () => {
    const v = musicSlider.value/100;
    audio.setMusicVolume(v);
    save.setVolumes(v, audio.sfxVolume);
  });
  sfxSlider.addEventListener('input', () => {
    const v = sfxSlider.value/100;
    audio.setSfxVolume(v);
    save.setVolumes(audio.musicVolume, v);
    unlockAudio();
    audio.ring();
  });

  // Декоративные часы в статус-баре (имитация экрана телефона)
  const clockEl = document.getElementById('statusClock');
  function updateClock(){
    const d = new Date();
    const hh = d.getHours().toString().padStart(2,'0');
    const mm = d.getMinutes().toString().padStart(2,'0');
    clockEl.textContent = `${hh}:${mm}`;
  }
  updateClock();
  setInterval(updateClock, 15000);

  // ---- Игровой цикл ----
  let lastTime = performance.now();
  function loop(now){
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    game.update(dt);
    game.render();
    input.clearFrame();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
