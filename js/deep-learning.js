document.addEventListener("DOMContentLoaded", () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    initPixelGrid();
    initOutputPanel();

    document.querySelectorAll("[data-dl-canvas]").forEach((canvas) => {
        const mode = canvas.dataset.dlCanvas;
        if (mode === "hero") {
            initCanvasNetwork(canvas, {
                layers: [4, 6, 6, 4],
                hero: true,
                signalDensity: 0.55
            }, prefersReducedMotion);
        } else if (mode === "pipeline") {
            initCanvasNetwork(canvas, {
                layers: [5, 7, 7, 5, 3],
                hero: false,
                signalDensity: 1,
                onInference: handleInferencePulse
            }, prefersReducedMotion);
        }
    });
});

const SIGNAL_COLORS = [
    "#00e5ff",
    "#ff6bcb",
    "#ffe066",
    "#69f0ae",
    "#b388ff",
    "#ff8a65",
    "#40c4ff",
    "#ea80fc"
];

const CLASS_LABELS = [
    { id: "cat", name: "猫", base: 0.12 },
    { id: "dog", name: "犬", base: 0.2 },
    { id: "bird", name: "鳥", base: 0.1 }
];

let inferenceTick = 0;

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function pickColor() {
    return SIGNAL_COLORS[Math.floor(Math.random() * SIGNAL_COLORS.length)];
}

function initPixelGrid() {
    const grid = document.getElementById("dl-pixel-grid");
    if (!grid) {
        return;
    }

    const pattern = [
        0, 0, 1, 1, 1, 1, 0, 0,
        0, 1, 1, 1, 1, 1, 1, 0,
        1, 1, 0, 1, 1, 0, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1,
        1, 0, 1, 1, 1, 1, 0, 1,
        1, 1, 0, 0, 0, 0, 1, 1,
        0, 1, 1, 0, 0, 1, 1, 0,
        0, 0, 1, 1, 1, 1, 0, 0
    ];

    pattern.forEach((on) => {
        const cell = document.createElement("span");
        cell.className = `dl-pixel${on ? " is-active" : ""}`;
        grid.appendChild(cell);
    });
}

function initOutputPanel() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        updateOutputBars([0.15, 0.72, 0.13], "犬");
    }
}

function pulsePixelGrid() {
    const cells = document.querySelectorAll(".dl-pixel");
    if (!cells.length) {
        return;
    }
    cells.forEach((cell) => cell.classList.remove("is-active"));
    let i = 0;
    const step = () => {
        if (i < cells.length) {
            if (Math.random() > 0.35) {
                cells[i].classList.add("is-active");
            }
            i += 1;
            setTimeout(step, 12);
        }
    };
    step();
}

function updateOutputBars(scores, winnerName) {
    const items = document.querySelectorAll(".dl-class-bars li");
    const labelEl = document.getElementById("dl-predicted-label");
    let maxIdx = 0;

    scores.forEach((score, idx) => {
        if (score > scores[maxIdx]) {
            maxIdx = idx;
        }
    });

    items.forEach((item, idx) => {
        const bar = item.querySelector(".dl-bar i");
        const scoreEl = item.querySelector(".dl-score");
        const value = scores[idx];
        if (bar) {
            bar.style.width = `${Math.round(value * 100)}%`;
        }
        if (scoreEl) {
            scoreEl.textContent = value.toFixed(2);
        }
        item.classList.toggle("is-winner", idx === maxIdx);
    });

    if (labelEl) {
        labelEl.textContent = `予測: ${winnerName}（${scores[maxIdx].toFixed(0)}%）`;
    }
}

function handleInferencePulse() {
    inferenceTick += 1;
    pulsePixelGrid();

    const winnerIdx = inferenceTick % 3;
    const scores = CLASS_LABELS.map((_, i) => {
        if (i === winnerIdx) {
            return rand(0.72, 0.92);
        }
        return rand(0.04, 0.22);
    });
    const sum = scores.reduce((a, b) => a + b, 0);
    const normalized = scores.map((s) => s / sum);
    updateOutputBars(normalized, CLASS_LABELS[winnerIdx].name);
}

