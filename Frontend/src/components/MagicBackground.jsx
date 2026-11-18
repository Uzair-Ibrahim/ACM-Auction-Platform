import { useEffect, useRef } from 'react';

// --- Drawing helpers ---

function drawCandle(ctx, x, y, scale, flamePhase, alpha, t) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const BW = 5, BH = 22;

  // Candle body
  const bodyGrad = ctx.createLinearGradient(-BW / 2, 0, BW / 2, 0);
  bodyGrad.addColorStop(0, '#a07030');
  bodyGrad.addColorStop(0.45, '#f0cb7a');
  bodyGrad.addColorStop(1, '#a07030');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(-BW / 2, 0, BW, BH);

  // Wax top
  ctx.fillStyle = '#f0cb7a';
  ctx.beginPath();
  ctx.ellipse(0, 0, BW / 2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wick
  ctx.strokeStyle = '#2a1800';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -4);
  ctx.stroke();

  const flicker = Math.sin(flamePhase * 2.9 + t * 0.065) * 2.1;
  const FH = 10 + Math.abs(flicker);
  const FW = 4.2;

  // Flame halo (radial gradient — no shadowBlur for performance)
  const haloR = FH * 1.8;
  const halo = ctx.createRadialGradient(0, -4 - FH * 0.4, 0, 0, -4 - FH * 0.4, haloR);
  halo.addColorStop(0, 'rgba(255,190,50,0.38)');
  halo.addColorStop(0.5, 'rgba(255,130,10,0.14)');
  halo.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, -4 - FH * 0.4, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Flame body
  const flameGrad = ctx.createLinearGradient(0, -4, 0, -4 - FH);
  flameGrad.addColorStop(0, '#ff7000');
  flameGrad.addColorStop(0.35, '#ffcc44');
  flameGrad.addColorStop(0.75, '#fff6d0');
  flameGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.bezierCurveTo(-FW / 2, -4 - FH * 0.3, -FW / 3, -4 - FH * 0.68 + flicker * 0.5, 0, -4 - FH);
  ctx.bezierCurveTo(FW / 3, -4 - FH * 0.68 - flicker * 0.5, FW / 2, -4 - FH * 0.3, 0, -4);
  ctx.fill();

  ctx.restore();
}

