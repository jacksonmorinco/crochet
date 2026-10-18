(() => {
  'use strict';

  const STORE_KEY = 'blanket-planner-v1';
  const BASE_PX_PER_IN = 20;   // at zoom 1
  const RULER = 28;            // ruler thickness, css px
  const MAX_UNDO = 100;

  // Row height relative to an sc row, and yarn used per stitch as a
  // multiple of the stitch width (rough rule of thumb for super bulky).
  const STITCHES = {
    sc:   { label: 'sc',   height: 1.0, yarn: 7.5 },
    moss: { label: 'moss', height: 1.0, yarn: 6.5 },
    hdc:  { label: 'hdc',  height: 1.4, yarn: 9.0 },
    dc:   { label: 'dc',   height: 2.0, yarn: 11.0 },
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    projName: $('projName'), sizePreset: $('sizePreset'), widthIn: $('widthIn'), heightIn: $('heightIn'),
    stitch: $('stitch'), gridStat: $('gridStat'), hookMm: $('hookMm'), labelHookMm: $('labelHookMm'),
    useSwatch: $('useSwatch'), swatchFields: $('swatchFields'), swSts: $('swSts'), swRows: $('swRows'),
    gaugeStat: $('gaugeStat'), yarnTable: $('yarnTable'), tools: $('tools'), brushSize: $('brushSize'),
    mirrorX: $('mirrorX'), mirrorY: $('mirrorY'), showGrid: $('showGrid'), zoom: $('zoom'), fitBtn: $('fitBtn'),
    wrap: $('canvasWrap'), inner: $('canvasInner'), grid: $('grid'), rulerTop: $('rulerTop'), rulerLeft: $('rulerLeft'),
    status: $('status'), projColors: $('projColors'), catSearch: $('catSearch'), catalog: $('catalog'),
    customColor: $('customColor'), rowDown: $('rowDown'), rowUp: $('rowUp'), rowNum: $('rowNum'),
    crafting: $('crafting'), rowReadout: $('rowReadout'), undoBtn: $('undoBtn'), redoBtn: $('redoBtn'),
    exportPng: $('exportPng'), exportJson: $('exportJson'), importJson: $('importJson'), newBtn: $('newBtn'),
  };

  // ---------- state ----------

  function defaultState() {
    const s = {
      name: 'My blanket',
      widthIn: 50, heightIn: 60, preset: '50x60',
      stitch: 'sc',
      hookMm: 10, labelHookMm: YARN.gauge.hookMm,
      useSwatch: false, swSts: YARN.gauge.sts, swRows: YARN.gauge.rows,
      colors: [copyColor(CATALOG[0])],
      active: 0,
      row: 1, crafting: false,
      zoom: 1, showGrid: true,
      cols: 0, rows: 0, cells: null, marks: null,
    };
    const { cols, rows } = gridDims(s);
    s.cols = cols; s.rows = rows;
    s.cells = new Uint8Array(cols * rows);
    s.marks = new Uint8Array(cols * rows);
    return s;
  }

  function copyColor(c) {
    const o = { name: c.name, code: c.code || '', hex: c.hex.slice() };
    if (c.fleck) o.fleck = c.fleck;
    return o;
  }

  function gauge(s) {
    if (s.useSwatch) return { sts: +s.swSts || YARN.gauge.sts, rows: +s.swRows || YARN.gauge.rows };
    const k = (+s.labelHookMm || YARN.gauge.hookMm) / (+s.hookMm || YARN.gauge.hookMm);
    return { sts: YARN.gauge.sts * k, rows: YARN.gauge.rows * k };
  }

  function stitchSize(s) {
    const g = gauge(s);
    const w = YARN.gauge.inches / g.sts;
    const h = (YARN.gauge.inches / g.rows) * STITCHES[s.stitch].height;
    return { w, h };
  }

  function gridDims(s) {
    const { w, h } = stitchSize(s);
    return {
      cols: Math.max(1, Math.min(600, Math.round(s.widthIn / w))),
      rows: Math.max(1, Math.min(600, Math.round(s.heightIn / h))),
    };
  }

  let S = load() || defaultState();
  const undoStack = [], redoStack = [];

  function snapshot() {
    return {
      ...S,
      colors: S.colors.map(copyColor),
      cells: S.cells.slice(),
      marks: S.marks.slice(),
    };
  }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
  }
  function restore(snap) {
    const keepView = { zoom: S.zoom, showGrid: S.showGrid, row: S.row, crafting: S.crafting };
    S = { ...snap, ...keepView, colors: snap.colors.map(copyColor), cells: snap.cells.slice(), marks: snap.marks.slice() };
    if (S.active >= S.colors.length) S.active = 0;
    syncInputs(); renderAll(); save();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updateUndoButtons(); }
  function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updateUndoButtons(); }
  function updateUndoButtons() {
    els.undoBtn.disabled = !undoStack.length;
    els.redoBtn.disabled = !redoStack.length;
  }

  // ---------- persistence ----------

  function serialize(s) {
    return JSON.stringify({
      v: 1, ...s,
      cells: rle(s.cells), marks: rle(s.marks),
    });
  }
  function deserialize(text) {
    const o = JSON.parse(text);
    if (!o || o.v !== 1 || !Array.isArray(o.colors) || !o.cols || !o.rows) throw new Error('Not a blanket file');
    const base = defaultState();
    const s = { ...base, ...o };
    delete s.v;
    const n = s.cols * s.rows;
    s.cells = unrle(o.cells, n);
    s.marks = unrle(o.marks, n);
    s.colors = o.colors.map((c) => copyColor({ name: String(c.name || 'Color'), code: String(c.code || ''), hex: (c.hex || ['#888888']).map(String), fleck: +c.fleck || 0 }));
    for (let i = 0; i < n; i++) if (s.cells[i] >= s.colors.length) s.cells[i] = 0;
    if (!STITCHES[s.stitch]) s.stitch = 'sc';
    return s;
  }
  function rle(arr) {
    const out = [];
    for (let i = 0; i < arr.length;) {
      let j = i; while (j < arr.length && arr[j] === arr[i]) j++;
      out.push(j - i, arr[i]); i = j;
    }
    return out;
  }
  function unrle(runs, n) {
    const a = new Uint8Array(n);
    if (!Array.isArray(runs)) return a;
    let p = 0;
    for (let i = 0; i + 1 < runs.length && p < n; i += 2) {
      const len = Math.min(runs[i] | 0, n - p);
      a.fill(runs[i + 1] | 0, p, p + len); p += len;
    }
    return a;
  }

  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, serialize(S)); } catch (_) { /* storage unavailable */ }
    }, 250);
  }
  function load() {
    try {
      const t = localStorage.getItem(STORE_KEY);
      return t ? deserialize(t) : null;
    } catch (_) { return null; }
  }

  // ---------- grid resizing ----------

  // Size change: keep stitches where they are, anchored at the bottom-left
  // (row 1, first stitch), and crop or extend.
  function cropTo(cols, rows) {
    const cells = new Uint8Array(cols * rows), marks = new Uint8Array(cols * rows);
    for (let r = 0; r < Math.min(rows, S.rows); r++)
      for (let c = 0; c < Math.min(cols, S.cols); c++) {
        cells[r * cols + c] = S.cells[r * S.cols + c];
        marks[r * cols + c] = S.marks[r * S.cols + c];
      }
    S.cols = cols; S.rows = rows; S.cells = cells; S.marks = marks;
  }
  // Gauge or stitch change: same blanket, different stitch count, so
  // resample the design to keep the picture.
  function resampleTo(cols, rows) {
    const cells = new Uint8Array(cols * rows), marks = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const sr = Math.min(S.rows - 1, Math.floor((r + 0.5) * S.rows / rows));
      for (let c = 0; c < cols; c++) {
        const sc = Math.min(S.cols - 1, Math.floor((c + 0.5) * S.cols / cols));
        cells[r * cols + c] = S.cells[sr * S.cols + sc];
        marks[r * cols + c] = S.marks[sr * S.cols + sc];
      }
    }
    S.cols = cols; S.rows = rows; S.cells = cells; S.marks = marks;
  }
  function applyDims(mode) {
    const { cols, rows } = gridDims(S);
    if (cols !== S.cols || rows !== S.rows) (mode === 'resample' ? resampleTo : cropTo)(cols, rows);
    S.row = Math.min(Math.max(1, S.row), S.rows);
  }

  // ---------- rendering ----------

  const ctx = els.grid.getContext('2d');
  const rtCtx = els.rulerTop.getContext('2d');
  const rlCtx = els.rulerLeft.getContext('2d');
  let cw = 0, ch = 0, dpr = 1;
  let preview = null; // {cells: Set of idx} for rect/line tools
  let rafPending = false;

  function geometry() {
    const { w, h } = stitchSize(S);
    const ppi = BASE_PX_PER_IN * S.zoom;
    cw = w * ppi; ch = h * ppi;
    const W = S.cols * cw, H = S.rows * ch;
    // keep the backing store under ~40M px
    dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(40e6 / Math.max(1, W * H)));
    return { W, H, ppi };
  }

  function sizeCanvases() {
    const { W, H } = geometry();
    const c = els.grid;
    c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
    c.style.width = W + 'px'; c.style.height = H + 'px';
    c.style.left = RULER + 'px'; c.style.top = RULER + 'px';
    els.inner.style.width = (W + RULER) + 'px';
    els.inner.style.height = (H + RULER) + 'px';
    const rt = els.rulerTop, rl = els.rulerLeft;
    rt.width = Math.round((W + RULER) * dpr); rt.height = Math.round(RULER * dpr);
    rt.style.width = (W + RULER) + 'px'; rt.style.height = RULER + 'px';
    rl.width = Math.round(RULER * dpr); rl.height = Math.round((H + RULER) * dpr);
    rl.style.width = RULER + 'px'; rl.style.height = (H + RULER) + 'px';
  }

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function drawRulers() {
    const { W, H, ppi } = geometry();
    const ink = cssVar('--muted') || '#777', bg = cssVar('--panel') || '#fff';
    const totalW = S.cols * cw / ppi, totalH = S.rows * ch / ppi;
    const step = ppi >= 30 ? 1 : ppi >= 12 ? 2 : 6;
    const label = ppi >= 30 ? 6 : 12;

    for (const [c, horiz] of [[rtCtx, true], [rlCtx, false]]) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = bg; c.fillRect(0, 0, horiz ? W + RULER : RULER, horiz ? RULER : H + RULER);
      c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 1;
      c.font = '10px system-ui, sans-serif';
      const len = horiz ? totalW : totalH;
      for (let i = 0; i <= Math.floor(len + 1e-6); i += step) {
        const major = i % label === 0;
        const t = major ? 12 : 5;
        c.beginPath();
        if (horiz) {
          const x = RULER + i * ppi + 0.5;
          c.moveTo(x, RULER); c.lineTo(x, RULER - t);
        } else {
          const y = RULER + H - i * ppi + 0.5; // inches measured from the bottom edge (row 1)
          c.moveTo(RULER, y); c.lineTo(RULER - t, y);
        }
        c.stroke();
        if (major && i > 0) {
          if (horiz) { c.textAlign = 'center'; c.fillText(i + '″', RULER + i * ppi, 11); }
          else {
            c.save(); c.translate(11, RULER + H - i * ppi); c.rotate(-Math.PI / 2);
            c.textAlign = 'center'; c.fillText(i + '″', 0, 0); c.restore();
          }
        }
      }
    }
    
  }

  const patternCache = new Map();
  function fillFor(c, target) {
    if (c.hex.length === 1) return c.hex[0];
    const key = c.hex.join(',') + '/' + (c.fleck || 0.5) + '@' + dpr.toFixed(2);
    let p = patternCache.get(key);
    if (!p) {
      // speckle so heathers/multis read like the yarn: mostly the first
      // shade, flecked with the others
      const fleck = Math.max(1, Math.round(1.5 * dpr)), n = 61, size = fleck * n;
      const off = document.createElement('canvas');
      off.width = off.height = size;
      const o = off.getContext('2d');
      o.fillStyle = c.hex[0]; o.fillRect(0, 0, size, size);
      let seed = 7;
      const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          if (rand() >= (c.fleck || 0.5)) continue;
          o.fillStyle = c.hex[1 + Math.floor(rand() * (c.hex.length - 1))];
          o.fillRect(x * fleck, y * fleck, fleck, fleck);
        }
      p = target.createPattern(off, 'repeat');
      patternCache.set(key, p);
    }
    return p;
  }

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  function drawGrid(c, opts) {
    const { cols, rows, cells, marks, colors } = S;
    const sw = opts.cw, sh = opts.ch;
    const fills = colors.map((col) => fillFor(col, c));
    for (let r = 0; r < rows; r++) {
      const y = (rows - 1 - r) * sh;
      for (let x0 = 0; x0 < cols;) {
        const v = cells[r * cols + x0];
        let x1 = x0 + 1;
        while (x1 < cols && cells[r * cols + x1] === v) x1++;
        c.fillStyle = fills[v];
        c.fillRect(x0 * sw, y, (x1 - x0) * sw, sh);
        x0 = x1;
      }
    }
    // a little row texture: a soft shadow along the bottom of each stitch
    if (sw >= 6 && sh >= 6) {
      c.fillStyle = 'rgba(0,0,0,0.07)';
      for (let r = 0; r < rows; r++) c.fillRect(0, (rows - r) * sh - sh * 0.18, cols * sw, sh * 0.18);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      for (let r = 0; r < rows; r++) c.fillRect(0, (rows - 1 - r) * sh, cols * sw, sh * 0.15);
    }
    // grid lines; every 10th stitch / row heavier, counted from row 1, stitch 1
    if (opts.grid) {
      const W = cols * sw, H = rows * sh;
      const thin = Math.max(0.5, 1 / opts.scale);
      if (sw >= 5 && sh >= 5) {
        c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = thin; c.beginPath();
        for (let i = 1; i < cols; i++) if (i % 10) { c.moveTo(i * sw, 0); c.lineTo(i * sw, H); }
        for (let j = 1; j < rows; j++) if (j % 10) { c.moveTo(0, H - j * sh); c.lineTo(W, H - j * sh); }
        c.stroke();
      }
      c.strokeStyle = 'rgba(0,0,0,0.42)'; c.lineWidth = thin * 1.6; c.beginPath();
      for (let i = 10; i < cols; i += 10) { c.moveTo(i * sw, 0); c.lineTo(i * sw, H); }
      for (let j = 10; j < rows; j += 10) { c.moveTo(0, H - j * sh); c.lineTo(W, H - j * sh); }
      c.stroke();
    }
    // stitch marks
    c.lineWidth = Math.max(1, Math.min(sw, sh) * 0.12); c.lineCap = 'round';
    for (let r = 0; r < rows; r++)
      for (let x = 0; x < cols; x++) {
        if (!marks[r * cols + x]) continue;
        const col = colors[cells[r * cols + x]];
        c.strokeStyle = luminance(col.hex[0]) > 0.55 ? 'rgba(0,0,0,.75)' : 'rgba(255,255,255,.9)';
        const px = x * sw, py = (rows - 1 - r) * sh, m = Math.min(sw, sh) * 0.28;
        const cx = px + sw / 2, cy = py + sh / 2;
        c.beginPath();
        c.moveTo(cx - m, cy - m); c.lineTo(cx + m, cy + m);
        c.moveTo(cx + m, cy - m); c.lineTo(cx - m, cy + m);
        c.stroke();
      }
  }

  function render() {
    rafPending = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S.cols * cw, S.rows * ch);
    drawGrid(ctx, { cw, ch, grid: S.showGrid, scale: dpr });

    const W = S.cols * cw;
    const rowY = (S.rows - S.row) * ch;
    if (S.crafting && S.row > 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(0, rowY + ch, W, (S.row - 1) * ch);
    }
    // current row
    ctx.strokeStyle = cssVar('--accent') || '#b03b4a';
    ctx.lineWidth = 2;
    ctx.setLineDash(S.crafting ? [] : [6, 4]);
    ctx.strokeRect(1, rowY + 1, W - 2, ch - 2);
    ctx.setLineDash([]);

    if (preview) {
      const col = S.colors[S.active];
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = fillFor(col, ctx);
      for (const i of preview) {
        const x = i % S.cols, r = (i / S.cols) | 0;
        ctx.fillRect(x * cw, (S.rows - 1 - r) * ch, cw, ch);
      }
      ctx.globalAlpha = 1;
    }
  }

  function requestRender() {
    if (!rafPending) { rafPending = true; requestAnimationFrame(render); }
  }

  function renderAll() {
    patternCache.clear();
    sizeCanvases();
    drawRulers();
    render();
    renderStats();
    renderColors();
    renderCatalog();
    renderYarn();
    renderRow();
  }

  // ---------- side panels ----------

  function fmt(n, d = 1) { return (Math.round(n * 10 ** d) / 10 ** d).toString(); }

  function renderStats() {
    const { w, h } = stitchSize(S);
    const g = gauge(S);
    const st = STITCHES[S.stitch];
    els.gridStat.innerHTML =
      `<b>${S.cols}</b> stitches × <b>${S.rows}</b> rows (${st.label})<br>` +
      `Actual size ≈ <b>${fmt(S.cols * w)}″ × ${fmt(S.rows * h)}″</b><br>` +
      `Foundation: chain <b>${S.cols + 1}</b>`;
    els.gaugeStat.innerHTML =
      `<b>${fmt(g.sts)}</b> sc × <b>${fmt(g.rows)}</b> rows per 4″<br>` +
      `Each stitch ≈ <b>${fmt(w, 2)}″</b> wide × <b>${fmt(h, 2)}″</b> tall`;
    els.swatchFields.style.display = S.useSwatch ? '' : 'none';
    els.hookMm.disabled = els.labelHookMm.disabled = S.useSwatch;
  }

  function counts() {
    const n = new Array(S.colors.length).fill(0);
    for (let i = 0; i < S.cells.length; i++) n[S.cells[i]]++;
    return n;
  }

  function yardsFor(stitchCount) {
    const { w } = stitchSize(S);
    return stitchCount * w * STITCHES[S.stitch].yarn / 36 * 1.1;
  }

  function swatchBg(c) {
    if (c.hex.length === 1) return c.hex[0];
    const dots = c.hex.slice(1).map((h, i) =>
      `radial-gradient(circle at ${[28, 72, 40, 65][i % 4]}% ${[30, 62, 75, 25][i % 4]}%, ${h} 0 14%, transparent 15%)`);
    return `${dots.join(', ')}, ${c.hex[0]}`;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

  let swapTarget = -1;

  function renderColors() {
    const n = counts();
    els.projColors.innerHTML = S.colors.map((c, i) => `
      <div class="pc${i === S.active ? ' active' : ''}" data-i="${i}">
        <span class="chip" style="background:${swatchBg(c)}" title="Adjust to match your skein">
          <input type="color" value="${c.hex[0]}" data-edit="${i}" aria-label="Adjust ${esc(c.name)}">
        </span>
        <span class="nm">${esc(c.name)}${i === 0 ? ' · bg' : ''}<small>${c.code ? '#' + esc(c.code) + ' · ' : ''}${n[i]} st</small></span>
        <button data-swap="${i}" class="${swapTarget === i ? 'on' : ''}" title="Swap to another shade">⇄</button>
        ${i === 0 ? '<span></span>' : `<button data-del="${i}" title="Remove (stitches go to background)">✕</button>`}
      </div>`).join('');
  }

  function renderCatalog() {
    const q = els.catSearch.value.trim().toLowerCase();
    const used = new Set(S.colors.map((c) => c.name));
    els.catalog.innerHTML = CATALOG.map((c, i) => {
      if (q && !(c.name.toLowerCase().includes(q) || c.code.includes(q))) return '';
      const title = `${c.name}${c.code ? ' (' + c.code + ')' : ''}`;
      return `<button class="sw${used.has(c.name) ? ' used' : ''}" data-cat="${i}" title="${esc(title)}" aria-label="${esc(title)}" style="background:${swatchBg(c)}"></button>`;
    }).join('');
  }

  function renderYarn() {
    const n = counts();
    let totalYd = 0, totalSk = 0;
    const rows = S.colors.map((c, i) => {
      if (!n[i]) return '';
      const yd = yardsFor(n[i]);
      const sk = Math.ceil(yd / YARN.skeinYards);
      totalYd += yd; totalSk += sk;
      return `<div class="yarn-row"><span class="dot" style="background:${swatchBg(c)}"></span>
        <span>${esc(c.name)}</span><span class="n">${Math.round(yd)} yd · ${sk} sk</span></div>`;
    }).join('');
    els.yarnTable.innerHTML = rows +
      `<div class="yarn-row total"><span></span><span>Total</span><span class="n">${Math.round(totalYd)} yd · ${totalSk} sk</span></div>`;
  }

  function renderRow() {
    els.rowNum.max = S.rows;
    els.rowNum.value = S.row;
    const r = S.row - 1;
    // Right-handed: row 1 (and every odd row) is worked right to left.
    const rtl = S.row % 2 === 1;
    const runs = [];
    for (let k = 0; k < S.cols; k++) {
      const x = rtl ? S.cols - 1 - k : k;
      const v = S.cells[r * S.cols + x];
      const last = runs[runs.length - 1];
      if (last && last.v === v) last.n++; else runs.push({ v, n: 1 });
    }
    const st = STITCHES[S.stitch].label;
    els.rowReadout.innerHTML =
      `<div class="dir">Row ${S.row} of ${S.rows} · worked ${rtl ? 'right → left' : 'left → right'} (right-handed)</div>` +
      `<ol>${runs.map((u) => `<li><span class="dot" style="background:${swatchBg(S.colors[u.v])}"></span>${u.n} ${st} ${esc(S.colors[u.v].name)}</li>`).join('')}</ol>`;
  }

  function refreshAfterEdit() {
    requestRender(); renderColors(); renderYarn(); renderRow(); save();
  }

  // ---------- inputs ----------

  function syncInputs() {
    els.projName.value = S.name;
    els.widthIn.value = S.widthIn; els.heightIn.value = S.heightIn;
    els.sizePreset.value = [...els.sizePreset.options].some((o) => o.value === S.preset) ? S.preset : 'custom';
    els.stitch.value = S.stitch;
    els.hookMm.value = S.hookMm; els.labelHookMm.value = S.labelHookMm;
    els.useSwatch.checked = S.useSwatch; els.swSts.value = S.swSts; els.swRows.value = S.swRows;
    els.zoom.value = S.zoom; els.showGrid.checked = S.showGrid; els.crafting.checked = S.crafting;
  }

  function onDimsChange(mode) {
    pushUndo();
    applyDims(mode);
    renderAll(); save();
  }

  els.projName.addEventListener('input', () => { S.name = els.projName.value; save(); });
  els.sizePreset.addEventListener('change', () => {
    S.preset = els.sizePreset.value;
    if (S.preset !== 'custom') {
      const [w, h] = S.preset.split('x').map(Number);
      S.widthIn = w; S.heightIn = h; syncInputs(); onDimsChange('crop');
    } else save();
  });
  for (const el of [els.widthIn, els.heightIn]) el.addEventListener('change', () => {
    const w = +els.widthIn.value, h = +els.heightIn.value;
    if (!(w >= 4 && h >= 4)) { syncInputs(); return; }
    S.widthIn = Math.min(200, w); S.heightIn = Math.min(200, h); S.preset = 'custom';
    syncInputs(); onDimsChange('crop');
  });
  els.stitch.addEventListener('change', () => { S.stitch = els.stitch.value; onDimsChange('resample'); });
  for (const [el, key] of [[els.hookMm, 'hookMm'], [els.labelHookMm, 'labelHookMm'], [els.swSts, 'swSts'], [els.swRows, 'swRows']])
    el.addEventListener('change', () => {
      const v = +el.value;
      if (!(v > 0)) { syncInputs(); return; }
      S[key] = v; onDimsChange('resample');
    });
  els.useSwatch.addEventListener('change', () => { S.useSwatch = els.useSwatch.checked; onDimsChange('resample'); });

  els.zoom.addEventListener('input', () => { setZoom(+els.zoom.value); });
  function setZoom(z, anchor) {
    const wrap = els.wrap;
    const old = S.zoom;
    S.zoom = Math.min(4, Math.max(0.25, z));
    els.zoom.value = S.zoom;
    const ax = anchor ? anchor.x : wrap.clientWidth / 2, ay = anchor ? anchor.y : wrap.clientHeight / 2;
    const fx = (wrap.scrollLeft + ax) / old, fy = (wrap.scrollTop + ay) / old;
    patternCache.clear(); sizeCanvases(); drawRulers(); render();
    wrap.scrollLeft = fx * S.zoom - ax; wrap.scrollTop = fy * S.zoom - ay;
    save();
  }
  els.fitBtn.addEventListener('click', () => {
    const { w, h } = stitchSize(S);
    const availW = els.wrap.clientWidth - RULER - 40, availH = els.wrap.clientHeight - RULER - 40;
    const z = Math.min(availW / (S.cols * w * BASE_PX_PER_IN), availH / (S.rows * h * BASE_PX_PER_IN));
    setZoom(z);
    els.wrap.scrollLeft = 0; els.wrap.scrollTop = 0;
  });
  els.showGrid.addEventListener('change', () => { S.showGrid = els.showGrid.checked; requestRender(); save(); });
  els.crafting.addEventListener('change', () => { S.crafting = els.crafting.checked; requestRender(); save(); });

  function setRow(n) {
    S.row = Math.min(S.rows, Math.max(1, n | 0));
    renderRow(); requestRender(); save();
  }
  els.rowUp.addEventListener('click', () => setRow(S.row + 1));
  els.rowDown.addEventListener('click', () => setRow(S.row - 1));
  els.rowNum.addEventListener('change', () => setRow(+els.rowNum.value));

  // colors panel
  els.projColors.addEventListener('click', (e) => {
    const t = e.target;
    if (t.dataset.edit !== undefined) return; // color input handles itself
    if (t.dataset.swap !== undefined) {
      const i = +t.dataset.swap;
      swapTarget = swapTarget === i ? -1 : i;
      els.status.textContent = swapTarget >= 0 ? `Pick a shade to replace ${S.colors[i].name}` : '';
      renderColors(); return;
    }
    if (t.dataset.del !== undefined) {
      const i = +t.dataset.del;
      pushUndo();
      for (let k = 0; k < S.cells.length; k++) {
        if (S.cells[k] === i) S.cells[k] = 0;
        else if (S.cells[k] > i) S.cells[k]--;
      }
      S.colors.splice(i, 1);
      if (S.active === i) S.active = 0; else if (S.active > i) S.active--;
      swapTarget = -1;
      renderCatalog(); refreshAfterEdit(); return;
    }
    const row = t.closest('.pc');
    if (row) { S.active = +row.dataset.i; renderColors(); requestRender(); save(); }
  });
  let editing = -1;
  els.projColors.addEventListener('input', (e) => {
    const i = e.target.dataset.edit;
    if (i === undefined) return;
    if (editing !== +i) { pushUndo(); editing = +i; }
    S.colors[+i].hex = [e.target.value];
    patternCache.clear();
    const chip = e.target.parentElement; chip.style.background = e.target.value;
    requestRender(); renderYarn(); renderRow(); save();
  });
  els.projColors.addEventListener('change', (e) => {
    if (e.target.dataset.edit !== undefined) { editing = -1; renderColors(); }
  });

  function addOrSwapColor(col) {
    if (swapTarget >= 0) {
      pushUndo();
      S.colors[swapTarget] = copyColor(col);
      S.active = swapTarget;
      swapTarget = -1;
      els.status.textContent = '';
      patternCache.clear();
    } else {
      const existing = S.colors.findIndex((c) => c.name === col.name);
      if (existing >= 0) { S.active = existing; }
      else {
        if (S.colors.length >= 250) return;
        pushUndo();
        S.colors.push(copyColor(col));
        S.active = S.colors.length - 1;
      }
    }
    renderCatalog(); refreshAfterEdit();
  }
  els.catalog.addEventListener('click', (e) => {
    const i = e.target.dataset.cat;
    if (i !== undefined) addOrSwapColor(CATALOG[+i]);
  });
  els.catSearch.addEventListener('input', renderCatalog);
  els.customColor.addEventListener('change', () => {
    const hex = els.customColor.value;
    addOrSwapColor({ name: 'Custom ' + hex.toUpperCase(), code: '', hex: [hex] });
  });

  // ---------- tools ----------

  let tool = 'brush', spaceHeld = false;
  function setTool(t) {
    tool = t;
    for (const b of els.tools.querySelectorAll('button')) b.classList.toggle('on', b.dataset.tool === t);
    els.grid.style.cursor = t === 'pan' ? 'grab' : t === 'pick' ? 'copy' : 'crosshair';
    els.grid.style.touchAction = t === 'pan' ? 'pan-x pan-y pinch-zoom' : 'none';
  }
  els.tools.addEventListener('click', (e) => { const t = e.target.closest('button'); if (t) setTool(t.dataset.tool); });

  function cellAt(e) {
    const rect = els.grid.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cw);
    const yTop = Math.floor((e.clientY - rect.top) / ch);
    const r = S.rows - 1 - yTop;
    if (x < 0 || x >= S.cols || r < 0 || r >= S.rows) return null;
    return { x, r };
  }

  function mirrored(x, r) {
    const pts = [[x, r]];
    if (els.mirrorX.checked) pts.push([S.cols - 1 - x, r]);
    if (els.mirrorY.checked) for (const [px] of pts.slice()) pts.push([px, S.rows - 1 - r]);
    return pts;
  }

  function stamp(x, r, fn) {
    const size = tool === 'brush' || tool === 'erase' ? +els.brushSize.value : 1;
    const o = Math.floor((size - 1) / 2);
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) {
        const cx = x - o + dx, cr = r - o + dy;
        if (cx < 0 || cx >= S.cols || cr < 0 || cr >= S.rows) continue;
        for (const [mx, mr] of mirrored(cx, cr)) fn(mr * S.cols + mx);
      }
  }

  function lineCells(a, b) {
    const out = [];
    let x0 = a.x, y0 = a.r; const x1 = b.x, y1 = b.r;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      out.push({ x: x0, r: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return out;
  }

  function shapeCells(a, b) {
    const set = new Set();
    const add = (x, r) => { for (const [mx, mr] of mirrored(x, r)) set.add(mr * S.cols + mx); };
    if (tool === 'rect') {
      for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++)
        for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) add(x, r);
    } else {
      for (const p of lineCells(a, b)) add(p.x, p.r);
    }
    return set;
  }

  function floodFill(x, r, val) {
    const from = S.cells[r * S.cols + x];
    if (from === val) return;
    const stack = [r * S.cols + x];
    while (stack.length) {
      const i = stack.pop();
      if (S.cells[i] !== from) continue;
      S.cells[i] = val;
      const cx = i % S.cols, cr = (i / S.cols) | 0;
      if (cx > 0) stack.push(i - 1);
      if (cx < S.cols - 1) stack.push(i + 1);
      if (cr > 0) stack.push(i - S.cols);
      if (cr < S.rows - 1) stack.push(i + S.cols);
    }
  }

  let drag = null;
  els.grid.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const active = spaceHeld ? 'pan' : tool;
    if (active === 'pan') {
      if (e.pointerType === 'touch') return; // native scrolling
      drag = { pan: true, x: e.clientX, y: e.clientY, sl: els.wrap.scrollLeft, st: els.wrap.scrollTop };
      els.grid.setPointerCapture(e.pointerId); els.grid.style.cursor = 'grabbing';
      return;
    }
    const p = cellAt(e); if (!p) return;
    els.grid.setPointerCapture(e.pointerId);
    if (active === 'pick') {
      S.active = S.cells[p.r * S.cols + p.x]; renderColors(); save(); setTool('brush'); return;
    }
    pushUndo();
    if (active === 'fill') {
      for (const [mx, mr] of mirrored(p.x, p.r)) floodFill(mx, mr, S.active);
      refreshAfterEdit(); return;
    }
    if (active === 'rect' || active === 'line') {
      drag = { start: p, shape: true };
      preview = shapeCells(p, p); requestRender(); return;
    }
    const markVal = active === 'mark' ? (S.marks[p.r * S.cols + p.x] ? 0 : 1) : 0;
    drag = { last: p, markVal };
    paintAt(p, active, markVal);
    requestRender();
  });

  function paintAt(p, active, markVal) {
    stamp(p.x, p.r, (i) => {
      if (active === 'mark') S.marks[i] = markVal;
      else S.cells[i] = active === 'erase' ? 0 : S.active;
    });
  }

  els.grid.addEventListener('pointermove', (e) => {
    const p = cellAt(e);
    if (p) {
      const { w, h } = stitchSize(S);
      const c = S.colors[S.cells[p.r * S.cols + p.x]];
      els.status.textContent = `Stitch ${p.x + 1} · Row ${p.r + 1} · ${c.name}` +
        ` · ${fmt(p.x * w)}″ from left, ${fmt(p.r * h)}″ from bottom`;
    }
    if (!drag) return;
    if (drag.pan) {
      els.wrap.scrollLeft = drag.sl - (e.clientX - drag.x);
      els.wrap.scrollTop = drag.st - (e.clientY - drag.y);
      return;
    }
    if (!p) return;
    if (drag.shape) { preview = shapeCells(drag.start, p); requestRender(); return; }
    for (const q of lineCells(drag.last, p)) paintAt(q, tool, drag.markVal);
    drag.last = p;
    requestRender();
  });

  function endDrag() {
    if (!drag) return;
    if (drag.pan) { els.grid.style.cursor = 'grab'; }
    else if (drag.shape && preview) {
      for (const i of preview) S.cells[i] = S.active;
      preview = null;
    }
    const wasPaint = !drag.pan;
    drag = null;
    if (wasPaint) refreshAfterEdit();
  }
  els.grid.addEventListener('pointerup', endDrag);
  els.grid.addEventListener('pointercancel', () => { preview = null; endDrag(); });
  els.grid.addEventListener('pointerleave', () => { if (!drag) els.status.textContent = `${S.cols} × ${S.rows} stitches`; });
  els.grid.addEventListener('dblclick', (e) => { const p = cellAt(e); if (p) setRow(p.r + 1); });

  els.wrap.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const rect = els.wrap.getBoundingClientRect();
    setZoom(S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, { passive: false });

  const KEYS = { b: 'brush', f: 'fill', r: 'rect', l: 'line', i: 'pick', m: 'mark', e: 'erase', h: 'pan' };
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox' && document.activeElement.type !== 'range';
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (typing) return;
      e.preventDefault(); e.shiftKey ? redo() : undo(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { if (!typing) { e.preventDefault(); redo(); } return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') { spaceHeld = true; els.grid.style.cursor = 'grab'; e.preventDefault(); return; }
    if (KEYS[e.key.toLowerCase()]) { setTool(KEYS[e.key.toLowerCase()]); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setRow(S.row + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setRow(S.row - 1); }
    if (e.key === 'Escape') { swapTarget = -1; renderColors(); }
  });
  document.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceHeld = false; setTool(tool); } });

  els.undoBtn.addEventListener('click', undo);
  els.redoBtn.addEventListener('click', redo);

  // ---------- files ----------

  function slug() { return (S.name || 'blanket').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'blanket'; }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  els.exportJson.addEventListener('click', () => {
    download(new Blob([serialize(S)], { type: 'application/json' }), slug() + '.json');
  });
  els.importJson.addEventListener('change', async () => {
    const f = els.importJson.files[0]; if (!f) return;
    try {
      const s = deserialize(await f.text());
      pushUndo(); S = s; syncInputs(); renderAll(); save();
    } catch (err) { alert('Could not open that file: ' + err.message); }
    els.importJson.value = '';
  });
  els.newBtn.addEventListener('click', () => {
    if (!confirm('Start a new blanket? You can undo this.')) return;
    pushUndo();
    const keep = { widthIn: S.widthIn, heightIn: S.heightIn, preset: S.preset, stitch: S.stitch, hookMm: S.hookMm,
      labelHookMm: S.labelHookMm, useSwatch: S.useSwatch, swSts: S.swSts, swRows: S.swRows, zoom: S.zoom };
    S = { ...defaultState(), ...keep };
    const { cols, rows } = gridDims(S);
    S.cols = cols; S.rows = rows; S.cells = new Uint8Array(cols * rows); S.marks = new Uint8Array(cols * rows);
    syncInputs(); renderAll(); save();
  });

  els.exportPng.addEventListener('click', () => {
    const { w, h } = stitchSize(S);
    const ppi = Math.max(8, Math.min(30, 2400 / Math.max(S.cols * w, S.rows * h)));
    const sw = w * ppi, sh = h * ppi;
    const W = Math.ceil(S.cols * sw), H = Math.ceil(S.rows * sh);
    const pad = 24, n = counts();
    const used = S.colors.map((c, i) => ({ c, i })).filter((u) => n[u.i]);
    const legendH = 70 + used.length * 22;
    const cv = document.createElement('canvas');
    cv.width = Math.max(W + pad * 2, 520); cv.height = H + pad * 2 + legendH;
    const c = cv.getContext('2d');
    c.fillStyle = '#fffdf8'; c.fillRect(0, 0, cv.width, cv.height);
    c.save(); c.translate(pad, pad);
    patternCache.clear();
    const saveDpr = dpr; dpr = 1;
    drawGrid(c, { cw: sw, ch: sh, grid: true, scale: 1 });
    dpr = saveDpr; patternCache.clear();
    c.restore();
    c.fillStyle = '#2b2723'; c.font = '600 16px system-ui, sans-serif';
    let y = pad + H + 30;
    c.fillText(S.name || 'Blanket', pad, y);
    c.font = '13px system-ui, sans-serif'; c.fillStyle = '#5a534b'; y += 20;
    c.fillText(`${S.cols} st × ${S.rows} rows ${STITCHES[S.stitch].label} · ≈ ${fmt(S.cols * w)}″ × ${fmt(S.rows * h)}″ · ${YARN.brand} ${YARN.name}, ${fmt(S.hookMm, 2)} mm hook`, pad, y);
    y += 8;
    for (const { c: col, i } of used) {
      y += 22;
      c.fillStyle = fillFor(col, c); c.fillRect(pad, y - 13, 16, 16);
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.strokeRect(pad + 0.5, y - 12.5, 15, 15);
      const yd = yardsFor(n[i]);
      c.fillStyle = '#2b2723';
      c.fillText(`${col.name}${col.code ? ' (' + col.code + ')' : ''} — ${n[i]} st · ~${Math.round(yd)} yd · ${Math.ceil(yd / YARN.skeinYards)} skein(s)`, pad + 24, y);
    }
    patternCache.clear();
    cv.toBlob((b) => download(b, slug() + '.png'), 'image/png');
  });

  // ---------- boot ----------

  syncInputs();
  setTool('brush');
  updateUndoButtons();
  renderAll();
  window.addEventListener('resize', () => { drawRulers(); });
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { drawRulers(); render(); });
  }
})();
