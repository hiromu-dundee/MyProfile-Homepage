document.addEventListener("DOMContentLoaded", () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rand = (min, max) => min + Math.random() * (max - min);

    const setupCanvas = (canvas) => {
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) {
            return null;
        }

        let w = 0;
        let h = 0;
        let dpr = 1;
        let running = false;
        let rafId = 0;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            w = Math.max(1, rect.width);
            h = Math.max(1, rect.height);
            dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
        };

        const start = (drawFn) => {
            resize();

            if (prefersReducedMotion) {
                drawFn(0, true);
                return;
            }

            let lastTime = 0;
            const tick = (time) => {
                if (!running) {
                    return;
                }
                const dt = time - lastTime;
                lastTime = time;
                drawFn(time, false, dt);
                rafId = requestAnimationFrame(tick);
            };

            running = true;
            rafId = requestAnimationFrame((time) => {
                lastTime = time;
                tick(time);
            });
        };

        const stop = () => {
            running = false;
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
        };

        const observeVisibility = () => {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (!running && !prefersReducedMotion) {
                            start(drawFnRef.current);
                        }
                    } else {
                        stop();
                    }
                });
            }, { threshold: 0.05 });

            observer.observe(canvas);
        };

        const drawFnRef = { current: null };
        let onResizeExtra = null;

        const init = (drawFn, options = {}) => {
            drawFnRef.current = (time, isStatic, dt) => {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                drawFn(ctx, w, h, time, isStatic, dt);
            };

            const handleResize = () => {
                resize();
                if (onResizeExtra) {
                    onResizeExtra(w, h);
                }
            };

            resize();
            window.addEventListener("resize", handleResize, { passive: true });

            if (prefersReducedMotion) {
                drawFnRef.current(0, true, 0);
            } else if (options.alwaysRun) {
                start(drawFnRef.current);
            } else {
                observeVisibility();
            }

            return {
                setOnResize(fn) {
                    onResizeExtra = fn;
                }
            };
        };

        return { init };
    };

    const initHeroAurora = (canvas) => {
        const api = setupCanvas(canvas);
        if (!api) {
            return;
        }

        const particles = Array.from({ length: 48 }, () => ({
            x: Math.random(),
            y: Math.random(),
            r: rand(1.2, 3.2),
            speed: rand(0.04, 0.12),
            phase: rand(0, Math.PI * 2)
        }));

        api.init((ctx, w, h, time) => {
            ctx.clearRect(0, 0, w, h);

            const t = time * 0.001;
            const gradient = ctx.createLinearGradient(0, 0, w, h);
            gradient.addColorStop(0, "#0b1430");
            gradient.addColorStop(0.45, "#162454");
            gradient.addColorStop(1, "#0f1a38");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);

            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < 3; i += 1) {
                const cx = w * (0.2 + i * 0.3) + Math.sin(t * 0.35 + i) * 40;
                const cy = h * (0.35 + i * 0.12) + Math.cos(t * 0.28 + i) * 30;
                const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.35);
                glow.addColorStop(0, `rgba(${80 + i * 40}, ${120 + i * 20}, 255, 0.18)`);
                glow.addColorStop(1, "rgba(0, 0, 0, 0)");
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, w, h);
            }

            particles.forEach((particle) => {
                const px = particle.x * w + Math.sin(t * particle.speed + particle.phase) * 18;
                const py = particle.y * h + Math.cos(t * particle.speed * 0.9 + particle.phase) * 14;
                ctx.fillStyle = "rgba(180, 210, 255, 0.55)";
                ctx.beginPath();
                ctx.arc(px, py, particle.r, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.globalCompositeOperation = "source-over";
        }, { alwaysRun: true });
    };

    const initNeuralNetwork = (canvas) => {
        const api = setupCanvas(canvas);
        if (!api) {
            return;
        }

        let nodes = [];
        let links = [];

        const build = (w, h) => {
            nodes = [];
            links = [];
            const cols = Math.max(4, Math.floor(w / 90));
            const rows = Math.max(3, Math.floor(h / 80));
            const marginX = w * 0.08;
            const marginY = h * 0.12;
            const spanX = w - marginX * 2;
            const spanY = h - marginY * 2;

            for (let r = 0; r < rows; r += 1) {
                for (let c = 0; c < cols; c += 1) {
                    const x = marginX + (c * spanX) / Math.max(1, cols - 1);
                    const y = marginY + (r * spanY) / Math.max(1, rows - 1);
                    nodes.push({
                        baseX: x,
                        baseY: y,
                        amp: rand(2, 5),
                        speed: rand(0.6, 1.1),
                        phase: rand(0, Math.PI * 2),
                        x,
                        y
                    });
                }
            }

            const linkDist = Math.min(160, Math.max(90, Math.min(w, h) * 0.28));
            for (let i = 0; i < nodes.length; i += 1) {
                for (let j = i + 1; j < nodes.length; j += 1) {
                    const dist = Math.hypot(nodes[i].baseX - nodes[j].baseX, nodes[i].baseY - nodes[j].baseY);
                    if (dist <= linkDist) {
                        links.push({ a: i, b: j, phase: rand(0, Math.PI * 2) });
                    }
                }
            }
        };

        const controller = api.init((ctx, w, h, time) => {
            if (!nodes.length) {
                build(w, h);
            }

            ctx.clearRect(0, 0, w, h);
            const t = time * 0.001;

            nodes.forEach((node) => {
                node.x = node.baseX + Math.sin(t * node.speed + node.phase) * node.amp;
                node.y = node.baseY + Math.cos(t * node.speed + node.phase) * node.amp;
            });

            ctx.globalCompositeOperation = "lighter";
            links.forEach((link) => {
                const a = nodes[link.a];
                const b = nodes[link.b];
                const activity = 0.4 + 0.6 * Math.sin(t * 1.4 + link.phase);
                ctx.strokeStyle = `rgba(80, 190, 255, ${0.22 * activity})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });

            nodes.forEach((node) => {
                const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + node.phase);
                ctx.fillStyle = `rgba(200, 235, 255, ${0.35 + pulse * 0.35})`;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 1.2 + pulse, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalCompositeOperation = "source-over";
        });

        controller.setOnResize(() => {
            nodes = [];
            links = [];
        });
    };

    const initWireframe = (canvas) => {
        const api = setupCanvas(canvas);
        if (!api) {
            return;
        }

        const rotateY = (x, y, z, a) => {
            const c = Math.cos(a);
            const s = Math.sin(a);
            return [x * c - z * s, y, x * s + z * c];
        };

        const rotateX = (x, y, z, a) => {
            const c = Math.cos(a);
            const s = Math.sin(a);
            return [x, y * c - z * s, y * s + z * c];
        };

        const project = (point, w, h, angleX, angleY, cx, cy, size) => {
            let [x, y, z] = point;
            [x, y, z] = rotateY(x, y, z, angleY);
            [x, y, z] = rotateX(x, y, z, angleX);

            const base = Math.min(w, h) * 0.11 * size;
            const depth = 4.5 + z * 0.35;
            return {
                x: cx + x * (base * 2.2) / depth,
                y: cy + y * (base * 2.2) / depth,
                z
            };
        };

        const shapeDefs = {
            cube: {
                vertices: [
                    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
                ],
                edges: [
                    [0, 1], [1, 2], [2, 3], [3, 0],
                    [4, 5], [5, 6], [6, 7], [7, 4],
                    [0, 4], [1, 5], [2, 6], [3, 7]
                ]
            },
            pyramid: {
                vertices: [
                    [-1.1, -0.9, -1.1], [1.1, -0.9, -1.1], [1.1, -0.9, 1.1], [-1.1, -0.9, 1.1],
                    [0, 1.3, 0]
                ],
                edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]]
            },
            octahedron: {
                vertices: [
                    [0, 1.4, 0], [0, -1.4, 0],
                    [1.4, 0, 0], [-1.4, 0, 0],
                    [0, 0, 1.4], [0, 0, -1.4]
                ],
                edges: [
                    [0, 2], [0, 3], [0, 4], [0, 5],
                    [1, 2], [1, 3], [1, 4], [1, 5],
                    [2, 4], [4, 3], [3, 5], [5, 2]
                ]
            },
            tetrahedron: {
                vertices: [
                    [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]
                ],
                edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]
            },
            diamond: {
                vertices: [
                    [0, 1.5, 0], [0, -1.5, 0],
                    [1, 0, 0], [-1, 0, 0],
                    [0, 0, 1], [0, 0, -1],
                    [0.9, 0.9, 0], [-0.9, 0.9, 0], [0.9, -0.9, 0], [-0.9, -0.9, 0]
                ],
                edges: [
                    [0, 2], [0, 3], [0, 4], [0, 5],
                    [1, 2], [1, 3], [1, 4], [1, 5],
                    [2, 4], [4, 3], [3, 5], [5, 2],
                    [0, 6], [0, 7], [1, 8], [1, 9]
                ]
            }
        };

        const buildCylinder = (segments = 14) => {
            const vertices = [];
            const edges = [];
            const top = [];
            const bottom = [];
            for (let i = 0; i < segments; i += 1) {
                const a = (i / segments) * Math.PI * 2;
                const x = Math.cos(a) * 1.1;
                const z = Math.sin(a) * 1.1;
                top.push([x, 1, z]);
                bottom.push([x, -1, z]);
            }
            vertices.push(...top, ...bottom);
            for (let i = 0; i < segments; i += 1) {
                const next = (i + 1) % segments;
                edges.push([i, next], [i + segments, next + segments], [i, i + segments]);
            }
            return { vertices, edges };
        };

        const buildSphere = (rings = 8, segments = 12) => {
            const vertices = [];
            const edges = [];
            for (let r = 0; r <= rings; r += 1) {
                const phi = (r / rings) * Math.PI;
                const row = [];
                for (let s = 0; s < segments; s += 1) {
                    const theta = (s / segments) * Math.PI * 2;
                    row.push([
                        Math.sin(phi) * Math.cos(theta) * 1.15,
                        Math.cos(phi) * 1.15,
                        Math.sin(phi) * Math.sin(theta) * 1.15
                    ]);
                }
                const base = vertices.length;
                vertices.push(...row);
                if (r > 0) {
                    for (let s = 0; s < segments; s += 1) {
                        const next = (s + 1) % segments;
                        const i0 = base - segments + s;
                        const i1 = base - segments + next;
                        const i2 = base + s;
                        const i3 = base + next;
                        edges.push([i0, i2], [i1, i3]);
                    }
                }
                for (let s = 0; s < segments; s += 1) {
                    const next = (s + 1) % segments;
                    edges.push([base + s, base + next]);
                }
            }
            return { vertices, edges };
        };

        const buildTorus = (major = 16, minor = 10) => {
            const vertices = [];
            const edges = [];
            const R = 1.35;
            const r = 0.45;
            for (let i = 0; i < major; i += 1) {
                const u = (i / major) * Math.PI * 2;
                for (let j = 0; j < minor; j += 1) {
                    const v = (j / minor) * Math.PI * 2;
                    vertices.push([
                        (R + r * Math.cos(v)) * Math.cos(u),
                        r * Math.sin(v),
                        (R + r * Math.cos(v)) * Math.sin(u)
                    ]);
                }
            }
            for (let i = 0; i < major; i += 1) {
                for (let j = 0; j < minor; j += 1) {
                    const curr = i * minor + j;
                    const nextU = ((i + 1) % major) * minor + j;
                    const nextV = i * minor + ((j + 1) % minor);
                    edges.push([curr, nextU], [curr, nextV]);
                }
            }
            return { vertices, edges };
        };

        shapeDefs.cylinder = buildCylinder();
        shapeDefs.sphere = buildSphere();
        shapeDefs.torus = buildTorus();

        const instances = [
            { type: "cube", nx: 0.5, ny: 0.52, size: 1.55, rx: 0.65, ry: 0.5, color: "rgba(255, 170, 90, 0.82)", width: 1.5 },
            { type: "pyramid", nx: 0.18, ny: 0.28, size: 1.35, rx: 0.45, ry: 0.85, color: "rgba(255, 130, 200, 0.7)", width: 1.3 },
            { type: "octahedron", nx: 0.78, ny: 0.72, size: 1.25, rx: 0.9, ry: 0.4, color: "rgba(120, 220, 255, 0.75)", width: 1.25 },
            { type: "tetrahedron", nx: 0.22, ny: 0.78, size: 1.15, rx: 0.55, ry: 0.7, color: "rgba(180, 255, 140, 0.68)", width: 1.2 },
            { type: "sphere", nx: 0.82, ny: 0.32, size: 1.2, rx: 0.35, ry: 0.6, color: "rgba(140, 190, 255, 0.65)", width: 1.15 },
            { type: "torus", nx: 0.68, ny: 0.5, size: 1.1, rx: 0.75, ry: 0.95, color: "rgba(255, 210, 120, 0.62)", width: 1.1 },
            { type: "cylinder", nx: 0.35, ny: 0.62, size: 1.05, rx: 0.5, ry: 0.35, color: "rgba(100, 240, 220, 0.6)", width: 1.1 },
            { type: "diamond", nx: 0.58, ny: 0.22, size: 1.0, rx: 0.8, ry: 0.55, color: "rgba(200, 160, 255, 0.68)", width: 1.15 }
        ];

        const drawShape = (ctx, w, h, def, inst, t) => {
            const cx = w * inst.nx;
            const cy = h * inst.ny;
            const angleX = t * inst.rx + inst.nx * 2;
            const angleY = t * inst.ry + inst.ny * 2;

            const projected = def.vertices.map((v) => project(v, w, h, angleX, angleY, cx, cy, inst.size));

            ctx.strokeStyle = inst.color;
            ctx.lineWidth = inst.width;
            def.edges.forEach(([a, b]) => {
                const p1 = projected[a];
                const p2 = projected[b];
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            });
        };

        api.init((ctx, w, h, time) => {
            ctx.clearRect(0, 0, w, h);
            const t = time * 0.001;

            ctx.strokeStyle = "rgba(120, 200, 255, 0.14)";
            ctx.lineWidth = 1;
            for (let i = 0; i < 5; i += 1) {
                const y = h * (0.12 + i * 0.18);
                ctx.beginPath();
                ctx.moveTo(0, y + Math.sin(t * 0.6 + i) * 3);
                ctx.lineTo(w, y + Math.cos(t * 0.5 + i) * 3);
                ctx.stroke();
            }

            instances
                .slice()
                .sort((a, b) => a.ny - b.ny)
                .forEach((inst) => {
                    const def = shapeDefs[inst.type];
                    if (def) {
                        drawShape(ctx, w, h, def, inst, t);
                    }
                });
        });
    };

    const initCodeFlow = (canvas) => {
        const api = setupCanvas(canvas);
        if (!api) {
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
            cursor: "#58a6ff"
        };

        const codeLines = [
            [{ t: "// model training loop", c: colors.comment }],
            [{ t: "import", c: colors.keyword }, { t: " torch", c: colors.text }],
            [{ t: "import", c: colors.keyword }, { t: " numpy", c: colors.keyword }, { t: " as np", c: colors.text }],
            [],
            [{ t: "def", c: colors.keyword }, { t: " train", c: colors.fn }, { t: "(model, loader):", c: colors.text }],
            [{ t: "    model", c: colors.text }, { t: ".train", c: colors.fn }, { t: "()", c: colors.bracket }],
            [{ t: "    for", c: colors.keyword }, { t: " epoch", c: colors.text }, { t: " in", c: colors.keyword }, { t: " range", c: colors.fn }, { t: "(", c: colors.bracket }, { t: "10", c: colors.number }, { t: "):", c: colors.bracket }],
            [{ t: "        loss = ", c: colors.text }, { t: "0.0", c: colors.number }],
            [{ t: "        for", c: colors.keyword }, { t: " x, y", c: colors.text }, { t: " in", c: colors.keyword }, { t: " loader:", c: colors.text }],
            [{ t: "            pred = model(x)", c: colors.text }],
            [{ t: "            loss += criterion(pred, y)", c: colors.text }],
            [{ t: "        print", c: colors.fn }, { t: "(", c: colors.bracket }, { t: "f\"epoch={epoch} loss={loss:.4f}\"", c: colors.string }, { t: ")", c: colors.bracket }],
            [{ t: "    return", c: colors.keyword }, { t: " loss", c: colors.text }],
            [],
            [{ t: "class", c: colors.keyword }, { t: " Net", c: colors.type }, { t: "(nn.Module):", c: colors.text }],
            [{ t: "    def", c: colors.keyword }, { t: " __init__", c: colors.fn }, { t: "(self):", c: colors.text }],
            [{ t: "        super", c: colors.text }, { t: "().__init__", c: colors.bracket }],
            [{ t: "        self.fc = nn.Linear(", c: colors.text }, { t: "128", c: colors.number }, { t: ", ", c: colors.text }, { t: "10", c: colors.number }, { t: ")", c: colors.text }],
            [],
            [{ t: "const", c: colors.keyword }, { t: " buildApp", c: colors.fn }, { t: " = () => {", c: colors.text }],
            [{ t: "  const [count, setCount] = useState(", c: colors.text }, { t: "0", c: colors.number }, { t: ");", c: colors.text }],
            [{ t: "  return <App title=", c: colors.text }, { t: "\"Portfolio\"", c: colors.string }, { t: " />;", c: colors.text }],
            [{ t: "};", c: colors.bracket }],
            [],
            [{ t: "#include ", c: colors.keyword }, { t: "<iostream>", c: colors.string }],
            [{ t: "int", c: colors.keyword }, { t: " main", c: colors.fn }, { t: "() {", c: colors.text }],
            [{ t: "    std::cout << ", c: colors.text }, { t: "\"Hello, World!\"", c: colors.string }, { t: " << std::endl;", c: colors.text }],
            [{ t: "    return ", c: colors.text }, { t: "0", c: colors.number }, { t: ";", c: colors.text }],
            [{ t: "}", c: colors.bracket }]
        ];

        let scrollY = 0;
        let fontSize = 11;
        let lineHeight = 16;
        let padX = 12;
        let gutterW = 28;

        const measureLayout = (w, h) => {
            fontSize = Math.max(9, Math.min(12, Math.floor(w / 42)));
            lineHeight = fontSize + 5;
            padX = Math.max(10, w * 0.04);
            gutterW = fontSize + 18;
        };

        const drawTokens = (ctx, tokens, x, y) => {
            let cursorX = x;
            ctx.font = `${fontSize}px "Consolas", "Courier New", monospace`;
            tokens.forEach((token) => {
                ctx.fillStyle = token.c;
                ctx.fillText(token.t, cursorX, y);
                cursorX += ctx.measureText(token.t).width;
            });
            return cursorX;
        };

        api.init((ctx, w, h, time, isStatic, dt) => {
            measureLayout(w, h);

            const step = isStatic ? 0 : (dt || 16) * 0.06;
            scrollY += step;

            const totalHeight = codeLines.length * lineHeight + h * 0.5;
            if (scrollY > totalHeight) {
                scrollY = 0;
            }

            ctx.fillStyle = colors.bg;
            ctx.fillRect(0, 0, w, h);

            const panelX = padX;
            const panelY = padX;
            const panelW = w - padX * 2;
            const panelH = h - padX * 2;
            const radius = 8;

            ctx.fillStyle = colors.gutter;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(panelX, panelY, panelW, panelH, radius);
            } else {
                ctx.rect(panelX, panelY, panelW, panelH);
            }
            ctx.fill();

            ctx.fillStyle = "#21262d";
            ctx.fillRect(panelX, panelY, panelW, 22);

            ["#ff5f57", "#febc2e", "#28c840"].forEach((dotColor, i) => {
                ctx.fillStyle = dotColor;
                ctx.beginPath();
                ctx.arc(panelX + 14 + i * 14, panelY + 11, 4, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.fillStyle = "#8b949e";
            ctx.font = `600 ${Math.max(9, fontSize - 1)}px sans-serif`;
            ctx.fillText("main.py  ·  app.tsx  ·  main.cpp", panelX + 52, panelY + 15);

            const codeTop = panelY + 28;
            const codeLeft = panelX + gutterW + 6;
            const codeRight = panelX + panelW - 8;

            ctx.save();
            ctx.beginPath();
            ctx.rect(panelX + 1, codeTop, panelW - 2, panelH - 30);
            ctx.clip();

            ctx.fillStyle = "rgba(22, 27, 34, 0.95)";
            ctx.fillRect(panelX, codeTop, gutterW, panelH - 30);

            const t = time * 0.001;
            const activeLine = Math.floor((scrollY / lineHeight + codeLines.length * 0.35)) % Math.max(1, codeLines.length);

            codeLines.forEach((tokens, index) => {
                const y = codeTop + index * lineHeight - scrollY + lineHeight;
                if (y < codeTop - lineHeight || y > panelY + panelH) {
                    return;
                }

                ctx.fillStyle = colors.lineNum;
                ctx.font = `${fontSize}px "Consolas", "Courier New", monospace`;
                const lineLabel = String(index + 1).padStart(2, " ");
                ctx.fillText(lineLabel, panelX + 8, y);

                if (tokens.length) {
                    const endX = drawTokens(ctx, tokens, codeLeft, y);

                    if (index === activeLine && !isStatic) {
                        const blink = Math.sin(t * 5) > 0;
                        if (blink) {
                            ctx.fillStyle = colors.cursor;
                            ctx.fillRect(endX + 2, y - fontSize + 2, 2, fontSize);
                        }
                    }
                }
            });

            const scanY = codeTop + ((scrollY * 0.4) % (panelH - 40));
            const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
            scanGrad.addColorStop(0, "rgba(88, 166, 255, 0)");
            scanGrad.addColorStop(0.5, "rgba(88, 166, 255, 0.06)");
            scanGrad.addColorStop(1, "rgba(88, 166, 255, 0)");
            ctx.fillStyle = scanGrad;
            ctx.fillRect(panelX, scanY - 30, panelW, 60);

            ctx.restore();

            ctx.strokeStyle = "rgba(48, 54, 61, 0.9)";
            ctx.lineWidth = 1;
            ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
        });
    };

    const initTimelineWave = (canvas) => {
        const api = setupCanvas(canvas);
        if (!api) {
            return;
        }

        api.init((ctx, w, h, time) => {
            ctx.clearRect(0, 0, w, h);
            const t = time * 0.001;

            for (let i = 0; i < 5; i += 1) {
                const y = h * (0.25 + i * 0.12);
                ctx.strokeStyle = `rgba(255, 120, 180, ${0.25 + i * 0.08})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let x = 0; x <= w; x += 6) {
                    const wave = Math.sin(x * 0.02 + t * 2 + i) * 10;
                    if (x === 0) {
                        ctx.moveTo(x, y + wave);
                    } else {
                        ctx.lineTo(x, y + wave);
                    }
                }
                ctx.stroke();
            }

            const playhead = (t * 80) % w;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playhead, h * 0.15);
            ctx.lineTo(playhead, h * 0.85);
            ctx.stroke();

            for (let i = 0; i < 8; i += 1) {
                const bx = (i / 8) * w + 8;
                const bw = w / 10;
                ctx.fillStyle = `rgba(120, 180, 255, ${0.18 + (i % 2) * 0.08})`;
                ctx.fillRect(bx, h * 0.78, bw, 10);
            }
        });
    };

    const initLifePath = (canvas) => {
        const api = setupCanvas(canvas);
        if (!api) {
            return;
        }

        let points = [];

        const build = () => {
            const count = 7;
            points = Array.from({ length: count }, (_, i) => ({
                x: 0.12 + (i / (count - 1)) * 0.76,
                y: 0.55 + Math.sin(i * 0.9) * 0.12,
                phase: rand(0, Math.PI * 2)
            }));
        };

        build();

        api.init((ctx, w, h, time) => {
            ctx.clearRect(0, 0, w, h);
            const t = time * 0.001;

            ctx.strokeStyle = "rgba(180, 210, 255, 0.35)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            points.forEach((point, index) => {
                const px = point.x * w;
                const py = point.y * h + Math.sin(t + point.phase) * 6;
                if (index === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            });
            ctx.stroke();

            points.forEach((point, index) => {
                const px = point.x * w;
                const py = point.y * h + Math.sin(t + point.phase) * 6;
                ctx.fillStyle = index === points.length - 1 ? "rgba(255, 210, 120, 0.9)" : "rgba(120, 190, 255, 0.85)";
                ctx.beginPath();
                ctx.arc(px, py, index === points.length - 1 ? 5 : 4, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    };

    const effectMap = {
        "hero-aurora": initHeroAurora,
        "neural-network": initNeuralNetwork,
        wireframe: initWireframe,
        "code-flow": initCodeFlow,
        "timeline-wave": initTimelineWave,
        "life-path": initLifePath
    };

    const heroCanvas = document.querySelector(".hero-effect-canvas");
    if (heroCanvas) {
        initHeroAurora(heroCanvas);
    }

    document.querySelectorAll(".visual-effect-canvas").forEach((canvas) => {
        const effect = canvas.dataset.effect;
        const initFn = effectMap[effect];
        if (initFn) {
            initFn(canvas);
        }
    });
});