function drawSparkle(ctx, x, y, r, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#f4d66d';
  ctx.translate(x, y);
  // 4-pointed star
  const inner = r * 0.28;
  const outer = r * 2.1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? outer : inner;
    if (i === 0) ctx.moveTo(Math.cos(angle) * rr, Math.sin(angle) * rr);
    else ctx.lineTo(Math.cos(angle) * rr, Math.sin(angle) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSnitch(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);

  const wingFlap = Math.sin(t * 0.13) * 0.4;

  // Halo
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  halo.addColorStop(0, 'rgba(255,215,0,0.5)');
  halo.addColorStop(0.4, 'rgba(255,200,50,0.16)');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();

  // Wings
  ctx.save();
  ctx.globalAlpha = 0.68;
  ctx.fillStyle = 'rgba(215,235,255,0.9)';
  const ws = 1 + wingFlap;
  // Left wing
  ctx.save();
  ctx.scale(1, ws);
  ctx.beginPath();
  ctx.ellipse(-13, 0, 15, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Right wing
  ctx.save();
  ctx.scale(1, ws);
  ctx.beginPath();
  ctx.ellipse(13, 0, 15, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // Body
  const bodyGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, 7.5);
  bodyGrad.addColorStop(0, '#ffe87c');
  bodyGrad.addColorStop(0.55, '#f4d000');
  bodyGrad.addColorStop(1, '#b88a00');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// --- Main component ---

export default function MagicBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    let w, h;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Stars
    const stars = Array.from({ length: 160 }, () => ({
      xf: Math.random(),
      yf: Math.random(),
      r: Math.random() * 1.3 + 0.2,
      phase: Math.random() * Math.PI * 2,
      rate: Math.random() * 0.014 + 0.003,
      baseAlpha: Math.random() * 0.45 + 0.12,
      blueish: Math.random() > 0.8,
    }));

    // Candles
    const candles = Array.from({ length: 26 }, () => ({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight * (0.3 + Math.random() * 1.4),
      vy: Math.random() * 0.32 + 0.11,
      drift: (Math.random() - 0.5) * 0.22,
      flamePhase: Math.random() * Math.PI * 2,
      scale: Math.random() * 0.52 + 0.38,
      alpha: Math.random() * 0.42 + 0.16,
    }));

    // Golden sparkle dust
    const sparkles = Array.from({ length: 68 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.32,
      vy: -Math.random() * 0.28 - 0.04,
      r: Math.random() * 1.7 + 0.5,
      phase: Math.random() * Math.PI * 2,
      rate: Math.random() * 0.022 + 0.007,
    }));

    // Snitch
    const snitch = {
      phase: Math.random() * 2000,
      x: window.innerWidth * 0.6,
      y: window.innerHeight * 0.35,
      trail: [],
    };

    // House corner wisps
    const HOUSE_COLORS = [
      { corner: 0, color: '#d83d2f', r: 160 },  // Gryffindor TL
      { corner: 1, color: '#3f6dbd', r: 140 },  // Ravenclaw TR
      { corner: 2, color: '#d7a236', r: 150 },  // Hufflepuff BL
      { corner: 3, color: '#2d9a5d', r: 160 },  // Slytherin BR
    ];
    const wisps = HOUSE_COLORS.map((hc, i) => ({
      ...hc,
      phase: i * 1.6,
      rate: 0.006 + i * 0.001,
    }));

    let t = 0;

    function loop() {
      t++;
      ctx.clearRect(0, 0, w, h);

      // Corner wisps
      wisps.forEach((wp) => {
        wp.phase += wp.rate;
        const pulse = Math.sin(wp.phase) * 0.25 + 0.75;
        const r = wp.r * pulse;
        let cx = 0, cy = 0;
        if (wp.corner === 1 || wp.corner === 3) cx = w;
        if (wp.corner === 2 || wp.corner === 3) cy = h;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `${wp.color}28`);
        grad.addColorStop(0.55, `${wp.color}0e`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Stars
      stars.forEach((s) => {
        s.phase += s.rate;
        const alpha = Math.max(0, s.baseAlpha + Math.sin(s.phase) * 0.22);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.blueish ? '#c8daff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(s.xf * w, s.yf * h, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Candles
      candles.forEach((c) => {
        c.y -= c.vy;
        c.x += c.drift + Math.sin(t * 0.011 + c.flamePhase) * 0.17;
        c.flamePhase += 0.023;
        if (c.y < -80) {
          c.x = Math.random() * w;
          c.y = h + 20 + Math.random() * 60;
        }
        drawCandle(ctx, c.x, c.y, c.scale, c.flamePhase, c.alpha, t);
      });

      // Sparkles
      sparkles.forEach((sp) => {
        sp.phase += sp.rate;
        sp.x += sp.vx;
        sp.y += sp.vy;
        if (sp.x < -15) sp.x = w + 15;
        if (sp.x > w + 15) sp.x = -15;
        if (sp.y < -15) { sp.y = h + 15; sp.x = Math.random() * w; }
        const alpha = Math.max(0, (Math.sin(sp.phase) * 0.5 + 0.5) * 0.85);
        drawSparkle(ctx, sp.x, sp.y, sp.r, alpha);
      });

      // Snitch trail
      snitch.phase++;
      const sx = w * 0.5 + Math.sin(snitch.phase * 0.0068) * w * 0.38;
      const sy = h * 0.5 + Math.sin(snitch.phase * 0.0121) * h * 0.30;
      snitch.trail.push({ x: sx, y: sy });
      if (snitch.trail.length > 24) snitch.trail.shift();
      snitch.x = sx;
      snitch.y = sy;

      snitch.trail.forEach((pt, i) => {
        const a = (i / snitch.trail.length) * 0.38;
        const r = (i / snitch.trail.length) * 2.8;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffe140';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      drawSnitch(ctx, snitch.x, snitch.y, t);

      animId = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="magic-canvas"
    />
  );
}
