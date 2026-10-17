// Hero: tiga nada (Rasa, Fungsi, Struktur). Tiap nada yang dimatikan bergetar
// sumbang dengan frekuensinya sendiri; saat dinyalakan, ia luruh ke satu
// gelombang bersama. Ketiganya menyala = satu garis yang selaras.
(() => {
  const canvas = document.getElementById("wave");
  const status = document.getElementById("status");
  const tuner = document.querySelector(".tuner");
  const keys = [...document.querySelectorAll(".key")];
  const ctx = canvas.getContext("2d");

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

  // Seberapa keras suara yang sedang terdengar (0..1). Gelombang ikut membesar
  // dan berjalan lebih cepat saat ada bunyi, lalu tenang lagi saat hening.
  let analyser = null;
  let samples = null;
  let level = 0;   // sudah dihaluskan dua tahap, dipakai untuk menggambar
  let follow = 0;  // tahap pertama: cepat naik, pelan turun
  let peak = 0.02;
  let travel = 0;
  let speed = 1.4; // kecepatan rambat, juga dihaluskan
  let lastT = 0;
  let dt = 1 / 60;
  // Gelombang diam sampai tombol pertama ditekan; setelah itu geraknya menyala pelan-pelan.
  let awake = false;
  let motion = 0;
  let clock = 0;

  // Pelunakan berbasis waktu (bukan per frame), jadi sama mulusnya di layar 60 maupun 144 Hz.
  const ease = (cur, target, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
  const smooth = (v) => v * v * (3 - 2 * v);

  function readLevel() {
    let target = 0;
    if (analyser) {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let k = 0; k < samples.length; k++) sum += samples[k] * samples[k];
      const rms = Math.sqrt(sum / samples.length);
      peak = Math.max(rms, peak * Math.pow(0.5, dt / 4), 0.02);
      // Ambang kecil supaya ekor gema yang nyaris hening tidak membuat gelombang bergetar.
      target = Math.min(1, Math.max(0, (rms / peak - 0.12) / 0.88));
    }
    follow = ease(follow, target, target > follow ? 0.08 : 0.4);
    level = ease(level, follow, 0.18);
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const mid = height / 2;
    const amp = height * 0.32 * (1 + level * 0.35);
    speed = ease(speed, 1.4 + level * 1.6, 0.3);
    motion = ease(motion, awake ? 1 : 0, 0.6);
    clock += dt * motion;
    travel += dt * speed * motion;
    const allOn = strands.every((s) => s.on);

    strands.forEach((s, i) => {
      s.mix = ease(s.mix, s.on ? 1 : 0, 0.28);
      const m = smooth(s.mix);

      // Titik tiap 4px, disambung kurva kuadrat lewat titik tengah supaya garis tidak bersudut.
      const pts = [];
      for (let x = 0; x <= width + 4; x += 4) {
        const px = Math.min(x, width);
        const u = px / width;
        const env = Math.sin(Math.PI * u); // senar yang terikat di kedua ujung
        const harmony = Math.sin(u * Math.PI * 4 - travel);
        let noise = 0;
        for (const p of s.partials) {
          noise += p.amp * Math.sin(u * Math.PI * p.freq + clock * p.speed + p.phase);
        }
        pts.push([px, mid + env * amp * (m * harmony * 0.7 + (1 - m) * noise * 1.6)]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) {
        const mx = (pts[k][0] + pts[k + 1][0]) / 2;
        const my = (pts[k][1] + pts[k + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = allOn ? 1 - i * 0.25 : 0.35 + m * 0.5;
      ctx.lineWidth = allOn && i === 0 ? 3.5 : 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function loop(ms) {
    const t = ms / 1000;
    dt = Math.min(0.05, Math.max(0.001, t - lastT)); // batasi lonjakan setelah tab tersembunyi
    lastT = t;
    readLevel();
    draw();
    requestAnimationFrame(loop);
  }

  function update() {
    const count = strands.filter((s) => s.on).length;
    status.textContent = MESSAGES[count];
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

      analyser = audio.createAnalyser();
      analyser.fftSize = 1024;
      samples = new Float32Array(analyser.fftSize);
      master.connect(analyser);

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
      awake = true;
      key.setAttribute("aria-pressed", String(s.on));
      tuner.classList.add("is-touched");
      update();
      sound(i, s.on);
    });
  });

  window.addEventListener("resize", () => {
    resize();
  });

  resize();
  requestAnimationFrame(loop);
})();

// Animasi saat di-scroll: elemen muncul ketika masuk layar, dan garis tipis di atas
// halaman menunjukkan seberapa jauh halaman sudah dibaca.
(() => {
  const bar = document.querySelector(".progress");
  let ticking = false;
  function paint() {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  }
  addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(paint); }
  }, { passive: true });
  addEventListener("resize", paint);
  paint();

  if (!("IntersectionObserver" in window)) return;

  const targets = [
    ".philosophy__intro > *", ".pillar",
    "#layanan .container > :not(.services)", ".service",
    "#karya .container > :not(.works)", ".work",
    "#proses .container > :not(.staff)", ".step",
    ".contact > *",
  ];
  const els = document.querySelectorAll(targets.join(","));
  const staff = document.querySelector(".staff");
  document.documentElement.classList.add("js");
  els.forEach((el) => el.classList.add("reveal"));
  document.querySelectorAll(".pillar").forEach((el) => el.classList.add("reveal--right"));

  // Elemen yang muncul bersamaan diberi jeda berurutan (--i).
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.setProperty("--i", n++);
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });

  els.forEach((el) => io.observe(el));
  io.observe(staff);
})();
