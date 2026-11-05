/* ════════════════════════════════════════════════════════════════════
   EXP · Marcações sobre imagens — shared/marcacoes.js
   ────────────────────────────────────────────────────────────────────
   Desenho único das marcações usado pela Gestão (revisões e checklists),
   pelo chat flutuante e pelo chat em tela cheia:
   • símbolos sólidos com contorno branco (legíveis sobre pranchas);
   • traço livre (lápis) em três cores, salvo como lista de pontos em %;
   • borracha que apaga uma marcação por vez e "desfazer" (Cmd/Ctrl+Z).
   As marcações continuam no mesmo formato em `marcadores` (jsonb);
   o traço é { t:'traco', c:'azul'|'verde'|'terracota', p:[[x,y],...] }.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var COR = { azul: '#5981CC', verde: '#4D865C', terracota: '#BC6143', ouro: '#E2B141' };
  var corLapis = 'azul';
  try { corLapis = localStorage.getItem('exp_lapis_cor') || 'azul'; } catch (e) {}
  if (!COR[corLapis]) corLapis = 'azul';

  function seta(c, px) {
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 30 30" aria-hidden="true">' +
      '<g fill="#fff" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6 L11 19"/><path d="M7 23 L7 12 L18 23 Z"/></g>' +
      '<path d="M24 6 L11 19" stroke="' + c + '" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M7 23 L7 12 L18 23 Z" fill="' + c + '" stroke="' + c + '" stroke-width="2" stroke-linejoin="round"/></svg>';
  }
  function disco(c, px, miolo) {
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 30 30" aria-hidden="true">' +
      '<circle cx="15" cy="15" r="11" fill="' + c + '" stroke="#fff" stroke-width="2.5"/>' + miolo + '</svg>';
  }
  function alerta(px) {
    return disco(COR.ouro, px, '<path d="M15 9.5 V16" stroke="#412402" stroke-width="2.6" stroke-linecap="round"/><circle cx="15" cy="20.2" r="1.5" fill="#412402"/>');
  }
  function xis(px) {
    return disco(COR.terracota, px, '<path d="M11 11 L19 19 M19 11 L11 19" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>');
  }
  function anel(c, px) {
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 40 40" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="15" fill="none" stroke="#fff" stroke-width="6"/>' +
      '<circle cx="20" cy="20" r="15" fill="none" stroke="' + c + '" stroke-width="3"/></svg>';
  }

  /* Símbolo colocado sobre a imagem (centro = ponto clicado) */
  function ponto(t) {
    switch (t) {
      case 'seta':          return seta(COR.azul, 30);
      case 'seta_verde':    return seta(COR.verde, 30);
      case 'alerta':        return alerta(28);
      case 'x':             return xis(28);
      case 'circulo':       return anel(COR.azul, 40);
      case 'circulo_verde': return anel(COR.verde, 40);
      default:              return '';
    }
  }

  /* Ícone da ferramenta na barra (mesmo desenho, menor) */
  function icone(t) {
    switch (t) {
      case 'seta':          return seta(COR.azul, 20);
      case 'seta_verde':    return seta(COR.verde, 20);
      case 'alerta':        return alerta(20);
      case 'x':             return xis(20);
      case 'circulo':       return anel(COR.azul, 21);
      case 'circulo_verde': return anel(COR.verde, 21);
      case 'nota':          return disco(COR.azul, 20, '<text x="15" y="19.5" text-anchor="middle" font-size="12" font-weight="700" font-family="Raleway,sans-serif" fill="#fff">1</text>');
      case 'lapis':         return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + COR[corLapis] + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>';
      case 'apagar':        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F5B54" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21h13"/><path d="m5 15 9-9 5 5-8.5 8.5H8.5L5 16z"/><path d="m10 10 5 5"/></svg>';
      default:              return '';
    }
  }

  var NOMES = {
    seta: 'Seta azul', seta_verde: 'Seta verde', alerta: 'Alerta', x: 'Marcar com X',
    circulo: 'Círculo azul', circulo_verde: 'Círculo verde', nota: 'Nota numerada',
    lapis: 'Lápis: segure e desenhe', apagar: 'Apagar: clique numa marcação sua'
  };

  /* Barra de ferramentas.
     cfg: { prefixo, classe, chamada, ferramentas[], rotulos{t:'texto'}, classeRotulo } */
  function barraHtml(cfg) {
    return cfg.ferramentas.map(function (t) {
      if (t === '|') return '<div class="xm-sep"></div>';
      var rot = cfg.rotulos && cfg.rotulos[t]
        ? '<span class="' + (cfg.classeRotulo || '') + '">' + cfg.rotulos[t] + '</span>' : '';
      var btn = '<button type="button" class="' + cfg.classe + ' xm-tool" id="' + cfg.prefixo + t + '" onclick="' + cfg.chamada + '(\'' + t + '\')" title="' + NOMES[t] + '" aria-label="' + NOMES[t] + '">' + icone(t) + rot + '</button>';
      if (t !== 'lapis') return btn;
      return btn + '<div class="xm-cores" role="group" aria-label="Cor do lápis">' +
        ['azul', 'verde', 'terracota'].map(function (c) {
          return '<button type="button" class="xm-cor' + (c === corLapis ? ' on' : '') + '" data-cor="' + c + '" style="background:' + COR[c] + '" title="Lápis ' + c + '" aria-label="Lápis ' + c + '" onclick="ExpMarcas.definirCor(\'' + c + '\');' + cfg.chamada + '(\'lapis\',true)"></button>';
        }).join('') + '</div>';
    }).join('');
  }

  function definirCor(c) {
    if (!COR[c]) return;
    corLapis = c;
    try { localStorage.setItem('exp_lapis_cor', c); } catch (e) {}
    document.querySelectorAll('.xm-cor').forEach(function (b) { b.classList.toggle('on', b.dataset.cor === c); });
    document.querySelectorAll('.xm-tool[id$="lapis"]').forEach(function (b) {
      var lbl = b.querySelector('span');
      b.innerHTML = icone('lapis') + (lbl ? lbl.outerHTML : '');
    });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[<>&"']/g, function (ch) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[ch]; }); }

  function caminho(p) {
    return (p || []).map(function (q, i) { return (i ? 'L' : 'M') + Number(q[0]) + ' ' + Number(q[1]); }).join(' ');
  }

  /* Camada dos traços (por baixo dos símbolos). ehMeu(mk) diz quem pode apagar. */
  function tracosSvg(lista, ehMeu) {
    var tr = (lista || []).filter(function (mk) { return mk.t === 'traco' && mk.p && mk.p.length > 1; });
    if (!tr.length) return '';
    return '<svg class="xm-tracos" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      tr.map(function (mk) {
        var d = caminho(mk.p), c = COR[mk.c] || COR.azul, meu = !!ehMeu(mk);
        return '<g data-xm-id="' + esc(mk.id) + '" data-xm-own="' + (meu ? '1' : '0') + '">' +
          '<path class="xm-halo" d="' + d + '"/>' +
          '<path class="xm-linha" d="' + d + '" style="stroke:' + c + '"/>' +
          (meu ? '<path class="xm-hit" d="' + d + '"/>' : '') + '</g>';
      }).join('') + '</svg>';
  }

  /* Botão "×" que aparece ao passar o mouse sobre uma marcação sua */
  function botaoApagar(chamada, id) {
    return '<button type="button" class="xm-del" title="Apagar esta marcação" aria-label="Apagar esta marcação" onclick="event.stopPropagation();' + chamada + '(\'' + esc(id) + '\')">' +
      '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
  }

  /* Marcação de símbolo completa. O ponto clicado fica exatamente no centro do símbolo
     (na seta, na ponta); as iniciais ficam ao lado sem deslocar o símbolo.
     o: { classe, ehMeu, remover (nome da função global), dblclick } */
  function marcaHtml(mk, o) {
    var meu = !!o.ehMeu(mk);
    return '<div class="' + o.classe + ' xm-mk" style="left:' + Number(mk.x) + '%;top:' + Number(mk.y) + '%"' +
      ' data-xm-id="' + esc(mk.id) + '" data-xm-own="' + (meu ? '1' : '0') + '"' +
      (meu && o.remover ? ' ondblclick="' + o.remover + '(\'' + esc(mk.id) + '\')"' : '') + '>' +
      '<div class="xm-ponto xm-p-' + esc(mk.t) + '" data-xm-id="' + esc(mk.id) + '" data-xm-own="' + (meu ? '1' : '0') + '">' + ponto(mk.t) +
      (meu && o.remover ? botaoApagar(o.remover, mk.id) : '') + '</div>' +
      (mk.ini ? '<span class="xm-ini">' + esc(mk.ini) + '</span>' : '') + '</div>';
  }

  /* Marcação sob o clique, se for sua (modo Apagar) */
  function alvoApagavel(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-xm-id]') : null;
    return el && el.getAttribute('data-xm-own') === '1' ? el.getAttribute('data-xm-id') : null;
  }

  /* Última marcação que a pessoa pôs na imagem (para desfazer) */
  function ultimaMinha(lista, ehMeu) {
    var minhas = (lista || []).filter(function (mk) { return ehMeu(mk); });
    if (!minhas.length) return null;
    return minhas.slice().sort(function (a, b) { return String(a.ts || '').localeCompare(String(b.ts || '')); }).pop();
  }

  function ehDesfazer(e) {
    return (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'z';
  }

  /* Ramer–Douglas–Peucker: guarda só os pontos que mudam o desenho */
  function simplificar(pts, tol) {
    if (pts.length < 3) return pts;
    var dmax = 0, idx = 0, a = pts[0], b = pts[pts.length - 1];
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-9;
    for (var i = 1; i < pts.length - 1; i++) {
      var d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= tol) return [a, b];
    var esq = simplificar(pts.slice(0, idx + 1), tol), dir = simplificar(pts.slice(idx), tol);
    return esq.slice(0, -1).concat(dir);
  }

  /* Liga o lápis a um visualizador.
     o: { canvas, img, marcas, ativo:()=>bool, fim:(pontos, cor)=>void } — elementos ou funções que os devolvem */
  function ligarLapis(o) {
    var el = function (v) { return typeof v === 'function' ? v() : v; };
    var cv = el(o.canvas);
    if (!cv || cv._xmLapis) return;
    cv._xmLapis = true;
    var tr = null;
    cv.addEventListener('pointerdown', function (e) {
      if (!o.ativo() || e.button !== 0) return;
      var img = el(o.img), mk = el(o.marcas);
      if (!img || !mk) return;
      e.preventDefault(); e.stopPropagation();
      var r = img.getBoundingClientRect();
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'xm-tracos xm-previa');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.innerHTML = '<path class="xm-halo"/><path class="xm-linha" style="stroke:' + COR[corLapis] + '"/>';
      mk.appendChild(svg);
      tr = { r: r, pts: [], svg: svg, id: e.pointerId };
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      add(e);
    });
    function add(e) {
      var x = (e.clientX - tr.r.left) / tr.r.width * 100, y = (e.clientY - tr.r.top) / tr.r.height * 100;
      x = Math.max(0, Math.min(100, x)); y = Math.max(0, Math.min(100, y));
      var u = tr.pts[tr.pts.length - 1];
      if (u && Math.abs(u[0] - x) < 0.15 && Math.abs(u[1] - y) < 0.15) return;
      tr.pts.push([x, y]);
      var d = caminho(tr.pts);
      tr.svg.querySelectorAll('path').forEach(function (p) { p.setAttribute('d', d); });
    }
    cv.addEventListener('pointermove', function (e) { if (tr && e.pointerId === tr.id) { e.preventDefault(); add(e); } });
    function acabar(e) {
      if (!tr || (e && e.pointerId !== tr.id)) return;
      var t = tr; tr = null;
      t.svg.remove();
      cv._xmAcabouEm = Date.now();
      var pts = simplificar(t.pts, 0.25).slice(0, 400).map(function (q) { return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]; });
      if (pts.length === 1) pts.push([pts[0][0] + 0.3, pts[0][1] + 0.3]);
      if (pts.length > 1) o.fim(pts, corLapis);
    }
    cv.addEventListener('pointerup', acabar);
    cv.addEventListener('pointercancel', acabar);
  }

  /* Marcação de traço pronta para salvar (x/y = 1º ponto, para versões antigas não quebrarem) */
  function novoTraco(pts, cor, base) {
    var mk = { t: 'traco', c: cor, p: pts, x: pts[0][0], y: pts[0][1] };
    for (var k in base) mk[k] = base[k];
    return mk;
  }

  var css = [
    '.xm-tracos{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}',
    '.xm-tracos path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}',
    '.xm-tracos .xm-halo{stroke:#fff;stroke-width:6.5}',
    '.xm-tracos .xm-linha{stroke-width:3.2}',
    '.xm-tracos .xm-hit{stroke:transparent;stroke-width:16;pointer-events:none}',
    '.xm-apagar .xm-tracos .xm-hit{pointer-events:stroke;cursor:pointer}',
    '.xm-apagar .xm-tracos g[data-xm-own="1"]:hover .xm-linha{stroke-dasharray:6 4}',
    '.xm-apagar [data-xm-own="1"]{cursor:pointer}',
    '.xm-apagar [data-xm-own="0"]{opacity:.45}',
    '.xm-desenhando{cursor:crosshair;touch-action:none}',
    /* âncora de tamanho zero no ponto clicado: nada ao redor desloca o símbolo */
    '.xm-mk{width:0!important;height:0!important;transform:none!important;display:block!important;gap:0!important;filter:none!important}',
    '.xm-ponto{position:absolute;left:0;top:0;transform:translate(-50%,-50%);line-height:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.28))}',
    '.xm-p-seta,.xm-p-seta_verde{transform:translate(-20%,-80%)}',
    '.xm-ini{position:absolute;left:15px;top:6px;padding:1px 4px;border-radius:8px;background:rgba(255,255,255,.85);color:#5F5B54;font-family:Raleway,sans-serif;font-size:8px;font-weight:700;line-height:1.3;white-space:nowrap;pointer-events:none}',
    '.xm-del{position:absolute;top:-7px;right:-7px;width:17px;height:17px;border-radius:50%;border:1.5px solid #fff;background:#BC6143;color:#fff;display:none;align-items:center;justify-content:center;padding:0;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.3);z-index:2}',
    '[data-xm-own="1"]:hover>.xm-del,[data-xm-own="1"]:hover>.xm-ponto>.xm-del{display:flex}',
    '.xm-apagar .xm-del{display:none!important}',
    '.xm-tool svg{flex-shrink:0}',
    '.xm-sep{height:1px;background:rgba(17,17,16,.1);margin:3px 4px}',
    '.xm-cores{display:flex;justify-content:center;gap:4px;padding:1px 0 2px}',
    '.xm-cor{width:10px;height:10px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(17,17,16,.18);padding:0;cursor:pointer}',
    '.xm-cor.on{box-shadow:0 0 0 1.5px #141414}',
    '[data-theme="dark"] .xm-cor.on{box-shadow:0 0 0 1.5px #F0EFEC}',
    '[data-theme="dark"] .xm-sep{background:rgba(255,255,255,.12)}',
    /* nota numerada: azul em todas as telas */
    '.gm-mv-nota-n,.chat-mv-nota,.fp-mark-nota,.tmv-nota-n,.chat-mv-note-num,.fp-mv-note-num{background:#5981CC!important;color:#fff!important}'
  ].join('\n');
  function injetarCss() {
    if (document.getElementById('xm-css')) return;
    var s = document.createElement('style');
    s.id = 'xm-css';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }
  injetarCss();

  window.ExpMarcas = {
    COR: COR, ponto: ponto, icone: icone, nomes: NOMES, barraHtml: barraHtml,
    definirCor: definirCor, cor: function () { return corLapis; },
    tracosSvg: tracosSvg, marcaHtml: marcaHtml, botaoApagar: botaoApagar, alvoApagavel: alvoApagavel,
    ultimaMinha: ultimaMinha, ehDesfazer: ehDesfazer,
    ligarLapis: ligarLapis, novoTraco: novoTraco, simplificar: simplificar
  };
})();
