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

  keys.forEach((key) => {
    key.addEventListener("click", () => {
      const s = strands[Number(key.dataset.strand)];
      s.on = !s.on;
      key.setAttribute("aria-pressed", String(s.on));
      tuner.classList.add("is-touched");
      update();
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
