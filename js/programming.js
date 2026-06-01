const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", () => {
    initHeroCanvas();
    initTerminal();
    initEditorGlow();
});

function initHeroCanvas() {
    const canvas = document.querySelector(".prog-hero-canvas");
    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
        return;
    }

    const colors = {
        bg: "#0d1117",
        gutter: "#161b22",
        lineNum: "#484f58",
        text: "#c9d1d9",
        keyword: "#ff7b72",
        type: "#79c0ff",
        fn: "#d2a8ff",
        string: "#a5d6ff",
        comment: "#8b949e",
        number: "#79c0ff",
        bracket: "#ffa657",
        cursor: "#58a6ff",
        particle: "rgba(63, 185, 80, 0.35)"
    };

    const codeLines = [
        [{ t: "// portfolio & research", c: colors.comment }],
        [{ t: "git clone ", c: colors.text }, { t: "portfolio-repo", c: colors.string }],
        [{ t: "cd ", c: colors.text }, { t: "src && npm install", c: colors.string }],
        [],
        [{ t: "function", c: colors.keyword }, { t: " render", c: colors.fn }, { t: "(canvas) {", c: colors.text }],
        [{ t: "  const ctx = canvas.getContext(", c: colors.text }, { t: "'2d'", c: colors.string }, { t: ");", c: colors.text }],
        [{ t: "  requestAnimationFrame(loop);", c: colors.text }],
        [{ t: "}", c: colors.bracket }],
        [],
        [{ t: "class", c: colors.keyword }, { t: " Experiment", c: colors.type }, { t: ":", c: colors.text }],
        [{ t: "    def run(self, epochs=", c: colors.text }, { t: "10", c: colors.number }, { t: "):", c: colors.text }],
        [{ t: "        for e in range(epochs):", c: colors.text }],
        [{ t: "            loss = self.train_step()", c: colors.text }],
        [{ t: "            print(f\"epoch={e} loss={loss:.4f}\")", c: colors.string }],
        [],
        [{ t: "#include ", c: colors.keyword }, { t: "<vector>", c: colors.string }],
        [{ t: "int main() { return 0; }", c: colors.text }]
    ];

    let w = 0;
    let h = 0;
    let dpr = 1;
    let scrollY = 0;
    let fontSize = 11;
    let lineHeight = 16;
    let particles = [];
    let rafId = 0;

    const rand = (min, max) => min + Math.random() * (max - min);

    const buildParticles = () => {
        const symbols = ["{", "}", "(", ")", ";", "=>", "&&", "||", "0", "1", "fn", "if"];
        particles = Array.from({ length: 24 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            text: symbols[Math.floor(Math.random() * symbols.length)],
            speed: rand(12, 36),
            size: rand(10, 14),
            alpha: rand(0.08, 0.22)
        }));
    };

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        w = Math.max(1, rect.width);
        h = Math.max(1, rect.height);
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        fontSize = Math.max(10, Math.min(13, Math.floor(w / 55)));
        lineHeight = fontSize + 5;
        buildParticles();
    };

    const drawTokens = (tokens, x, y) => {
        let cursorX = x;
        ctx.font = `${fontSize}px "Consolas", "Courier New", monospace`;
        tokens.forEach((token) => {
            ctx.fillStyle = token.c;
            ctx.fillText(token.t, cursorX, y);
            cursorX += ctx.measureText(token.t).width;
        });
        return cursorX;
    };

    const draw = (time, dt) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, w, h);

        const t = time * 0.001;

        particles.forEach((p) => {
            p.y -= p.speed * dt * 0.001;
            if (p.y < -20) {
                p.y = h + 10;
                p.x = Math.random() * w;
            }
            ctx.fillStyle = `rgba(63, 185, 80, ${p.alpha})`;
            ctx.font = `${p.size}px monospace`;
            ctx.fillText(p.text, p.x, p.y);
        });

        const pad = Math.max(12, w * 0.06);
        const panelW = Math.min(520, w - pad * 2);
        const panelH = h - pad * 2;
        const panelX = w - panelW - pad;
        const panelY = pad;

        ctx.fillStyle = colors.gutter;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(panelX, panelY, panelW, panelH, 10);
        } else {
            ctx.rect(panelX, panelY, panelW, panelH);
        }
        ctx.fill();

        ctx.fillStyle = "#21262d";
        ctx.fillRect(panelX, panelY, panelW, 24);
        ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(panelX + 14 + i * 14, panelY + 12, 4.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = "#8b949e";
        ctx.font = "600 11px sans-serif";
        ctx.fillText("workspace/", panelX + 58, panelY + 16);

        const codeTop = panelY + 30;
        const gutterW = 32;
        const codeLeft = panelX + gutterW + 8;

        ctx.save();
        ctx.beginPath();
        ctx.rect(panelX + 1, codeTop, panelW - 2, panelH - 32);
        ctx.clip();

        ctx.fillStyle = "rgba(22, 27, 34, 0.98)";
        ctx.fillRect(panelX, codeTop, gutterW, panelH);

        scrollY += dt * 0.04;
        const total = codeLines.length * lineHeight + panelH;
        if (scrollY > total) {
            scrollY = 0;
        }

        const activeLine = Math.floor(scrollY / lineHeight) % Math.max(1, codeLines.length);

        codeLines.forEach((tokens, index) => {
            const y = codeTop + index * lineHeight - scrollY + lineHeight;
            if (y < codeTop - lineHeight || y > panelY + panelH) {
                return;
            }

            ctx.fillStyle = colors.lineNum;
            ctx.font = `${fontSize}px monospace`;
            ctx.fillText(String(index + 1).padStart(2, " "), panelX + 8, y);

            if (tokens.length) {
                const endX = drawTokens(tokens, codeLeft, y);
                if (index === activeLine && Math.sin(t * 5) > 0) {
                    ctx.fillStyle = colors.cursor;
                    ctx.fillRect(endX + 2, y - fontSize + 2, 2, fontSize);
                }
            }
        });

        ctx.restore();

        ctx.strokeStyle = "rgba(48, 54, 61, 0.9)";
        ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
    };

    let lastTime = 0;
    const tick = (time) => {
        const dt = time - lastTime;
        lastTime = time;
        draw(time, dt);
        rafId = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    if (prefersReducedMotion) {
        draw(0, 0);
    } else {
        requestAnimationFrame((time) => {
            lastTime = time;
            rafId = requestAnimationFrame(tick);
        });
    }
}

