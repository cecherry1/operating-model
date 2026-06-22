/* ═══════════════════════════════════════════════════════════════════
   Forma — <flow-wave>  (flow-wave.js)
   ───────────────────────────────────────────────────────────────────
   A flowing line-ribbon: dozens of thin parallel strokes that bundle
   tight on the left, twist through a bright "pinch", and fan wide to
   the right. Pure generated SVG in a shadow root, so any number of
   instances coexist with no id collisions.

   Usage:
     <script src="flow-wave.js"></script>
     <flow-wave></flow-wave>                       ← aurora (default)
     <flow-wave palette="sage"></flow-wave>        ← green/teal variant
     <flow-wave lines-upper="52" lines-lower="34"></flow-wave>

   Lines stay inside the mid vertical band (clear top + bottom) so a
   headline can sit above and stats below without losing contrast.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  var PAL = {
    aurora: {
      upper: [[0, '#FF9E6B'], [0.34, '#F164C7'], [0.62, '#A26BFF'], [1, '#6A6BFF']],
      lower: [[0, '#FFB079'], [0.50, '#FF73AE'], [1, '#C56CFF']]
    },
    sage: {
      upper: [[0, '#A6E86B'], [0.40, '#2FD08A'], [1, '#16B8C9']],
      lower: [[0, '#D2F08A'], [0.50, '#3BD59A'], [1, '#1FA3B5']]
    }
  };

  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function uid(p) { return p + Math.random().toString(36).slice(2, 8); }

  var W = 1200, H = 560, STEPS = 64, PINCH = 0.27;

  function buildPath(center, spread, t, waveAmp, wavePhase) {
    var d = '';
    for (var s = 0; s <= STEPS; s++) {
      var u = s / STEPS;
      var x = -30 + u * (W + 60);
      var y = center(u) + (t - 0.5) * 2 * spread(u) + waveAmp * Math.sin(u * Math.PI * 2.4 + wavePhase);
      d += (s === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    return d;
  }

  // upper ribbon: rises left→right, fans wide upward
  function cU(u) { return (360 - smooth((u - 0.05) / 0.95) * 150) - 46 * Math.sin(u * Math.PI * 0.9); }
  function sU(u) { return 9 + 256 * smooth((u - PINCH) / (1 - PINCH)) + 70 * smooth((PINCH - u) / PINCH); }
  // lower ribbon: stays low, fans moderately
  function cL(u) { return (384 + smooth(u) * 54) + 26 * Math.sin(u * Math.PI * 0.85); }
  function sL(u) { return 7 + 132 * smooth((u - PINCH) / (1 - PINCH)) + 30 * smooth((PINCH - u) / PINCH); }

  function stops(arr) {
    return arr.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join('');
  }

  var FlowWave = function () {};
  FlowWave = class extends HTMLElement {
    connectedCallback() {
      if (this._done) return; this._done = true;
      var nU = parseInt(this.getAttribute('lines-upper') || '46', 10);
      var nL = parseInt(this.getAttribute('lines-lower') || '30', 10);
      var pal = PAL[this.getAttribute('palette') || 'aurora'] || PAL.aurora;
      var idU = uid('u'), idL = uid('l');

      var paths = '';
      for (var i = 0; i < nU; i++) {
        var tu = nU < 2 ? 0.5 : i / (nU - 1);
        paths += '<path d="' + buildPath(cU, sU, tu, 7, i * 0.5) + '" stroke="url(#' + idU + ')"/>';
      }
      for (var j = 0; j < nL; j++) {
        var tl = nL < 2 ? 0.5 : j / (nL - 1);
        paths += '<path d="' + buildPath(cL, sL, tl, 5, j * 0.6 + 1) + '" stroke="url(#' + idL + ')"/>';
      }

      var root = this;
      root.innerHTML =
        '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" ' +
        'style="display:block;width:100%;height:100%;overflow:visible;">' +
        '<defs>' +
        '<linearGradient id="' + idU + '" x1="0" y1="0" x2="1" y2="0">' + stops(pal.upper) + '</linearGradient>' +
        '<linearGradient id="' + idL + '" x1="0" y1="0" x2="1" y2="0">' + stops(pal.lower) + '</linearGradient>' +
        '</defs>' +
        '<g fill="none" stroke-width="1.4" opacity="0.85">' + paths + '</g>' +
        '</svg>';
      this.style.display = this.style.display || 'block';
    }
  };

  if (!customElements.get('flow-wave')) customElements.define('flow-wave', FlowWave);
})();
