/* quant-teacher-lib v0.1.0，MIT 授權。講量化算式用的小函式庫：算數字、排公式、畫互動圖。 */
(function (root) {
  'use strict';
  var KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/';
  var SRI = {
    js: 'sha384-a1WQdjRj162i159OYq041X6I4K8NenkrI09LlPmiHg0YOb7CR+wJOraXwK9abpnE',
    css: 'sha384-WwGtaC6ywCHxA5cstpj/3+xIZvTez8dq2IcBQaXRkenHZ7FVVq1ZROtURwfbtTlG'
  };

  // ---------- 算數字：同一天全部股票橫的比 ----------
  // null、undefined、NaN、Infinity 都當沒有數字，輸出 NaN，也不算進家數。
  function ok(v) { return typeof v === 'number' && isFinite(v); }

  // rank：最小 0、最大 1、中間平均分；同分取名次平均。只有一家或全部同分得 0.5。
  // ponytail: 同分取平均是推論，官方頁沒寫同分怎麼排。
  function rank(xs) {
    var idx = [];
    xs.forEach(function (v, i) { if (ok(v)) idx.push(i); });
    idx.sort(function (a, b) { return xs[a] - xs[b]; });
    var out = xs.map(function () { return NaN; }), n = idx.length;
    for (var i = 0; i < n;) {
      var j = i;
      while (j + 1 < n && xs[idx[j + 1]] === xs[idx[i]]) j++;
      for (var t = i; t <= j; t++) out[idx[t]] = n === 1 ? 0.5 : (i + j) / 2 / (n - 1);
      i = j + 1;
    }
    return out;
  }

  // scale：除以絕對值的和，絕對值加起來是 s。全部是 0 時回全部 0，不回 NaN。
  function scale(xs, s) {
    if (s === undefined) s = 1;
    var sum = xs.reduce(function (a, v) { return ok(v) ? a + Math.abs(v) : a; }, 0);
    return xs.map(function (v) { return !ok(v) ? NaN : sum === 0 ? 0 : v * s / sum; });
  }

  // neutralize：減平均。給 groups 就是減同組平均，也就是 group_neutralize。
  function neutralize(xs, groups) {
    var g = groups || xs.map(function () { return 0; }), sum = Object.create(null), cnt = Object.create(null);
    xs.forEach(function (v, i) {
      if (!ok(v)) return;
      sum[g[i]] = (sum[g[i]] || 0) + v; cnt[g[i]] = (cnt[g[i]] || 0) + 1;
    });
    return xs.map(function (v, i) { return ok(v) ? v - sum[g[i]] / cnt[g[i]] : NaN; });
  }

  // ---------- 算數字：同一檔直的看，陣列由舊到新，d 是開盤日數 ----------
  // 前面不滿 d 天，或窗內有沒數字的天，那天輸出 NaN。
  // ponytail: 窗內有 NaN 就整格 NaN，平台可能略過 NaN 照算，要對平台逐格時再改。
  function roll(xs, d, f) {
    return xs.map(function (v, t) {
      if (t + 1 < d) return NaN;
      var w = xs.slice(t - d + 1, t + 1);
      return w.every(ok) ? f(w, t) : NaN;
    });
  }
  function mean(w) { return w.reduce(function (a, v) { return a + v; }, 0) / w.length; }
  function std(w) { var m = mean(w); return Math.sqrt(mean(w.map(function (v) { return (v - m) * (v - m); }))); }

  function flat(w) { return w.every(function (v) { return v === w[0]; }); }

  function tsMean(xs, d) { return roll(xs, d, mean); }
  // ts_std_dev：除以 d 的標準差。
  function tsStdDev(xs, d) { return roll(xs, d, std); }

  // ts_decay_linear：今天乘 d、昨天乘 d−1，一直到乘 1，再除以 1 加到 d 的和。
  function decayLinear(xs, d) {
    return roll(xs, d, function (w) {
      return w.reduce(function (a, v, i) { return a + v * (i + 1); }, 0) / (d * (d + 1) / 2);
    });
  }

  // ts_rank：今天在 d 天裡從 0 數起排第幾，除以 d−1，再加 c。同分取平均，d 是 1 時得 0.5。
  function tsRank(xs, d, c) {
    return roll(xs, d, function (w) {
      var today = w[d - 1], less = 0, same = 0;
      w.forEach(function (v) { if (v < today) less++; else if (v === today) same++; });
      return (d === 1 ? 0.5 : (less + (same - 1) / 2) / (d - 1)) + (c || 0);
    });
  }

  // ts_corr：x 和 y 過去 d 天的相關。其中一邊 d 天都一樣時沒有相關，回 NaN。
  function corr(xs, ys, d) {
    return roll(xs.map(function (v, i) { return ok(ys[i]) ? v : NaN; }), d, function (w, t) {
      var y = ys.slice(t - d + 1, t + 1), mx = mean(w), my = mean(y), sx = std(w), sy = std(y);
      if (flat(w) || flat(y)) return NaN; // 不用 std 是 0 判斷，浮點誤差會算出極小的 std
      return mean(w.map(function (v, i) { return (v - mx) * (y[i] - my); })) / (sx * sy);
    });
  }

  // ts_arg_min：d 天裡最小那天距今幾天，今天是 0。
  // ponytail: 同樣最小時取離今天最近的那天，官方頁沒寫。
  function argMin(xs, d) {
    return roll(xs, d, function (w) {
      var best = d - 1;
      for (var i = d - 2; i >= 0; i--) if (w[i] < w[best]) best = i;
      return d - 1 - best;
    });
  }

  // ---------- 步驟圖和滑桿用的運算，op 名字對到這裡 ----------
  // 兩邊有一邊沒數字就沒數字；除以 0 這種算不出有限數字的也當沒數字，不偷偷變成 0。
  function zip(xs, k, f) {
    return xs.map(function (v, i) {
      var b = Array.isArray(k) ? k[i] : k, r = ok(v) && ok(b) ? f(v, b) : NaN;
      return ok(r) ? r : NaN;
    });
  }
  var OPS = {
    rank: rank, scale: scale, neutralize: neutralize,
    neg: function (xs) { return zip(xs, -1, function (a, b) { return a * b; }); },
    oneMinus: function (xs) { return zip(xs, 1, function (a, b) { return b - a; }); },
    rsub: function (xs, k) { return zip(xs, k, function (a, b) { return b - a; }); }, // k − x
    add: function (xs, k) { return zip(xs, k, function (a, b) { return a + b; }); },
    sub: function (xs, k) { return zip(xs, k, function (a, b) { return a - b; }); },
    mul: function (xs, k) { return zip(xs, k, function (a, b) { return a * b; }); },
    div: function (xs, k) { return zip(xs, k, function (a, b) { return a / b; }); }, // 除以 0 得沒數字
    min: function (xs, k) { return zip(xs, k, Math.min); }
  };

  // 算出一段每一步的值。步驟寫 values 就直接用；寫 op 就拿上一步，或 from 指定的那步，套進 OPS。
  // arg 寫成 {step: 第幾步} 就換成那一步的值，第幾步從 0 數起。
  function run(steps) {
    var vals = [];
    steps.forEach(function (s, i) {
      if (s.values) { vals.push(s.values.map(function (v) { return v === null ? NaN : v; })); return; }
      if (!OPS[s.op]) throw new Error('第 ' + (i + 1) + ' 步沒有 values，op 也不認得：' + s.op);
      var arg = s.arg && s.arg.step !== undefined ? vals[s.arg.step] : s.arg;
      vals.push(OPS[s.op](vals[s.from === undefined ? i - 1 : s.from], arg));
    });
    return vals;
  }
  // 滑桿用：ops 是 ['rank', ['mul', 2]] 這種串。
  function chain(xs, ops) {
    return ops.reduce(function (v, o) { return Array.isArray(o) ? OPS[o[0]](v, o[1]) : OPS[o](v); }, xs);
  }

  // ---------- 排公式 ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function katexOpts(display) {
    return { displayMode: !!display, throwOnError: false, strict: false,
      trust: function (c) { return c.command === '\\htmlClass'; } };
  }
  // k：把 TeX 排成 HTML 字串。KaTeX 還沒載好時先放原文，載好會自動換掉。
  function k(tex, display) {
    if (root.katex) return root.katex.renderToString(String(tex), katexOpts(display));
    return '<span class="tl-k" data-tex="' + esc(tex) + '" data-d="' + (display ? 1 : 0) + '">' + esc(tex) + '</span>';
  }
  function fmt(v) {
    if (!ok(v)) return '沒有數字';
    var r = Math.round(v * 1000) / 1000;
    return String(r === 0 ? 0 : r).replace('-', '−');
  }

  // ---------- 畫圖 ----------
  function sign(v) { return !ok(v) || v === 0 ? 0 : v > 0 ? 1 : -1; }
  function order(xs) { // 第幾高，1 是最高；沒數字的不排
    return xs.map(function (v) { return ok(v) ? 1 + xs.filter(function (u) { return ok(u) && u > v; }).length : NaN; });
  }
  function absMax(xs) { return Math.max.apply(null, xs.filter(ok).map(Math.abs).concat([1e-12])); }
  // max 給了就用同一把尺，滑桿左右兩邊才比得了長短
  function bars(names, cur, prev, flip, max) {
    max = max || absMax(cur.concat(prev || []));
    var oc = order(cur), op = prev && order(prev);
    return '<div class="tl-bars">' + names.map(function (n, i) {
      var v = cur[i], w = ok(v) ? Math.abs(v) / max * 50 : 0, cls = ['tl-zero', 'tl-pos', 'tl-neg'][(sign(v) + 3) % 3];
      var mark = prev && ok(prev[i]) ? '<i class="tl-prev" style="left:' + (50 + prev[i] / max * 50) + '%"></i>' : '';
      var tag = '';
      if (flip && prev) {
        var a = sign(prev[i]), b = sign(v);
        // ponytail: 只講正負和名次；是不是部位由步驟文字講，函式不知道這步的值是不是部位
        if (a && b && a !== b) tag = a > 0 ? '由正變負' : '由負變正';
        else if (ok(op[i]) && ok(oc[i]) && op[i] !== oc[i]) tag = '第 ' + op[i] + ' 高變第 ' + oc[i] + ' 高';
      }
      return '<div class="tl-row"><span class="tl-name">' + esc(n) + '</span><span class="tl-track"><i class="tl-mid"></i>' +
        '<i class="tl-bar ' + cls + '" style="left:' + (v < 0 ? 50 - w : 50) + '%;width:' + w + '%"></i>' + mark +
        '</span><span class="tl-val">' + fmt(v) + (tag ? '<em class="tl-flip">' + tag + '</em>' : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function box(el) { var e = typeof el === 'string' ? document.querySelector(el) : el; e.classList.add('tl'); return e; }
  function para(label, text) { return text ? '<p class="tl-p"><b>' + label + '</b>' + esc(text) + '</p>' : ''; }
  function defs(list) {
    return (list || []).map(function (p) {
      return '<div class="tl-def"><div class="tl-def-tex">' + (p.name ? '<b>' + esc(p.name) + '</b> ' : '') + k(p.tex) +
        '</div><div class="tl-def-text">' + esc(p.text || '') + '</div></div>';
    }).join('');
  }

  // cards：一個策略一張卡。卡片 {title, bet, formula, parts, subs, meaning, weakness}。
  function cards(el, list) {
    box(el).innerHTML = list.map(function (c) {
      return '<section class="tl-card"><h3>' + esc(c.title) + '</h3>' + para('在賭什麼：', c.bet) +
        '<div class="tl-formula">' + k(c.formula, true) + '</div>' +
        (c.parts && c.parts.length ? '<h4>零件和運算子</h4>' + defs(c.parts) : '') +
        (c.subs && c.subs.length ? '<h4>代入例子</h4>' + defs(c.subs) : '') +
        para('經濟意涵：', c.meaning) + para('弱點：', c.weakness) + '</section>';
    }).join('');
  }

  // steps：五支股票一步一步。{names, segments:[{title, full, parts, dim, steps:[{tex, text, values 或 op, arg, from, hl, flip}]}]}
  function steps(el, data) {
    el = box(el);
    var seg = 0, at = 0, cache = data.segments.map(function (s) { return run(s.steps); });
    function full(s, hl) {
      // 先標正在算的橘色，再標沒作用的灰色，灰色在橘色裡面也標得到
      var marks = (hl ? [[hl, 'tl-hl']] : []).concat((s.dim || []).map(function (d) { return [d.tex, 'tl-dim']; }));
      return (s.full || []).map(function (line) {
        marks.forEach(function (m) {
          line = line.split(m[0]).join('\\htmlClass{' + m[1] + '}{' + m[0] + '}');
        });
        return k(line, true);
      }).join('');
    }
    function draw() {
      var s = data.segments[seg], st = s.steps[at], v = cache[seg];
      // 灰線畫輸入那一步；直接給 values 的是新起頭，沒有上一步線
      var pi = st.from !== undefined ? st.from : st.values ? -1 : at - 1;
      el.innerHTML = '<div class="tl-tabs">' + data.segments.map(function (x, i) {
        return '<button data-seg="' + i + '"' + (i === seg ? ' class="tl-on"' : '') + '>' + esc(x.title) + '</button>';
      }).join('') + '</div>' +
        (s.full ? '<div class="tl-formula">' + full(s, st.hl) + '</div>' : '') +
        (s.dim || []).map(function (d) { return '<p class="tl-note">' + k(d.tex) + ' ' + esc(d.why) + '</p>'; }).join('') +
        defs(s.parts) +
        '<div class="tl-step">' + (st.flip ? '<span class="tl-tag">翻號</span>' : '') + k(st.tex || '', true) + '</div>' +
        '<p class="tl-p">' + esc(st.text || '') + '</p>' +
        bars(data.names, v[at], pi >= 0 ? v[pi] : null, st.flip) +
        '<div class="tl-nav"><button data-go="-1"' + (at ? '' : ' disabled') + '>上一步</button><span>第 ' + (at + 1) + ' 步，共 ' +
        s.steps.length + ' 步</span><button data-go="1"' + (at < s.steps.length - 1 ? '' : ' disabled') + '>下一步</button></div>';
    }
    el.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.seg !== undefined) { seg = +b.dataset.seg; at = 0; } else at += +b.dataset.go;
      draw();
    };
    draw();
  }

  // candles：K 線每根縮成一樣高才比，橘線標收盤。每根 {name, o, h, l, c, note}。
  function candles(el, list) {
    box(el).innerHTML = '<div class="tl-candles">' + list.map(function (raw) {
      // 數字一律轉成 Number 再拼進 HTML，字串裡的引號進不來
      var b = { name: raw.name, note: raw.note, o: +raw.o, h: +raw.h, l: +raw.l, c: +raw.c };
      var H = 100, y = function (v) { return b.h === b.l ? H / 2 : 5 + (b.h - v) / (b.h - b.l) * (H - 10); };
      var top = Math.min(y(b.o), y(b.c)), bh = Math.max(Math.abs(y(b.o) - y(b.c)), 1);
      return '<figure class="tl-candle"><svg viewBox="0 0 40 ' + H + '" role="img" aria-label="' + esc(b.name) + ' 開' + b.o + ' 高' + b.h + ' 低' + b.l + ' 收' + b.c + '">' +
        '<line class="tl-wick" x1="20" x2="20" y1="' + y(b.h) + '" y2="' + y(b.l) + '"/>' +
        '<rect class="' + (b.c >= b.o ? 'tl-up' : 'tl-down') + '" x="10" width="20" y="' + top + '" height="' + bh + '"/>' +
        '<line class="tl-close" x1="2" x2="38" y1="' + y(b.c) + '" y2="' + y(b.c) + '"/></svg>' +
        '<figcaption><b>' + esc(b.name) + '</b><br>' + esc(b.note || '') + '</figcaption></figure>';
    }).join('') + '</div>';
  }

  // slider：拉動一支股票的值，看兩種做法的結果怎麼變。
  // {names, values, index, min, max, step, left:{title, ops}, right:{title, ops}}
  function slider(el, o) {
    el = box(el);
    var xs = o.values.map(Number), id = 'tl-s' + Math.random().toString(36).slice(2);
    el.innerHTML = '<label class="tl-p" for="' + id + '">拉動' + esc(o.names[o.index]) + '的值：<b class="tl-sv"></b></label>' +
      '<input type="range" id="' + id + '" min="' + (+o.min) + '" max="' + (+o.max) + '" step="' + (+o.step || 1) + '" value="' + xs[o.index] + '">' +
      '<div class="tl-two"><div><h4>' + esc(o.left.title) + '</h4><div class="tl-l"></div></div><div><h4>' + esc(o.right.title) + '</h4><div class="tl-r"></div></div></div>';
    var input = el.querySelector('input');
    function draw() {
      xs[o.index] = +input.value;
      el.querySelector('.tl-sv').textContent = fmt(xs[o.index]);
      var l = chain(xs, o.left.ops), r = chain(xs, o.right.ops), m = absMax(l.concat(r));
      el.querySelector('.tl-l').innerHTML = bars(o.names, l, null, false, m);
      el.querySelector('.tl-r').innerHTML = bars(o.names, r, null, false, m);
    }
    input.oninput = draw;
    draw();
  }

  var T = { version: '0.1.0', k: k, fmt: fmt, bars: bars, cards: cards, steps: steps, candles: candles, slider: slider,
    rank: rank, scale: scale, neutralize: neutralize, tsMean: tsMean, tsStdDev: tsStdDev, decayLinear: decayLinear,
    tsRank: tsRank, corr: corr, argMin: argMin, ops: OPS, run: run, chain: chain };

  // 載入 KaTeX，版本寫死。載好後把先放原文的公式換成排好的。
  T.ready = typeof document === 'undefined' || root.katex ? Promise.resolve() : new Promise(function (done) {
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = KATEX + 'katex.min.css'; css.integrity = SRI.css; css.crossOrigin = 'anonymous';
    var js = document.createElement('script');
    js.src = KATEX + 'katex.min.js'; js.integrity = SRI.js; js.crossOrigin = 'anonymous';
    js.onload = function () {
      document.querySelectorAll('.tl-k[data-tex]').forEach(function (e) { e.outerHTML = k(e.dataset.tex, e.dataset.d === '1'); });
      done();
    };
    js.onerror = function () { done(); }; // 載不到就留原文，不讓整張圖壞掉
    document.head.appendChild(css); document.head.appendChild(js);
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else root.Teacher = T;
})(typeof window !== 'undefined' ? window : globalThis);
