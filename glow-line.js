/* glow-line.js — Sage neon glowline accent.
   A self-contained custom element: an organic S-curve where a neon edge
   rakes light across a surface and dies into true black on the shaded side.
   Shadow-DOM scoped, so any number can sit on one page without ID clashes.

   Usage:
     <script src="glow-line.js"></script>
     <glow-line></glow-line>                         // default, fills its box
     <glow-line flip></glow-line>                     // mirror (light on left)
     <glow-line orient="horizontal"></glow-line>      // S runs left→right
     <glow-line intensity="soft"></glow-line>         // soft | normal | bright
     <glow-line static></glow-line>                   // no animation

   Size it with CSS like any block:  glow-line { width:100%; height:280px; border-radius:24px; }
   Honors prefers-reduced-motion (freezes the morph). */

(() => {
  if (customElements.get('glow-line')) return;

  let uid = 0;

  // palettes — surf: dark surface gradient, glow: broad warm/cool glow,
  // s1/s2/s3: broad / mid / core neon strokes, warm: --gl-warm hotspot.
  const PAL = {
    sage:  { warm: '#d6ff5c', surf: ['#1f7a3c', '#0c4422', '#062a14', '#04190d'], glow: '#7ce86a', s1: '#1bff72', s2: '#3dff80', s3: '#9bffc4' },
    azure: { warm: '#cfeeff', surf: ['#1c6fa6', '#0c3a5c', '#06212f', '#04131d'], glow: '#5cc8ff', s1: '#2fb0ff', s2: '#62d0ff', s3: '#d2f1ff' },
    violet:{ warm: '#e6d4ff', surf: ['#5a3a9a', '#321f5c', '#1d122e', '#120a1d'], glow: '#9b6cff', s1: '#7c4dff', s2: '#a378ff', s3: '#e2d2ff' }
  };

  class GlowLine extends HTMLElement {
    static get observedAttributes() { return ['flip', 'orient', 'intensity', 'static', 'palette']; }

    connectedCallback() { this._render(); }
    attributeChangedCallback() { if (this.shadowRoot) this._render(); }

    _render() {
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const n = ++uid; // unique id namespace per instance
      const flip = this.hasAttribute('flip');
      const horiz = (this.getAttribute('orient') || 'vertical') === 'horizontal';
      const noAnim = this.hasAttribute('static');
      const intensity = this.getAttribute('intensity') || 'normal';
      // intensity → broad-glow opacity + mid opacity + warm strength
      const I = { soft: [0.4, 0.62, 0.7], normal: [0.55, 0.8, 0.9], bright: [0.72, 0.95, 1] }[intensity] || [0.55, 0.8, 0.9];
      const P = PAL[this.getAttribute('palette') || 'sage'] || PAL.sage;

      // S-curve keyframes (vertical authoring space 240×180). Two morph targets.
      const A = 'M118,-4 C150,42 60,72 120,100 C174,124 92,150 150,184';
      const B = 'M126,-4 C142,48 70,66 112,100 C170,130 102,144 158,184';
      const regA = A + ' L244,184 L244,-4 Z';
      const regB = B + ' L244,184 L244,-4 Z';

      const anim = (vals) => noAnim ? '' :
        `<animate attributeName="d" dur="15s" repeatCount="indefinite"
          values="${vals[0]};${vals[1]};${vals[0]}"
          calcMode="spline" keyTimes="0;0.5;1"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>`;

      // orientation/flip handled by a transform on the whole svg
      let tf = '';
      if (flip) tf += 'scaleX(-1) ';
      if (horiz) tf += 'rotate(90deg) ';

      root.innerHTML = `
        <style>
          :host { display:block; position:relative; overflow:hidden; background:#000;
                  width:100%; height:100%; --gl-warm:${P.warm}; }
          svg { position:absolute; inset:0; width:100%; height:100%; display:block;
                transform:${tf || 'none'}; transform-origin:center;
                ${horiz ? 'scale:1.34;' : ''} }
          @media (prefers-reduced-motion: reduce){ animate { display:none; } }
        </style>
        <svg viewBox="0 0 240 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <clipPath id="lit${n}" clipPathUnits="userSpaceOnUse">
              <path d="${regA}">${anim([regA, regB])}</path>
            </clipPath>
            <linearGradient id="surf${n}" x1="0" y1="0" x2="1" y2="0.2">
              <stop offset="0" stop-color="${P.surf[0]}"/>
              <stop offset="0.4" stop-color="${P.surf[1]}"/>
              <stop offset="0.72" stop-color="${P.surf[2]}"/>
              <stop offset="1" stop-color="${P.surf[3]}"/>
            </linearGradient>
            <radialGradient id="warm${n}" cx="0.66" cy="0.98" r="0.45">
              <stop offset="0" stop-color="var(--gl-warm)" stop-opacity="${0.9 * I[2]}"/>
              <stop offset="0.5" stop-color="${P.glow}" stop-opacity="${0.35 * I[2]}"/>
              <stop offset="1" stop-color="${P.glow}" stop-opacity="0"/>
            </radialGradient>
            <filter id="gb${n}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="15"/></filter>
            <filter id="gm${n}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
            <filter id="gc${n}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
          </defs>
          <rect width="240" height="180" fill="#000"/>
          <g clip-path="url(#lit${n})">
            <rect width="240" height="180" fill="url(#surf${n})"/>
            <path d="${A}" fill="none" stroke="${P.s1}" stroke-width="30" opacity="${I[0]}" filter="url(#gb${n})">${anim([A, B])}</path>
            <path d="${A}" fill="none" stroke="${P.s2}" stroke-width="13" opacity="${I[1]}" filter="url(#gm${n})">${anim([A, B])}</path>
            <path d="${A}" fill="none" stroke="${P.s3}" stroke-width="2" opacity="0.7" filter="url(#gc${n})">${anim([A, B])}</path>
            <rect width="240" height="180" fill="url(#warm${n})"/>
          </g>
        </svg>`;
    }
  }

  customElements.define('glow-line', GlowLine);
})();
