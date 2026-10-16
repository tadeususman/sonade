// Hero: tiga nada (Rasa, Fungsi, Struktur). Tiap nada yang dimatikan bergetar
// sumbang dengan frekuensinya sendiri; saat dinyalakan, ia luruh ke satu
// gelombang bersama. Ketiganya menyala = satu garis yang selaras.
(() => {
  const canvas = document.getElementById("wave");
  const status = document.getElementById("status");
  const tuner = document.querySelector(".tuner");
  const keys = [...document.querySelectorAll(".key")];
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const COLORS = ["#F4A985", "#F9CDB7", "#FFFFFF"];
  const MESSAGES = [
    "Masih fals…",
    "Mulai enak didengar…",
    "Sedikit lagi…",
    "Nah, sekarang sudah pas. ♪",
  ];

  // Tiap nada punya "kesumbangan" berupa beberapa sinus acak.
  const strands = COLORS.map((color, i) => ({
    color,
    on: false,
    mix: 0, // 0 = sumbang, 1 = selaras (dianimasikan)
    partials: Array.from({ length: 3 }, (_, j) => ({
      freq: 2 + i * 1.7 + j * 2.3 + Math.random() * 1.5,
      speed: (0.6 + Math.random() * 1.4) * (j % 2 ? -1 : 1),
      phase: Math.random() * Math.PI * 2,
      amp: 0.35 / (j + 1),
    })),
  }));

  let width = 0, height = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height);
    const mid = height / 2;
    const amp = height * 0.32;
    const allOn = strands.every((s) => s.on);

    strands.forEach((s, i) => {
      s.mix += ((s.on ? 1 : 0) - s.mix) * 0.06;

      ctx.beginPath();
      for (let x = 0; x <= width; x += 3) {
        const u = x / width;
        const env = Math.sin(Math.PI * u); // senar yang terikat di kedua ujung
        const harmony = Math.sin(u * Math.PI * 4 - t * 1.4);
        let noise = 0;
        for (const p of s.partials) {
          noise += p.amp * Math.sin(u * Math.PI * p.freq + t * p.speed + p.phase);
        }
        const y = mid + env * amp * (s.mix * harmony * 0.7 + (1 - s.mix) * noise * 1.6);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = allOn ? 1 - i * 0.25 : 0.35 + s.mix * 0.5;
      ctx.lineWidth = allOn && i === 0 ? 3.5 : 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function loop(ms) {
    draw(ms / 1000);
    requestAnimationFrame(loop);
  }

  function update() {
    const count = strands.filter((s) => s.on).length;
    status.textContent = MESSAGES[count];
    if (reduceMotion) {
      strands.forEach((s) => (s.mix = s.on ? 1 : 0));
      draw(0);
    }
  }

  // Suara: tiap nada satu not (C, E, G). Ketiganya menyala = akor C mayor.
  // AudioContext baru dibuat saat tombol diklik, jadi tidak ada suara saat halaman dibuka.
  const NOTES = [261.63, 329.63, 392.0];
  const muteBtn = document.getElementById("mute");
  let audio = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem("sonade-muted") === "1"; } catch {}
  muteBtn.setAttribute("aria-pressed", String(!muted));

  function ensureAudio() {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio = new AC();
      master = audio.createGain();
      master.gain.value = 0.16;
      master.connect(audio.destination);

      // Gema halus: impuls dari noise yang meluruh, dicampur dengan suara asli.
      const reverb = audio.createConvolver();
      const len = audio.sampleRate * 2.6;
      const impulse = audio.createBuffer(2, len, audio.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let n = 0; n < len; n++) data[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, 3);
      }
      reverb.buffer = impulse;
      const wet = audio.createGain();
      wet.gain.value = 0.35;
      master.connect(reverb).connect(wet).connect(audio.destination);
    }
    if (audio.state === "suspended") audio.resume();
    return true;
  }

  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const cents = (freq, c) => freq * Math.pow(2, c / 1200);

  // Nada lembut seperti bel: sinus dengan sedikit overtone dan peluruhan.
  function tone(freq, { at = 0, dur = 1.6, gain = 1, out = master } = {}) {
    const t0 = audio.currentTime + at;
    const env = audio.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    env.connect(out);
    [[1, 1], [2, 0.22], [3, 0.06]].forEach(([mult, g]) => {
      const osc = audio.createOscillator();
      const og = audio.createGain();
      osc.frequency.value = freq * mult;
      og.gain.value = g;
      osc.connect(og).connect(env);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });
  }

  // Pad hangat: dua sinus yang sedikit berbeda nada, masuk dan keluar perlahan.
  function pad(notes, { at = 0, dur = 1.4, gain = 0.1, out = master } = {}) {
    const t0 = audio.currentTime + at;
    notes.forEach((m) => {
      const env = audio.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(gain, t0 + 0.35);
      env.gain.setValueAtTime(gain, t0 + dur);
      env.gain.linearRampToValueAtTime(0, t0 + dur + 0.6);
      env.connect(out);
      [-5, 5].forEach((c) => {
        const osc = audio.createOscillator();
        osc.frequency.value = cents(midi(m), c);
        osc.connect(env);
        osc.start(t0);
        osc.stop(t0 + dur + 0.7);
      });
    });
  }

  // Musik "selaras": progresi C → Am → F → G yang berputar terus selama ketiga nada
  // menyala. Tiap birama dijadwalkan sedikit lebih awal, dan melodinya dipilih acak
  // dari pentatonik C supaya selalu harmonis tapi tidak terdengar berulang.
  const BAR = 3.6;
  const PROGRESSION = [
    [48, 55, 64, 71, 74], // Cmaj9
    [45, 52, 60, 67, 71], // Am9
    [41, 48, 57, 64, 67], // Fmaj9
    [43, 50, 59, 64, 69], // G6/9
  ];
  const MELODY = [72, 74, 76, 79, 81, 84];
  let music = null;

  function scheduleBar(n, when) {
    const at = when - audio.currentTime;
    const out = music.bus;
    pad(PROGRESSION[n % PROGRESSION.length], { at, dur: BAR - 0.2, gain: 0.07, out });
    if (n === 0) {
      // Birama pertama: denting naik sebagai tanda "sudah selaras".
      [72, 76, 79, 83, 84].forEach((m, k) =>
        tone(midi(m), { at: at + k * 0.13, dur: 2.6, gain: 0.4 - k * 0.05, out })
      );
      return;
    }
    const slots = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 2));
    slots.forEach((slot) => {
      const m = MELODY[Math.floor(Math.random() * MELODY.length)];
      tone(midi(m), { at: at + slot * (BAR / 8), dur: 2.4, gain: 0.22 + Math.random() * 0.12, out });
    });
  }

  function tick() {
    if (!music) return;
    while (music.next < audio.currentTime + 1.5) {
      scheduleBar(music.bar, music.next);
      music.next += BAR;
      music.bar++;
    }
    music.timer = setTimeout(tick, 400);
  }

  function startMusic() {
    if (music) return;
    const bus = audio.createGain();
    bus.connect(master);
    music = { bus, bar: 0, next: audio.currentTime + 0.05, timer: 0 };
    tick();
  }

  function stopMusic() {
    if (!music) return;
    const { bus, timer } = music;
    music = null;
    clearTimeout(timer);
    bus.gain.setValueAtTime(bus.gain.value, audio.currentTime);
    bus.gain.linearRampToValueAtTime(0, audio.currentTime + 1.2);
    setTimeout(() => bus.disconnect(), 1400);
  }

  document.addEventListener("visibilitychange", () => {
    if (!audio) return;
    if (document.hidden) audio.suspend();
    else if (music) audio.resume();
  });

  function sound(i, on) {
    if (muted || !ensureAudio()) return;
    if (strands.every((s) => s.on)) {
      startMusic();
      return;
    }
    stopMusic();
    if (on) {
      tone(NOTES[i], { dur: 1.4 });
    } else {
      // Dimatikan: dua nada yang sedikit meleset, terdengar fals.
      tone(cents(NOTES[i], -60), { dur: 0.7, gain: 0.6 });
      tone(cents(NOTES[i], -95), { dur: 0.7, gain: 0.4 });
    }
  }

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.setAttribute("aria-pressed", String(!muted));
    if (muted && audio) stopMusic();
    if (!muted && strands.every((s) => s.on) && ensureAudio()) startMusic();
    try { localStorage.setItem("sonade-muted", muted ? "1" : "0"); } catch {}
  });

  keys.forEach((key) => {
    key.addEventListener("click", () => {
      const i = Number(key.dataset.strand);
      const s = strands[i];
      s.on = !s.on;
      key.setAttribute("aria-pressed", String(s.on));
      tuner.classList.add("is-touched");
      update();
      sound(i, s.on);
    });
  });

  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) draw(0);
  });

  resize();
  if (reduceMotion) draw(0);
  else requestAnimationFrame(loop);
})();
