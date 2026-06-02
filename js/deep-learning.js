document.addEventListener("DOMContentLoaded", () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    initPixelGrid("dl-pixel-grid");
    initPixelGrid("dl-ensemble-pixel-grid", 6);
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
        } else if (mode === "ensemble") {
            initEnsembleCanvas(canvas, prefersReducedMotion);
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
    { id: "cat", name: "猫" },
    { id: "dog", name: "犬" },
    { id: "bird", name: "鳥" }
];

const ENSEMBLE_MODELS = [
    { id: "a", color: "#00e5ff", yRatio: 0.22, layers: [3, 4, 4, 2] },
    { id: "b", color: "#ff6bcb", yRatio: 0.5, layers: [3, 5, 4, 2] },
    { id: "c", color: "#ffe066", yRatio: 0.78, layers: [3, 4, 5, 2] }
];

let inferenceTick = 0;
let ensembleTick = 0;

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function pickColor() {
    return SIGNAL_COLORS[Math.floor(Math.random() * SIGNAL_COLORS.length)];
}

const PIXEL_PATTERN = [
    0, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 1, 1, 1, 1, 1, 0,
    1, 1, 0, 1, 1, 0, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 0, 1, 1, 1, 1, 0, 1,
    1, 1, 0, 0, 0, 0, 1, 1,
    0, 1, 1, 0, 0, 1, 1, 0,
    0, 0, 1, 1, 1, 1, 0, 0
];

function initPixelGrid(gridId, size = 8) {
    const grid = document.getElementById(gridId);
    if (!grid) {
        return;
    }

    let pattern = PIXEL_PATTERN;
    if (size === 6) {
        pattern = [];
        for (let r = 0; r < 6; r += 1) {
            for (let c = 0; c < 6; c += 1) {
                pattern.push(PIXEL_PATTERN[r * 8 + c]);
            }
        }
    }

    pattern.forEach((on) => {
        const cell = document.createElement("span");
        cell.className = `dl-pixel${on ? " is-active" : ""}`;
        grid.appendChild(cell);
    });
}

function initOutputPanel() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        updateOutputBars([0.15, 0.72, 0.13], "犬");
        updateOutputBars([0.18, 0.68, 0.14], "犬", {
            barsSelector: "#dl-ensemble-bars",
            labelSelector: "#dl-ensemble-predicted-label",
            labelPrefix: "統合予測"
        });
        document.querySelectorAll(".dl-model-val").forEach((el, m) => {
            el.textContent = CLASS_LABELS[m % 3].name;
        });
    }
}

function pulsePixelGrid(gridId) {
    const grid = document.getElementById(gridId || "dl-pixel-grid");
    if (!grid) {
        return;
    }
    const cells = grid.querySelectorAll(".dl-pixel");
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

function updateOutputBars(scores, winnerName, options = {}) {
    const barsRoot = document.querySelector(options.barsSelector || "#dl-class-bars");
    const labelEl = document.querySelector(options.labelSelector || "#dl-predicted-label");
    if (!barsRoot) {
        return;
    }

    const items = barsRoot.querySelectorAll("li");
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
        const prefix = options.labelPrefix || "予測";
        labelEl.textContent = `${prefix}: ${winnerName}（${(scores[maxIdx] * 100).toFixed(0)}%）`;
    }
}

