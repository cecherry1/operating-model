/* ═══════════════════════════════════════════════════════════════════
   Forma — <pulse-lines>  (pulse-lines.js)
   ───────────────────────────────────────────────────────────────────
   A coherent bundle of many smooth strands that meander across the
   frame like one drawn curve — with bright pulses of light streaming
   along each wire. The strands themselves sit dim; energy travels them
   as glowing comets, head hot-white, tail fading into the palette. An
   organized, on-the-rails cousin to <particle-flow>: same palettes and
   additive glow, but the light runs in lanes.

   Self-contained 2-D canvas; any number coexist with no id clashes.

   Usage:
     <script src="pulse-lines.js"></script>
     <pulse-lines></pulse-lines>                          ← sage (default)
     <pulse-lines palette="aurora" count="48"></pulse-lines>
     <pulse-lines palette="ember" density="1.6" trail="1.4"></pulse-lines>

   Attributes (all live — change any time):
     palette     sage | aurora | ember | ice   (strand colour ramp)
     count       number of strands         (default 40)
     speed       pulse travel rate, 0.2–3        (default 1)
     density     pulses per strand         (default 1)
     glow        pulse width & halo, 0–2.5      (default 1)
     trail       comet tail length, 0.2–2.5      (default 1)
     curve       how much the bundle meanders, 0–2 (default 1)
     brightness  overall intensity, 0 (black) up    (default 1)
     angle       rotate the whole river, degrees    (default 0)
     x           horizontal offset, fraction of width  (default 0)
     y           vertical offset, fraction of height   (default 0)
     bg          backdrop colour          (default #0a0f15)

   Honours reduced-motion (paints one static frame of frozen pulses).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  // colour ramps, sampled across the bundle (top strand → bottom strand)
  var PAL = {
    sage:   [[0,[20,205,86]],[0.42,[44,216,104]],[0.74,[82,228,126]],[1,[122,236,150]]],
    aurora: [[0,[255,158,107]],[0.34,[241,100,199]],[0.62,[162,107,255]],[1,[106,107,255]]],
    ember:  [[0,[255,236,196]],[0.30,[255,150,52]],[0.66,[240,72,52]],[1,[150,24,60]]],
    ice:    [[0,[224,252,255]],[0.40,[120,210,255]],[0.74,[70,130,255]],[1,[120,80,255]]]
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  function sampleRamp(ramp, u) {
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    for (var i = 1; i < ramp.length; i++) {
      if (u <= ramp[i][0]) {
        var a = ramp[i - 1], b = ramp[i], f = (u - a[0]) / (b[0] - a[0] || 1);
        return [
          Math.round(a[1][0] + (b[1][0] - a[1][0]) * f),
          Math.round(a[1][1] + (b[1][1] - a[1][1]) * f),
          Math.round(a[1][2] + (b[1][2] - a[1][2]) * f)
        ];
      }
    }
    return ramp[ramp.length - 1][1];
  }

  function parseBg(str) {
    str = (str || '#0a0f15').trim();
    var m = str.match(/^#?([0-9a-f]{6})$/i);
    if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return [10, 15, 21];
  }

  // soft round sprite tinted by colour c, for the glowing pulse heads
  function makeSprite(c) {
    var s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    var x = cv.getContext('2d'), r = s / 2, col = c[0] + ',' + c[1] + ',' + c[2];
    var g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0,    'rgba(255,255,255,0.95)');
    g.addColorStop(0.18, 'rgba(' + col + ',0.8)');
    g.addColorStop(0.5,  'rgba(' + col + ',0.22)');
    g.addColorStop(1,    'rgba(' + col + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    return cv;
  }

  var STEPS = 150; // samples per strand

  class PulseLines extends HTMLElement {
    static get observedAttributes() {
      return ['palette', 'count', 'speed', 'density', 'glow', 'trail', 'curve', 'brightness', 'angle', 'x', 'y', 'bg'];
    }

    connectedCallback() {
      if (this._init) return; this._init = true;
      this.style.display = this.style.display || 'block';
      this.style.position = this.style.position || 'relative';

      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;width:100%;height:100%;';
      this.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this._reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._readAttrs();
      this._build();
      this._resizeObs = new ResizeObserver(this._resize.bind(this));
      this._resizeObs.observe(this);
      this._resize();
      this._paintBg();

      this._step(this._reduce ? 2.2 : 1.0); this._draw(); // paint a populated first frame at once
      if (!this._reduce) this._raf = requestAnimationFrame(this._loop.bind(this));
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      if (this._resizeObs) this._resizeObs.disconnect();
      this._init = false;
    }

    attributeChangedCallback(name) {
      if (!this._init) return;
      var pCount = this._count, pPal = this._palKey, pDens = this._density, pCurve = this._curve;
      this._readAttrs();
      if (name === 'palette' && this._palKey !== pPal) this._build();
      if (name === 'count' && this._count !== pCount) this._build();
      if (name === 'density' && this._density !== pDens) this._seedPulses();
      if (name === 'curve' && this._curve !== pCurve) this._geometry();
      if (name === 'bg') this._paintBg();
      if (this._reduce) { this._paintBg(); this._step(2.2); }
      this._draw(); // repaint at once so live controls respond even if rAF is throttled
    }

    _readAttrs() {
      this._palKey = this.getAttribute('palette') || 'sage';
      this._pal = PAL[this._palKey] || PAL.sage;
      this._count = clamp(parseInt(this.getAttribute('count') || '40', 10), 3, 120);
      this._speed = parseFloat(this.getAttribute('speed') || '1');
      this._density = clamp(parseFloat(this.getAttribute('density') || '1'), 0.1, 4);
      this._glow = clamp(parseFloat(this.getAttribute('glow') || '1'), 0, 2.5);
      this._trail = clamp(parseFloat(this.getAttribute('trail') || '1'), 0.15, 2.5);
      this._curve = clamp(parseFloat(this.getAttribute('curve') == null ? '1' : this.getAttribute('curve')), 0, 2);
      this._bright = Math.max(0, parseFloat(this.getAttribute('brightness') == null ? '1' : this.getAttribute('brightness')));
      this._angle = (parseFloat(this.getAttribute('angle') || '0') || 0) * Math.PI / 180;
      this._ox = parseFloat(this.getAttribute('x') || '0') || 0; // fraction of width, +right
      this._oy = parseFloat(this.getAttribute('y') || '0') || 0; // fraction of height, +down
      this._bg = parseBg(this.getAttribute('bg'));
    }

    // colour + sprite + per-strand meander phase, then geometry & pulses
    _build() {
      var N = this._count;
      this._phase = [];
      for (var i = 0; i < N; i++) this._phase.push(i * 0.27);
      // sprites + colours sampled ALONG the strand (end-to-end gradient)
      var NB = 24; this._NB = NB; this._uSprites = []; this._uCols = [];
      for (var b = 0; b < NB; b++) {
        var c = sampleRamp(this._pal, b / (NB - 1));
        this._uCols.push(c); this._uSprites.push(makeSprite(c));
      }
      this._geometry();
      this._seedPulses();
    }

    // strand centreline in fractional space — a coherent meandering bundle
    _centerY(u) {
      var k = this._curve;
      return 0.5
        + 0.14 * k * Math.sin(u * Math.PI * 1.6 + 0.4)
        + 0.05 * k * Math.sin(u * Math.PI * 3.2 + 1.3);
    }
    // half-thickness of the bundle: pinched left, fanning right
    _halfSpread(u) {
      return 0.05 + 0.30 * smooth((u - 0.12) / 0.88);
    }

    // precompute each strand's polyline (fractional coords) — static geometry
    _geometry() {
      if (!this._count) return;
      var N = this._count, lines = [];
      for (var i = 0; i < N; i++) {
        var t = N < 2 ? 0 : i / (N - 1), q = (t - 0.5) * 2, ph = this._phase[i];
        var pts = new Float32Array((STEPS + 1) * 2);
        for (var s = 0; s <= STEPS; s++) {
          var u = s / STEPS;
          var y = this._centerY(u) + q * this._halfSpread(u)
                + 0.012 * Math.sin(u * Math.PI * 7.0 + ph); // subtle per-strand wiggle
          pts[s * 2] = u;
          pts[s * 2 + 1] = y;
        }
        lines.push(pts);
      }
      this._lines = lines;
    }

    // distribute pulses along each strand
    _seedPulses() {
      if (!this._count) return;
      var N = this._count, per = Math.max(1, Math.round(1.7 * this._density));
      this._pulses = [];
      for (var i = 0; i < N; i++) {
        var arr = [];
        for (var k = 0; k < per; k++) {
          arr.push({ pos: rand(-0.4, 1), spd: rand(0.8, 1.25), len: rand(0.85, 1.2) });
        }
        this._pulses.push(arr);
      }
    }

    _resize() {
      var r = this.getBoundingClientRect();
      this._w = Math.max(1, r.width); this._h = Math.max(1, r.height);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this._w * dpr);
      this.canvas.height = Math.round(this._h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._paintBg();
      if (this._reduce) { this._draw(); }
    }

    _paintBg() {
      if (!this.ctx) return;
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = rgb(this._bg);
      this.ctx.fillRect(0, 0, this._w, this._h);
    }

    _step(dt) {
      var base = 0.16 * this._speed, P = this._pulses;
      var tailMax = 0.16 * this._trail;
      for (var i = 0; i < P.length; i++) {
        var arr = P[i];
        for (var k = 0; k < arr.length; k++) {
          var p = arr[k];
          p.pos += base * p.spd * dt;
          if (p.pos - tailMax * p.len > 1.04) {
            p.pos = -rand(0.02, 0.5);
            p.spd = rand(0.8, 1.25);
            p.len = rand(0.85, 1.2);
          }
        }
      }
    }

    _draw() {
      var ctx = this.ctx, W = this._w, H = this._h, bmul = this._bright;
      var lines = this._lines, P = this._pulses, ramp = this._pal, NB = this._NB;
      if (!lines) return;

      // backdrop (untransformed, fills the whole frame)
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgb(this._bg);
      ctx.fillRect(0, 0, W, H);

      // place the bundle: X/Y offset + rotation about the centre
      ctx.save();
      var cx = W / 2, cy = H / 2;
      ctx.translate(cx + this._ox * W, cy + this._oy * H);
      ctx.rotate(this._angle);
      ctx.translate(-cx, -cy);

      // 1) dim resting strands, with a true end-to-end (left→right) gradient
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(0.6, Math.min(W, H) * 0.0011);
      var grad = ctx.createLinearGradient(0, 0, W, 0);
      for (var gi = 0; gi < ramp.length; gi++) {
        var rc = ramp[gi][1];
        grad.addColorStop(ramp[gi][0], 'rgba(' + rc[0] + ',' + rc[1] + ',' + rc[2] + ',' + (0.10 * bmul).toFixed(3) + ')');
      }
      ctx.strokeStyle = grad;
      for (var i = 0; i < lines.length; i++) {
        var pts = lines[i];
        ctx.beginPath();
        for (var s = 0; s <= STEPS; s++) {
          var x = pts[s * 2] * W, y = pts[s * 2 + 1] * H;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (bmul <= 0) { ctx.restore(); ctx.globalCompositeOperation = 'source-over'; return; }

      // 2) pulses — a swell of width + light travelling the strand (no comet head).
      //    Each pulse is a symmetric spindle centred on `pos`: the wire thickens
      //    and brightens toward the centre and tapers back to the resting line.
      ctx.lineCap = 'butt'; // flat caps — round caps turn short fat segments into beads
      var maxW = Math.max(1.0, Math.min(W, H) * 0.0034) * this._glow; // peak swell width
      var halfL = 0.16 * this._trail;                                 // spindle half-length (param)
      for (var li = 0; li < lines.length; li++) {
        var lp = lines[li], arr = P[li];
        for (var pi = 0; pi < arr.length; pi++) {
          var pulse = arr[pi], c0 = pulse.pos, L = halfL * pulse.len;
          if (c0 + L < 0 || c0 - L > 1) continue;
          // walk segments across [c0-L, c0+L]; width & alpha follow a cosine bump
          var segN = 22;
          for (var g = 0; g < segN; g++) {
            var t0 = g / segN, t1 = (g + 1) / segN;          // 0..1 across the spindle
            var u0 = c0 - L + 2 * L * t0, u1 = c0 - L + 2 * L * t1;
            if (u1 < 0 || u0 > 1) continue;
            var a0 = clamp(u0, 0, 1), a1 = clamp(u1, 0, 1);
            var fm = (t0 + t1) - 1;                            // -1..1 offset from centre
            var env = 0.5 * (1 + Math.cos(Math.PI * clamp(fm, -1, 1))); // 1 at centre → 0 at ends
            var x0 = a0 * W, y0 = sampleY(lp, a0) * H;
            var x1 = a1 * W, y1 = sampleY(lp, a1) * H;
            var col = sampleRamp(ramp, (a0 + a1) / 2);
            ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.5 * env * bmul).toFixed(3) + ')';
            ctx.lineWidth = Math.max(0.5, maxW * env);
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          }
        }
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    _loop(now) {
      var last = this._last || now; this._last = now;
      var dt = Math.min(0.05, (now - last) / 1000) || 1 / 60;
      this._step(dt);
      this._draw();
      this._raf = requestAnimationFrame(this._loop.bind(this));
    }
  }

  // sample a strand's y (fractional) at param u via linear interp on the polyline
  function sampleY(pts, u) {
    var fs = u * STEPS, s0 = Math.floor(fs), f = fs - s0;
    if (s0 < 0) s0 = 0, f = 0;
    if (s0 >= STEPS) return pts[STEPS * 2 + 1];
    var y0 = pts[s0 * 2 + 1], y1 = pts[(s0 + 1) * 2 + 1];
    return y0 + (y1 - y0) * f;
  }

  if (!customElements.get('pulse-lines')) customElements.define('pulse-lines', PulseLines);
})();