function buildLayeredNetwork(w, h, layerSizes, hero) {
    const neurons = [];
    const links = [];
    const marginX = hero ? w * 0.06 : w * 0.04;
    const marginY = hero ? h * 0.2 : h * 0.14;
    const spanX = w - marginX * 2;
    const spanY = h - marginY * 2;
    const layerCount = layerSizes.length;

    layerSizes.forEach((count, layer) => {
        const lx = marginX + (layer / Math.max(1, layerCount - 1)) * spanX;
        for (let n = 0; n < count; n += 1) {
            const ly = marginY + ((n + 0.5) / count) * spanY;
            neurons.push({
                layer,
                index: n,
                x: lx,
                y: ly,
                radius: hero ? 3.5 : 5,
                glow: 0
            });
        }
    });

    let offset = 0;
    layerSizes.forEach((count, layer) => {
        if (layer >= layerSizes.length - 1) {
            return;
        }
        const nextOffset = offset + count;
        const nextCount = layerSizes[layer + 1];
        for (let i = 0; i < count; i += 1) {
            for (let j = 0; j < nextCount; j += 1) {
                links.push({
                    from: offset + i,
                    to: nextOffset + j,
                    layer
                });
            }
        }
        offset += count;
    });

    return { neurons, links };
}

function initCanvasNetwork(canvas, options, prefersReducedMotion) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
        return;
    }

    const { layers, hero, signalDensity, onInference } = options;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let neurons = [];
    let links = [];
    /** @type {{linkIdx:number, progress:number, speed:number, color:string, width:number}[]} */
    let signals = [];
    let lastSpawn = 0;
    let lastInference = 0;
    let running = false;
    let rafId = 0;

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        w = Math.max(1, rect.width);
        h = Math.max(1, rect.height);
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        const built = buildLayeredNetwork(w, h, layers, hero);
        neurons = built.neurons;
        links = built.links;
        signals = [];
    };

    const spawnSignal = (linkIdx, progress = 0) => {
        signals.push({
            linkIdx,
            progress,
            speed: rand(0.35, 0.65) * signalDensity,
            color: pickColor(),
            width: rand(2, 3.5)
        });
    };

    const spawnWaveFromLayer = (layer) => {
        const layerLinks = links
            .map((link, idx) => ({ link, idx }))
            .filter(({ link }) => link.layer === layer);

        const count = Math.max(1, Math.floor(layerLinks.length * (hero ? 0.08 : 0.14) * signalDensity));
        for (let i = 0; i < count; i += 1) {
            const pick = layerLinks[Math.floor(Math.random() * layerLinks.length)];
            if (pick) {
                spawnSignal(pick.idx, rand(0, 0.15));
            }
        }
    };

    const drawLink = (x1, y1, x2, y2, alpha, width) => {
        ctx.strokeStyle = `rgba(70, 130, 220, ${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };

    const hexToRgba = (hex, a) => {
        const v = hex.replace("#", "");
        const r = parseInt(v.slice(0, 2), 16);
        const g = parseInt(v.slice(2, 4), 16);
        const b = parseInt(v.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    const drawSignalOnLinkFixed = (x1, y1, x2, y2, progress, color, width) => {
        const trail = 0.2;
        const t0 = Math.max(0, progress - trail);
        const t1 = Math.min(1, progress + 0.03);
        const sx = x1 + (x2 - x1) * t0;
        const sy = y1 + (y2 - y1) * t0;
        const ex = x1 + (x2 - x1) * t1;
        const ey = y1 + (y2 - y1) * t1;
        const hx = x1 + (x2 - x1) * progress;
        const hy = y1 + (y2 - y1) * progress;

        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = color;
        ctx.lineCap = "round";
        ctx.strokeStyle = hexToRgba(color, 0.15);
        ctx.lineWidth = width + 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const grad = ctx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, hexToRgba(color, 0));
        grad.addColorStop(0.5, hexToRgba(color, 0.85));
        grad.addColorStop(1, hexToRgba(color, 1));
        ctx.strokeStyle = grad;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.fillStyle = hexToRgba(color, 0.95);
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(hx, hy, width * 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(hx, hy, width * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    const draw = (time, dt) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        if (!hero) {
            const bg = ctx.createLinearGradient(0, 0, w, h);
            bg.addColorStop(0, "rgba(6, 12, 28, 0.95)");
            bg.addColorStop(1, "rgba(10, 18, 40, 0.95)");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);
        }

        const timeSec = time * 0.001;

        links.forEach((link) => {
            const a = neurons[link.from];
            const b = neurons[link.to];
            drawLink(a.x, a.y, b.x, b.y, hero ? 0.12 : 0.18, 0.8);
        });

        ctx.globalCompositeOperation = "lighter";

        signals.forEach((sig) => {
            const link = links[sig.linkIdx];
            const a = neurons[link.from];
            const b = neurons[link.to];
            drawSignalOnLinkFixed(a.x, a.y, b.x, b.y, sig.progress, sig.color, sig.width);
            a.glow = Math.min(1, a.glow + 0.08);
            b.glow = Math.min(1, b.glow + 0.04);
        });

        neurons.forEach((node) => {
            node.glow *= 0.96;
            const pulse = 0.35 + 0.25 * Math.sin(timeSec * 2 + node.layer + node.index);
            const r = node.radius + node.glow * 3;
            const layerHue = node.layer / Math.max(1, layers.length - 1);

            ctx.shadowBlur = 10 + node.glow * 12;
            ctx.shadowColor = layerHue < 0.5 ? "#4fc3f7" : "#b388ff";
            ctx.fillStyle = `rgba(180, 220, 255, ${0.35 + pulse * 0.35 + node.glow * 0.4})`;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fill();

            if (node.glow > 0.4) {
                const glowColor = SIGNAL_COLORS[(node.layer + node.index) % SIGNAL_COLORS.length];
                ctx.fillStyle = hexToRgba(glowColor, 0.55);
                ctx.beginPath();
                ctx.arc(node.x, node.y, r * 0.45, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.globalCompositeOperation = "source-over";
        ctx.shadowBlur = 0;
    };

    const update = (time, dt) => {
        if (time - lastSpawn > (hero ? 280 : 180)) {
            lastSpawn = time;
            const layer = Math.floor((time / 400) % (layers.length - 1));
            spawnWaveFromLayer(layer);
            if (layer === 0 && !hero) {
                pulsePixelGrid();
            }
        }

        const completed = [];
        signals.forEach((sig, idx) => {
            sig.progress += sig.speed * dt * 0.001;
            if (sig.progress >= 1) {
                completed.push(idx);
                const link = links[sig.linkIdx];
                const nextLinks = links
                    .map((l, i) => ({ l, i }))
                    .filter(({ l }) => l.from === link.to);
                if (nextLinks.length && Math.random() < 0.35 * signalDensity) {
                    const next = nextLinks[Math.floor(Math.random() * nextLinks.length)];
                    spawnSignal(next.i, 0);
                }
                if (!hero && link.layer === layers.length - 2 && onInference) {
                    if (time - lastInference > 2200) {
                        lastInference = time;
                        onInference();
                    }
                }
            }
        });
        completed.sort((a, b) => b - a).forEach((i) => signals.splice(i, 1));

        if (signals.length > (hero ? 80 : 120)) {
            signals.splice(0, signals.length - (hero ? 80 : 120));
        }

        draw(time, dt);
    };

    let lastTime = 0;
    const tick = (time) => {
        if (!running) {
            return;
        }
        const dt = time - lastTime;
        lastTime = time;
        update(time, dt);
        rafId = requestAnimationFrame(tick);
    };

    const start = () => {
        running = true;
        lastTime = performance.now();
        lastSpawn = lastTime - 200;
        rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
        running = false;
        cancelAnimationFrame(rafId);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    if (prefersReducedMotion) {
        spawnWaveFromLayer(0);
        spawnWaveFromLayer(1);
        signals.forEach((s) => { s.progress = 0.5; });
        draw(0, 0);
        if (!hero) {
            updateOutputBars([0.12, 0.78, 0.1], "犬");
        }
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    start();
                } else {
                    stop();
                }
            });
        }, { threshold: 0.08 });
        observer.observe(canvas);
        if (canvas.getBoundingClientRect().top < window.innerHeight) {
            start();
        }
    }
}