function handleInferencePulse() {
    inferenceTick += 1;
    pulsePixelGrid("dl-pixel-grid");

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

function handleEnsemblePulse() {
    ensembleTick += 1;
    pulsePixelGrid("dl-ensemble-pixel-grid");

    const modelVotes = ENSEMBLE_MODELS.map((model, m) => {
        const idx = (ensembleTick + m) % 3;
        return idx;
    });

    const modelScoreEls = document.querySelectorAll(".dl-model-val");
    modelScoreEls.forEach((el, m) => {
        el.textContent = CLASS_LABELS[modelVotes[m]].name;
    });

    const fused = [0, 0, 0];
    modelVotes.forEach((idx) => {
        fused[idx] += 1;
    });
    ENSEMBLE_MODELS.forEach((_, m) => {
        const soft = modelVotes[m];
        fused[soft] += rand(0.15, 0.35);
        fused[(soft + 1) % 3] += rand(0.02, 0.08);
        fused[(soft + 2) % 3] += rand(0.02, 0.08);
    });
    const sum = fused.reduce((a, b) => a + b, 0);
    const normalized = fused.map((s) => s / sum);
    const winnerIdx = normalized.indexOf(Math.max(...normalized));

    updateOutputBars(normalized, CLASS_LABELS[winnerIdx].name, {
        barsSelector: "#dl-ensemble-bars",
        labelSelector: "#dl-ensemble-predicted-label",
        labelPrefix: "統合予測"
    });
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

function buildEnsembleNetwork(w, h) {
    const neurons = [];
    const links = [];
    const inputXs = w * 0.07;
    const hubX = w * 0.86;
    const hubY = h * 0.5;

    for (let i = 0; i < 3; i += 1) {
        neurons.push({
            x: inputXs,
            y: h * (0.28 + i * 0.22),
            radius: 4.5,
            glow: 0,
            role: "input",
            modelId: null
        });
    }

    const hubIdx = neurons.length;
    neurons.push({
        x: hubX,
        y: hubY,
        radius: 8,
        glow: 0,
        role: "hub",
        modelId: null
    });

    ENSEMBLE_MODELS.forEach((model, modelIndex) => {
        const bandH = h * 0.2;
        const cy = h * model.yRatio;
        const y0 = cy - bandH / 2;
        const layerXs = [0.2, 0.38, 0.56, 0.72].map((r) => w * r);
        let offset = neurons.length;

        model.layers.forEach((count, layer) => {
            for (let n = 0; n < count; n += 1) {
                neurons.push({
                    x: layerXs[layer],
                    y: y0 + ((n + 0.5) / count) * bandH,
                    radius: 3.8,
                    glow: 0,
                    role: "hidden",
                    modelId: modelIndex,
                    layer
                });
            }
        });

        const modelNeuronStart = offset;
        const layerCount = model.layers.length;

        for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < model.layers[0]; j += 1) {
                links.push({
                    from: i,
                    to: modelNeuronStart + j,
                    layer: -1,
                    modelId: modelIndex,
                    color: model.color
                });
            }
        }

        offset = modelNeuronStart;
        model.layers.forEach((count, layer) => {
            if (layer >= layerCount - 1) {
                return;
            }
            const nextCount = model.layers[layer + 1];
            const nextOffset = offset + count;
            for (let i = 0; i < count; i += 1) {
                for (let j = 0; j < nextCount; j += 1) {
                    links.push({
                        from: offset + i,
                        to: nextOffset + j,
                        layer,
                        modelId: modelIndex,
                        color: model.color
                    });
                }
            }
            offset = nextOffset;
        });

        const lastOffset = modelNeuronStart + model.layers.slice(0, -1).reduce((a, b) => a + b, 0);
        const lastCount = model.layers[layerCount - 1];
        for (let i = 0; i < lastCount; i += 1) {
            links.push({
                from: lastOffset + i,
                to: hubIdx,
                layer: layerCount - 1,
                modelId: modelIndex,
                color: model.color,
                toHub: true
            });
        }
    });

    return { neurons, links, hubIdx };
}