function initTerminal() {
    const terminal = document.querySelector("[data-prog-terminal]");
    if (!terminal) {
        return;
    }

    const output = terminal.querySelector(".prog-terminal-body code");
    if (!output) {
        return;
    }

    const lines = [
        { text: "$ python train.py --epochs 10", className: "prog-terminal-line--cmd" },
        { text: "[INFO] Loading dataset: cifar10", className: "prog-terminal-line--info" },
        { text: "[INFO] Model: ResNet18 | device: cuda", className: "prog-terminal-line--info" },
        { text: "epoch=01  loss=1.8421  acc=0.41", className: "prog-terminal-line--ok" },
        { text: "epoch=05  loss=0.9214  acc=0.68", className: "prog-terminal-line--ok" },
        { text: "epoch=10  loss=0.5102  acc=0.82", className: "prog-terminal-line--ok" },
        { text: "Done. checkpoint saved → ./checkpoints/best.pt", className: "prog-terminal-line--ok" },
        { text: "$ git status", className: "prog-terminal-line--cmd" },
        { text: "On branch main — working tree clean", className: "prog-terminal-line--info" }
    ];

    if (prefersReducedMotion) {
        output.innerHTML = lines
            .map((line) => `<span class="${line.className}">${line.text}</span>`)
            .join("\n");
        return;
    }

    let lineIndex = 0;
    let charIndex = 0;
    let html = "";

    const typeNext = () => {
        if (lineIndex >= lines.length) {
            return;
        }

        const line = lines[lineIndex];
        if (charIndex === 0) {
            html += `<span class="${line.className}">`;
        }

        if (charIndex < line.text.length) {
            html += escapeHtml(line.text[charIndex]);
            charIndex += 1;
            output.innerHTML = `${html}</span>`;
            setTimeout(typeNext, rand(18, 42));
            return;
        }

        html += "</span>\n";
        output.innerHTML = html;
        lineIndex += 1;
        charIndex = 0;
        setTimeout(typeNext, line.text.startsWith("$") ? 400 : 280);
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                observer.disconnect();
                setTimeout(typeNext, 300);
            }
        });
    }, { threshold: 0.3 });

    observer.observe(terminal);
}

function initEditorGlow() {
    const editor = document.querySelector("[data-prog-editor]");
    if (!editor || prefersReducedMotion) {
        return;
    }

    editor.classList.add("is-typing");

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                editor.classList.add("is-visible");
                observer.disconnect();
            }
        });
    }, { threshold: 0.2 });

    observer.observe(editor);
}

function escapeHtml(char) {
    if (char === "<") {
        return "&lt;";
    }
    if (char === ">") {
        return "&gt;";
    }
    if (char === "&") {
        return "&amp;";
    }
    return char;
}

function rand(min, max) {
    return min + Math.random() * (max - min);
}
