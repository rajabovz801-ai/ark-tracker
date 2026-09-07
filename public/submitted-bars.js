(() => {
  'use strict';

  const STYLE_ID = 'ark-submitted-bars-style';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ark-submitted-bars{min-width:760px;height:248px;display:grid;grid-template-columns:repeat(20,minmax(26px,1fr));gap:9px;align-items:end;padding:10px 8px 0 4px}
      .ark-submitted-bar-item{height:238px;display:grid;grid-template-rows:28px 180px 22px;align-items:end;text-align:center;min-width:0}
      .ark-submitted-bar-value{font-size:12px;font-weight:800;color:#5f6670;line-height:1;white-space:nowrap}
      .ark-submitted-bar-track{height:180px;border-radius:10px 10px 4px 4px;background:linear-gradient(to top,#f0f2f4,#fafbfc);border:1px solid #eceef1;display:flex;align-items:flex-end;overflow:hidden;position:relative}
      .ark-submitted-bar-track::before,.ark-submitted-bar-track::after{content:'';position:absolute;left:0;right:0;height:1px;background:#e4e7eb;pointer-events:none}
      .ark-submitted-bar-track::before{top:50%}
      .ark-submitted-bar-track::after{top:25%}
      .ark-submitted-bar-fill{width:100%;min-height:4px;background:linear-gradient(180deg,#54c98a,#35b66f);border-radius:8px 8px 3px 3px;box-shadow:0 6px 16px rgba(53,182,111,.18);transition:height .25s ease}
      .ark-submitted-bar-item[data-value='100'] .ark-submitted-bar-fill{background:linear-gradient(180deg,#2fb46a,#199454)}
      .ark-submitted-bar-label{font-size:11px;font-weight:700;color:#7f858e;line-height:1;padding-top:7px}
      .ark-submitted-bar-item.is-rest .ark-submitted-bar-value{color:#b0b4ba}
      .ark-submitted-bar-item.is-rest .ark-submitted-bar-track{background:repeating-linear-gradient(135deg,#f5f6f7,#f5f6f7 7px,#eceef0 7px,#eceef0 14px)}
      .ark-submitted-bar-item.is-rest .ark-submitted-bar-label{color:#b4b8be}
      .ark-submitted-bars-scale{position:absolute;left:0;top:18px;bottom:34px;width:39px;display:flex;flex-direction:column;justify-content:space-between;font-size:10px;font-weight:700;color:#a1a6ad;text-align:right;padding-right:7px;pointer-events:none}
      .twenty-day-chart.ark-bars-ready{height:282px!important;padding:0 0 0 42px!important;overflow-x:auto;overflow-y:hidden}
      .twenty-day-chart.ark-bars-ready>svg,.twenty-day-chart.ark-bars-ready>.chart-y,.twenty-day-chart.ark-bars-ready>.chart-x{display:none!important}
      @media(max-width:700px){.ark-submitted-bars{min-width:720px;gap:7px}.ark-submitted-bar-value{font-size:11px}.ark-submitted-bar-label{font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function valueFromCircle(circle) {
    if (!circle) return 0;
    const cy = Number(circle.getAttribute('cy'));
    if (!Number.isFinite(cy)) return 0;
    const top = 24;
    const bottom = 196;
    const raw = ((bottom - cy) / (bottom - top)) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  function makeBar(item) {
    const wrap = document.createElement('div');
    wrap.className = `ark-submitted-bar-item${item.rest ? ' is-rest' : ''}`;
    if (!item.rest) wrap.dataset.value = String(item.value);

    const value = document.createElement('div');
    value.className = 'ark-submitted-bar-value';
    value.textContent = item.rest ? 'REST' : `${item.value}%`;

    const track = document.createElement('div');
    track.className = 'ark-submitted-bar-track';

    if (!item.rest) {
      const fill = document.createElement('div');
      fill.className = 'ark-submitted-bar-fill';
      fill.style.height = `${Math.max(item.value, 2)}%`;
      track.appendChild(fill);
      wrap.title = `${item.label} — ${item.value}% submitted`;
    } else {
      wrap.title = `${item.label} — Sunday`;
    }

    const label = document.createElement('div');
    label.className = 'ark-submitted-bar-label';
    label.textContent = item.label;

    wrap.append(value, track, label);
    return wrap;
  }

  function render(chart) {
    const svg = chart.querySelector('svg');
    const labels = Array.from(chart.querySelectorAll('.twenty-labels span'));
    if (!svg || labels.length === 0) return;

    const dots = Array.from(svg.querySelectorAll('circle.progress-dot'));
    let dotIndex = 0;
    const data = labels.map(label => {
      const rest = label.classList.contains('rest-label');
      if (rest) return { label: label.textContent.trim(), rest: true, value: 0 };
      const circle = dots[dotIndex++];
      return { label: label.textContent.trim(), rest: false, value: valueFromCircle(circle) };
    });

    let bars = chart.querySelector('.ark-submitted-bars');
    if (!bars) {
      bars = document.createElement('div');
      bars.className = 'ark-submitted-bars';
      chart.appendChild(bars);
    }

    const signature = data.map(d => d.rest ? 'R' : d.value).join('|');
    if (bars.dataset.signature === signature) {
      chart.classList.add('ark-bars-ready');
      return;
    }

    bars.dataset.signature = signature;
    bars.replaceChildren(...data.map(makeBar));

    let scale = chart.querySelector('.ark-submitted-bars-scale');
    if (!scale) {
      scale = document.createElement('div');
      scale.className = 'ark-submitted-bars-scale';
      ['100%','75%','50%','25%','0%'].forEach(text => {
        const span = document.createElement('span');
        span.textContent = text;
        scale.appendChild(span);
      });
      chart.appendChild(scale);
    }

    chart.classList.add('ark-bars-ready');
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureStyles();
      document.querySelectorAll('.twenty-day-chart').forEach(render);
    });
  }

  const observer = new MutationObserver(mutations => {
    const relevant = mutations.some(m => {
      const el = m.target && m.target.nodeType === 1 ? m.target : m.target?.parentElement;
      return !el?.closest?.('.ark-submitted-bars');
    });
    if (relevant) schedule();
  });

  function start() {
    ensureStyles();
    schedule();
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['cy']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