function initEnsembleCanvas(canvas, prefersReducedMotion) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
        return;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let neurons = [];
    let links = [];
    let hubIdx = 0;
    let signals = [];
    let lastSpawn = 0;
    let lastFusion = 0;
    let running = false;
    let rafId = 0;

    const hexToRgba = (hex, a) => {
        const v = hex.replace("#", "");
        return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${a})`;
    };

    const drawSignal = (x1, y1, x2, y2, progress, color, width) => {
        const trail = 0.22;
        const t0 = Math.max(0, progress - trail);
        const t1 = Math.min(1, progress + 0.03);
        const sx = x1 + (x2 - x1) * t0;
        const sy = y1 + (y2 - y1) * t0;
        const ex = x1 + (x2 - x1) * t1;
        const ey = y1 + (y2 - y1) * t1;
        const hx = x1 + (x2 - x1) * progress;
        const hy = y1 + (y2 - y1) * progress;

        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
        ctx.lineCap = "round";
        const grad = ctx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, hexToRgba(color, 0));
        grad.addColorStop(0.55, hexToRgba(color, 0.9));
        grad.addColorStop(1, hexToRgba(color, 1));
        ctx.strokeStyle = grad;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.fillStyle = hexToRgba(color, 0.95);
        ctx.beginPath();
        ctx.arc(hx, hy, width * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        w = Math.max(1, rect.width);
        h = Math.max(1, rect.height);
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        const built = buildEnsembleNetwork(w, h);
        neurons = built.neurons;
        links = built.links;
        hubIdx = built.hubIdx;
        signals = [];
    };

    const spawnSignal = (linkIdx, progress = 0, color) => {
        signals.push({
            linkIdx,
            progress,
            speed: rand(0.4, 0.7),
            color: color || links[linkIdx].color,
            width: rand(2, 3.2)
        });
    };

    const spawnInputWave = () => {
        const inputLinks = links
            .map((l, i) => ({ l, i }))
            .filter(({ l }) => l.layer === -1);
        const picks = Math.max(3, Math.floor(inputLinks.length * 0.12));
        for (let i = 0; i < picks; i += 1) {
            const pick = inputLinks[Math.floor(Math.random() * inputLinks.length)];
            if (pick) {
                spawnSignal(pick.i, rand(0, 0.1), pick.l.color);
            }
        }
    };

    const draw = (time) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, "rgba(12, 8, 28, 0.96)");
        bg.addColorStop(1, "rgba(8, 14, 32, 0.96)");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const timeSec = time * 0.001;

        links.forEach((link) => {
            const a = neurons[link.from];
            const b = neurons[link.to];
            ctx.strokeStyle = hexToRgba(link.color, link.toHub ? 0.14 : 0.1);
            ctx.lineWidth = link.toHub ? 1 : 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        });

        ctx.globalCompositeOperation = "lighter";
        signals.forEach((sig) => {
            const link = links[sig.linkIdx];
            const a = neurons[link.from];
            const b = neurons[link.to];
            drawSignal(a.x, a.y, b.x, b.y, sig.progress, sig.color, sig.width);
            a.glow = Math.min(1, a.glow + 0.1);
            b.glow = Math.min(1, b.glow + 0.06);
        });

        neurons.forEach((node, idx) => {
            node.glow *= 0.94;
            const pulse = 0.4 + 0.2 * Math.sin(timeSec * 2.2 + idx * 0.3);
            let r = node.radius + node.glow * 2.5;
            let fill = `rgba(200, 220, 255, ${0.4 + pulse * 0.3})`;
            let shadow = "#4fc3f7";

            if (node.role === "hub") {
                r = node.radius + 2 + node.glow * 4 + Math.sin(timeSec * 3) * 1.5;
                fill = `rgba(200, 180, 255, ${0.5 + node.glow * 0.5})`;
                shadow = "#b388ff";
            } else if (node.modelId !== null) {
                const model = ENSEMBLE_MODELS[node.modelId];
                shadow = model.color;
                if (node.glow > 0.3) {
                    fill = hexToRgba(model.color, 0.5 + node.glow * 0.4);
                }
            }

            ctx.shadowBlur = 8 + node.glow * 14;
            ctx.shadowColor = shadow;
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.font = "600 10px sans-serif";
        ctx.fillStyle = "rgba(140, 160, 200, 0.7)";
        ctx.fillText("統合", neurons[hubIdx].x - 14, neurons[hubIdx].y + 28);

        ctx.globalCompositeOperation = "source-over";
        ctx.shadowBlur = 0;
    };

    const update = (time, dt) => {
        if (time - lastSpawn > 160) {
            lastSpawn = time;
            spawnInputWave();
            pulsePixelGrid("dl-ensemble-pixel-grid");
        }

        const done = [];
        signals.forEach((sig, idx) => {
            sig.progress += sig.speed * dt * 0.001;
            if (sig.progress >= 1) {
                done.push(idx);
                const link = links[sig.linkIdx];
                if (link.toHub) {
                    neurons[hubIdx].glow = 1;
                    if (time - lastFusion > 2400) {
                        lastFusion = time;
                        handleEnsemblePulse();
                    }
                } else {
                    const next = links
                        .map((l, i) => ({ l, i }))
                        .filter(({ l }) => l.from === link.to && l.modelId === link.modelId);
                    if (next.length && Math.random() < 0.4) {
                        const pick = next[Math.floor(Math.random() * next.length)];
                        spawnSignal(pick.i, 0, link.color);
                    }
                }
            }
        });
        done.sort((a, b) => b - a).forEach((i) => signals.splice(i, 1));
        if (signals.length > 100) {
            signals.splice(0, signals.length - 100);
        }

        draw(time);
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
        lastSpawn = lastTime - 100;
        rafId = requestAnimationFrame(tick);
    };

    const stop = () => {
        running = false;
        cancelAnimationFrame(rafId);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    if (prefersReducedMotion) {
        spawnInputWave();
        signals.forEach((s) => { s.progress = 0.55; });
        draw(0);
        handleEnsemblePulse();
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
