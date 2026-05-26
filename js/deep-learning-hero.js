(() => {
  const canvas = document.querySelector(".dl-hero-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  let w = 0;
  let h = 0;
  let dpr = 1;

  /** @type {{baseX:number;baseY:number;amp:number;speed:number;phase:number;x:number;y:number}[]} */
  let nodes = [];
  /** @type {{a:number;b:number;phase:number}[]} */
  let links = [];
  /** @type {{x:number;y:number;r:number;maxR:number}[]} */
  let pulses = [];

  let lastTime = 0;
  let nextPulseAt = 0;

  const rand = (min, max) => min + Math.random() * (max - min);

  function buildNetwork() {
    nodes = [];
    links = [];
    pulses = [];

    const cols = Math.max(6, Math.floor(w / 140));
    const rows = Math.max(3, Math.floor(h / 120));

    const marginX = Math.max(20, w * 0.08);
    const marginY = Math.max(30, h * 0.22);
    const spanX = Math.max(1, w - marginX * 2);
    const spanY = Math.max(1, h - marginY * 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = marginX + (c * spanX) / Math.max(1, cols - 1);
        const y = marginY + (r * spanY) / Math.max(1, rows - 1);
        const amp = rand(1.5, 6.5) * (0.75 + (r / Math.max(1, rows - 1)) * 0.6);
        nodes.push({
          baseX: x,
          baseY: y,
          amp,
          speed: rand(0.55, 1.25),
          phase: rand(0, Math.PI * 2),
          x,
          y
        });
      }
    }

    const linkDist = Math.min(230, Math.max(140, Math.min(w, h) * 0.23));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].baseX - nodes[j].baseX;
        const dy = nodes[i].baseY - nodes[j].baseY;
        const dist = Math.hypot(dx, dy);
        if (dist <= linkDist) {
          links.push({ a: i, b: j, phase: rand(0, Math.PI * 2) });
        }
      }
    }

    // 初回のパルス
    nextPulseAt = performance.now() + rand(400, 1200);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);

    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));

    buildNetwork();
    draw(performance.now());
  }

  function spawnPulse(t) {
    if (!nodes.length) return;
    const n = nodes[Math.floor(Math.random() * nodes.length)];
    pulses.push({
      x: n.x,
      y: n.y,
      r: 0,
      maxR: Math.min(w, h) * 0.65
    });
    nextPulseAt = t + rand(1200, 2200);
  }

  function updateNodes(t) {
    // t: ms
    for (const node of nodes) {
      const tt = t * 0.001; // seconds
      node.x = node.baseX + Math.sin(tt * node.speed + node.phase) * node.amp;
      node.y = node.baseY + Math.cos(tt * (node.speed * 0.92) + node.phase) * node.amp * 0.82;
    }
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    updateNodes(t);

    // 線とノードの“発光”描画
    ctx.globalCompositeOperation = "lighter";

    const time = t * 0.001;
    const linkDist = Math.min(230, Math.max(140, Math.min(w, h) * 0.23));

    for (const link of links) {
      const a = nodes[link.a];
      const b = nodes[link.b];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist > linkDist) continue;

      const activity = 0.45 + 0.55 * Math.sin(time * 1.2 + link.phase);
      const alpha = (1 - dist / linkDist) * 0.33 * activity;

      ctx.strokeStyle = `rgba(80, 190, 255, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // ノード
    for (const node of nodes) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.35 + node.phase);
      const r = 1.05 + pulse * 1.25;
      ctx.fillStyle = `rgba(200, 235, 255, ${0.35 + pulse * 0.35})`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "rgba(0, 170, 255, 0.45)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // パルス（波紋）
    if (pulses.length) {
      for (const p of pulses) {
        const a = Math.max(0, 1 - p.r / p.maxR);
        if (a <= 0) continue;

        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.12 + a * 0.22})`;
        ctx.shadowBlur = 22;
        ctx.shadowColor = "rgba(0, 200, 255, 0.55)";

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
  }

  function tick(t) {
    const dt = t - lastTime;
    lastTime = t;

    if (!prefersReducedMotion) {
      if (t >= nextPulseAt) spawnPulse(t);
      for (const p of pulses) {
        p.r += dt * 0.06;
      }
      pulses = pulses.filter((p) => p.r <= p.maxR);

      draw(t);
      requestAnimationFrame(tick);
    } else {
      // アニメーション抑制時は一度描画
      draw(t);
    }
  }

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(canvas);

  window.addEventListener("resize", () => resize(), { passive: true });
  resize();

  requestAnimationFrame((t) => {
    lastTime = t;
    if (!prefersReducedMotion) requestAnimationFrame(tick);
  });
})();

