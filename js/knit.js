// The focus piece: a Norwegian-style swatch with two Selbu roses,
// knitted stitch by stitch on a canvas as the session progresses.

const STAR = [
  '........X........',
  '.......XXX.......',
  '..XX...XXX...XX..',
  '..XXX..XXX..XXX..',
  '...XXX.XXX.XXX...',
  '....XX.XXX.XX....',
  '.................',
  '.XXXXX.....XXXXX.',
  'XXXXXX..X..XXXXXX',
  '.XXXXX.....XXXXX.',
  '.................',
  '....XX.XXX.XX....',
  '...XXX.XXX.XXX...',
  '..XXX..XXX..XXX..',
  '..XX...XXX...XX..',
  '.......XXX.......',
  '........X........',
];

export const COLS = 35;

const plain   = () => false;
const lice    = r => c => (r % 4 === 1 && c % 4 === 1) || (r % 4 === 3 && c % 4 === 3);
const checker = k => c => c % 2 === k;
const zigzag  = k => c => Math.abs((c % 4) - 2) === k;
const star    = r => c => c !== 17 && STAR[r][c < 17 ? c : c - 18] === 'X';

// Visual order, top to bottom. Knitting starts at the bottom row.
const ROW_FNS = [
  ...[0, 1, 2, 3].map(lice), plain,
  checker(0), checker(1), plain,
  zigzag(0), zigzag(1), zigzag(2), plain,
  ...STAR.map((_, r) => star(r)),
  plain, zigzag(2), zigzag(1), zigzag(0),
  plain, checker(1), checker(0),
  plain, ...[0, 1, 2, 3].map(lice),
].reverse();

export const ROWS = ROW_FNS.length;
export const TOTAL = ROWS * COLS;

const PATTERN = ROW_FNS.map(fn => Array.from({ length: COLS }, (_, c) => fn(c)));

function tokens(el) {
  const cs = getComputedStyle(el);
  const v = name => cs.getPropertyValue(name).trim();
  return {
    base: v('--knit-base'), motif: v('--knit-motif'),
    ghost: v('--knit-ghost'), ghostMotif: v('--knit-ghost-motif'),
    needle: v('--knit-needle'),
  };
}

/** Draw the piece at progress p (0…1). `faded` dims the work (an interrupted session). */
export function drawKnit(canvas, p, { faded = false } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 300;
  const w = cssW / COLS, h = w * 0.8;
  const top = h * 2.4;                       // room for the needle
  const cssH = top + ROWS * h + h * 0.4;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const t = tokens(canvas);
  const done = Math.max(0, Math.min(TOTAL, Math.floor(p * TOTAL)));
  const rowsDone = Math.floor(done / COLS);
  const inRow = done % COLS;

  const isKnit = (r, c) => {
    if (r < rowsDone) return true;
    if (r > rowsDone) return false;
    return r % 2 === 0 ? c < inRow : c >= COLS - inRow;   // back and forth, like flat knitting
  };

  const paths = { base: new Path2D(), motif: new Path2D(), ghost: new Path2D(), ghostMotif: new Path2D() };
  for (let r = 0; r < ROWS; r++) {
    const y = top + (ROWS - 1 - r) * h;
    for (let c = 0; c < COLS; c++) {
      const x = c * w;
      const motif = PATTERN[r][c];
      const key = isKnit(r, c) ? (motif ? 'motif' : 'base') : (motif ? 'ghostMotif' : 'ghost');
      const path = paths[key];
      path.moveTo(x + w * 0.2, y + h * 0.15);
      path.lineTo(x + w * 0.5, y + h * 0.85);
      path.lineTo(x + w * 0.8, y + h * 0.15);
    }
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = w * 0.36;
  ctx.globalAlpha = 1;
  ctx.strokeStyle = t.ghost;      ctx.stroke(paths.ghost);
  ctx.strokeStyle = t.ghostMotif; ctx.stroke(paths.ghostMotif);
  ctx.globalAlpha = faded ? 0.45 : 1;
  ctx.strokeStyle = t.base;       ctx.stroke(paths.base);
  ctx.strokeStyle = t.motif;      ctx.stroke(paths.motif);
  ctx.globalAlpha = 1;

  if (done >= TOTAL || faded) return;

  // Needle resting just above the row being worked, with yarn to the last stitch.
  const rowY = top + (ROWS - 1 - rowsDone) * h;
  const ny = rowY - h * 0.35;
  ctx.strokeStyle = t.needle;
  ctx.lineWidth = Math.max(1.5, w * 0.22);
  ctx.beginPath();
  ctx.moveTo(-2, ny);
  ctx.lineTo(cssW - w * 0.6, ny);
  ctx.stroke();
  ctx.fillStyle = t.needle;
  ctx.beginPath();
  ctx.arc(cssW - w * 0.6, ny, Math.max(2.5, w * 0.32), 0, Math.PI * 2);
  ctx.fill();

  if (done > 0) {
    const leftToRight = rowsDone % 2 === 0;
    const lastC = inRow === 0
      ? (rowsDone % 2 === 1 ? COLS - 1 : 0)            // just finished a row; yarn at its end
      : (leftToRight ? inRow - 1 : COLS - inRow);
    const lastR = inRow === 0 ? rowsDone - 1 : rowsDone;
    const sx = lastC * w + w / 2;
    const sy = top + (ROWS - 1 - lastR) * h + h * 0.2;
    ctx.strokeStyle = t.base;
    ctx.lineWidth = Math.max(1, w * 0.14);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + w * 0.8, (sy + ny) / 2, sx + w * 0.3, ny);
    ctx.stroke();
  }
}
