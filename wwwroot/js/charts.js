// =========================================================
//  Графики на SVG без сторонних библиотек.
//  Анимация: столбики растут снизу.
// =========================================================

/** «Красивый» шаг сетки для оси Y */
function niceStep(max, ticks = 5) {
  const raw = max / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}

function shortMoney(v) {
  if (v === 0) return '0';
  if (v >= 1000) return (Math.round(v / 100) / 10).toString().replace('.', ',') + ' тыс';
  return String(Math.round(v));
}

/** Прямоугольник со скруглёнными верхними углами */
function barPath(x, yTop, w, h, r, fill, i) {
  if (h <= 0) return '';
  const d = `M${x},${yTop + h} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${yTop + h} Z`;
  return `<path class="bar" data-i="${i}" style="--i:${i};fill:${fill}" d="${d}"/>`;
}

/**
 * Столбчатая диаграмма по месяцам.
 * items: [{ label, fullLabel, paid, forecast, highlight }]
 */
function renderBarChart(el, items) {
  const W = Math.max(el.clientWidth, 320), H = 240;
  const left = 48, right = 4, top = 16, bottom = 28;
  const plotW = W - left - right, plotH = H - top - bottom;
  const maxVal = Math.max(...items.map((i) => i.paid + i.forecast), 1);
  const step = niceStep(maxVal);
  const yMax = Math.ceil(maxVal / step) * step;
  const y = (v) => top + plotH - (v / yMax) * plotH;
  const slot = plotW / items.length;
  const bw = Math.min(32, slot * 0.55);

  let svg = `<svg class="bar-chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Расходы по месяцам">
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" style="fill:var(--accent-soft)"/><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--accent)" stroke-width="2" opacity=".45"/></pattern></defs>`;

  // Горизонтальные линии сетки и подписи оси
  for (let v = 0; v <= yMax + 0.001; v += step) {
    const yy = Math.round(y(v)) + 0.5;
    svg += `<line x1="${left}" x2="${W - right}" y1="${yy}" y2="${yy}" style="stroke:var(${v === 0 ? '--border-strong' : '--border'})"/>
            <text x="0" y="${yy + 4}">${shortMoney(v)}</text>`;
  }

  // На узком экране (телефон) подписываем месяцы через один, считая от текущего
  const hi = Math.max(items.findIndex((it) => it.highlight), 0);
  const everyOther = slot < 34;

  // Столбики: оплаченная часть + прогноз (штриховка)
  items.forEach((it, i) => {
    const x = left + slot * i + (slot - bw) / 2;
    const total = it.paid + it.forecast;
    if (it.paid > 0) {
      const yTop = y(it.paid), h = y(0) - yTop;
      svg += barPath(x, yTop, bw, h, it.forecast > 0 ? 0 : Math.min(8, h), it.highlight ? 'var(--accent)' : 'var(--chart-bar)', i);
    }
    if (it.forecast > 0) {
      const yTop = y(total), h = y(it.paid) - yTop;
      svg += barPath(x, yTop, bw, h, Math.min(8, h), 'url(#hatch)', i);
    }
    if (!everyOther || (i - hi) % 2 === 0) {
      svg += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" style="${it.highlight ? 'fill:var(--ink);font-weight:500' : ''}">${it.label}</text>`;
    }
  });

  el.innerHTML = svg + '</svg>';

  // Подсказка при наведении на столбик
  $$('.bar', el).forEach((b) => {
    const it = items[+b.dataset.i];
    b.addEventListener('mousemove', (e) => {
      const parts = [];
      if (it.paid) parts.push('оплачено ' + Fmt.money(it.paid));
      if (it.forecast) parts.push('прогноз ' + Fmt.money(it.forecast));
      Tooltip.show(`${it.fullLabel}: ${parts.join(', ') || '0 ₽'}`, e.clientX, e.clientY);
    });
    b.addEventListener('mouseleave', () => Tooltip.hide());
  });
}
