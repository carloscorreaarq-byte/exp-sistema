/* ════════════════════════════════════════════════════════════════════
   EXP · Fotos nas tarefas (tarefas_livres) — módulo compartilhado (13/11/2026)
   ────────────────────────────────────────────────────────────────────
   Mesma estrutura da Gestão: tabela gestao_anexos_temporarios
   (contexto_tipo = 'tarefa_livre') e bucket gestao-anexos-temp.
   • Tarefa aberta: a foto fica (sem prazo).
   • Tarefa concluída ou excluída: a foto sai do bucket (apagar) — e, se quem
     concluiu não puder apagar o arquivo, a "faxina" de quem anexou remove depois.
   Uso: ExpTarefaFotos.abrir(tarefaId, titulo, { aoMudar })
        ExpTarefaFotos.contar(ids) → Promise<{ id: n }>
        ExpTarefaFotos.apagar(ids)  ·  ExpTarefaFotos.faxina()
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CTX = 'tarefa_livre', BUCKET = 'gestao-anexos-temp';
  var LARG_MAX = 1600, QUALIDADE = 0.8;

  function sb() { return window.sb; }
  /* Usuário da plataforma (id de usuarios, o mesmo de criado_por) */
  function eu() {
    var u = (window.G && window.G.usuario) || window._dashUsuario || null;
    if (u && u.id) return u;
    try { var s = JSON.parse(sessionStorage.getItem('exp_usuario') || 'null'); if (s && s.app_user_id) return { id: s.app_user_id }; } catch (e) {}
    return null;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function aviso(msg) { if (typeof window.toast === 'function') window.toast(msg, 5000); else console.warn(msg); }
  function semPrazo() { var d = new Date(); d.setFullYear(d.getFullYear() + 10); return d.toISOString(); }

  /* ── Estilos ── */
  function css() {
    if (document.getElementById('tf-css')) return;
    var st = document.createElement('style'); st.id = 'tf-css';
    st.textContent = [
      '.tf-fundo{position:fixed;inset:0;background:rgba(17,17,16,.42);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}',
      '.tf-box{background:var(--branco,#fff);border:1px solid var(--cinza,#E3E1DB);border-radius:12px;width:min(560px,100%);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.22);overflow:hidden}',
      '.tf-hd{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--cinza,#E3E1DB)}',
      '.tf-hd-tx{flex:1;min-width:0}',
      '.tf-lb{font-size:8px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#8A867E}',
      '.tf-tit{font-size:13px;font-weight:700;color:var(--grafite,#111110);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tf-x{background:none;border:0;font-size:20px;line-height:1;color:#8A867E;cursor:pointer;padding:2px 6px}',
      '.tf-corpo{padding:14px 16px;overflow:auto}',
      '.tf-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}',
      '.tf-item{position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--off,#F5F4F0);border:1px solid var(--cinza,#E3E1DB);cursor:zoom-in}',
      '.tf-item img{width:100%;height:100%;object-fit:cover;display:block}',
      '.tf-item .tf-del{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(17,17,16,.6);color:#fff;font-size:13px;line-height:22px;cursor:pointer;display:none}',
      '.tf-item:hover .tf-del{display:block}',
      '.tf-carregando{display:flex;align-items:center;justify-content:center;font-size:10px;color:#8A867E}',
      '.tf-vazio{font-size:11px;color:#8A867E;text-align:center;padding:22px 10px;background:var(--off,#F5F4F0);border:1px dashed var(--cinza,#E3E1DB);border-radius:10px}',
      '.tf-pe{display:flex;align-items:center;gap:10px;padding:10px 16px 14px;border-top:1px solid var(--cinza,#E3E1DB)}',
      '.tf-nota{flex:1;font-size:10px;color:#8A867E;line-height:1.4}',
      '.tf-btn{font-family:var(--font-ui);font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;border-radius:8px;padding:8px 12px;cursor:pointer;border:1px solid var(--grafite,#111110);background:var(--grafite,#111110);color:var(--branco,#fff)}',
      '.tf-btn[disabled]{opacity:.5;cursor:default}',
      '.tf-zoom{position:fixed;inset:0;background:rgba(17,17,16,.88);z-index:9100;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:24px}',
      '.tf-zoom img{max-width:100%;max-height:100%;border-radius:6px}',
      '[data-theme="dark"] .tf-box{background:#1E1E1C;border-color:#2E2D2B}',
      '[data-theme="dark"] .tf-hd,[data-theme="dark"] .tf-pe{border-color:#2E2D2B}',
      '[data-theme="dark"] .tf-item,[data-theme="dark"] .tf-vazio{background:#252523;border-color:#2E2D2B}',
      '[data-theme="dark"] .tf-btn{background:#F0EDE6;border-color:#F0EDE6;color:#1A1A18}',
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ── Dados ── */
  async function contar(ids) {
    ids = Array.from(new Set((ids || []).filter(Boolean).map(String)));
    var out = {};
    if (!ids.length || !sb()) return out;
    var r = await sb().from('gestao_anexos_temporarios').select('contexto_id')
      .eq('contexto_tipo', CTX).in('contexto_id', ids).is('removido_em', null).gt('expires_at', new Date().toISOString());
    (r.data || []).forEach(function (x) { out[x.contexto_id] = (out[x.contexto_id] || 0) + 1; });
    return out;
  }
  async function listar(id) {
    var r = await sb().from('gestao_anexos_temporarios').select('id,storage_path,criado_por,created_at')
      .eq('contexto_tipo', CTX).eq('contexto_id', id).is('removido_em', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });
    return r.error ? [] : (r.data || []);
  }
  /* Tarefa concluída/excluída: tira as fotos do bucket e marca como removidas */
  async function apagar(ids, motivo) {
    ids = Array.from(new Set((ids || []).filter(Boolean).map(String)));
    if (!ids.length || !sb()) return;
    var r = await sb().from('gestao_anexos_temporarios').select('id,storage_path')
      .eq('contexto_tipo', CTX).in('contexto_id', ids).is('removido_em', null);
    var rows = r.data || [];
    if (!rows.length) return;
    var paths = rows.map(function (x) { return x.storage_path; }).filter(Boolean);
    if (paths.length) {
      var rm = await sb().storage.from(BUCKET).remove(paths);
      if (rm.error) { console.warn('[tarefa-fotos] arquivo não removido agora (a faxina de quem anexou remove depois):', rm.error.message); return; }
    }
    await sb().from('gestao_anexos_temporarios')
      .update({ removido_em: new Date().toISOString(), remocao_motivo: motivo || 'context_completed' })
      .in('id', rows.map(function (x) { return x.id; }));
  }
  /* Faxina (uma vez por sessão): fotos que EU anexei em tarefas já concluídas ou excluídas */
  var _faxinaFeita = false;
  async function faxina() {
    if (_faxinaFeita || !sb()) return; _faxinaFeita = true;
    var u = eu(); if (!u) return;
    try {
      var r = await sb().from('gestao_anexos_temporarios').select('contexto_id')
        .eq('contexto_tipo', CTX).eq('criado_por', u.id).is('removido_em', null);
      var ids = Array.from(new Set((r.data || []).map(function (x) { return x.contexto_id; })));
      if (!ids.length) return;
      var ab = await sb().from('tarefas_livres').select('id').in('id', ids).eq('concluida', false);
      var vivas = {}; (ab.data || []).forEach(function (t) { vivas[t.id] = true; });
      var mortas = ids.filter(function (id) { return !vivas[id]; });
      if (mortas.length) await apagar(mortas, 'context_completed');
    } catch (e) { console.warn('[tarefa-fotos] faxina:', e.message); }
  }

  /* Reduz a imagem (até 1600 px, WEBP ou JPG) antes de subir */
  function otimizar(file) {
    return new Promise(function (ok, falha) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var esc2 = Math.min(1, LARG_MAX / Math.max(img.width, img.height));
        var w = Math.round(img.width * esc2), h = Math.round(img.height * esc2);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (b && b.type === 'image/webp') return ok({ blob: b, mime: 'image/webp', ext: 'webp', w: w, h: h });
          c.toBlob(function (b2) { b2 ? ok({ blob: b2, mime: 'image/jpeg', ext: 'jpg', w: w, h: h }) : falha(new Error('Não foi possível preparar a imagem.')); }, 'image/jpeg', QUALIDADE);
        }, 'image/webp', QUALIDADE);
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Imagem inválida.')); };
      img.src = url;
    });
  }
  async function subir(id, file) {
    var u = eu();
    if (!u) throw new Error('Usuário não identificado.');
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type || '')) throw new Error('Envie imagens PNG, JPG ou WEBP.');
    var o = await otimizar(file);
    var path = CTX + '/' + id + '/' + u.id + '-' + Date.now() + '.' + o.ext;
    var up = await sb().storage.from(BUCKET).upload(path, o.blob, { contentType: o.mime, upsert: false });
    if (up.error) throw up.error;
    var ins = await sb().from('gestao_anexos_temporarios').insert({
      contexto_tipo: CTX, contexto_id: id, bucket_name: BUCKET, storage_path: path,
      mime_type: o.mime, arquivo_ext: o.ext, size_bytes: o.blob.size, width_px: o.w, height_px: o.h,
      criado_por: u.id, expires_at: semPrazo(), concluido_snapshot: false, concluido_em_snapshot: null,
    });
    if (ins.error) { await sb().storage.from(BUCKET).remove([path]); throw ins.error; }
  }
  async function removerUma(item) {
    var rm = await sb().storage.from(BUCKET).remove([item.storage_path]);
    if (rm.error) throw rm.error;
    await sb().from('gestao_anexos_temporarios').update({ removido_em: new Date().toISOString(), remocao_motivo: 'manual' }).eq('id', item.id);
  }

  /* ── Janela de fotos da tarefa ── */
  var J = null;   // { id, titulo, aoMudar, urls: [] }
  function fechar() {
    var f = document.getElementById('tf-fundo'); if (f) f.remove();
    if (J) (J.urls || []).forEach(function (u) { URL.revokeObjectURL(u); });
    document.removeEventListener('paste', aoColar);
    document.removeEventListener('keydown', aoTecla);
    var cb = J && J.aoMudar, mudou = J && J.mudou; J = null;
    if (mudou && typeof cb === 'function') cb();
  }
  function aoTecla(e) {
    if (e.key !== 'Escape') return;
    var z = document.getElementById('tf-zoom'); if (z) { z.remove(); return; }
    fechar();
  }
  async function aoColar(e) {
    if (!J) return;
    var fs = Array.from((e.clipboardData && e.clipboardData.items) || []).filter(function (i) { return /^image\//.test(i.type); }).map(function (i) { return i.getAsFile(); }).filter(Boolean);
    if (!fs.length) return;
    e.preventDefault(); await enviar(fs);
  }
  async function enviar(files) {
    if (!J || !files || !files.length) return;
    var btn = document.getElementById('tf-add'); if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
    for (var i = 0; i < files.length; i++) {
      try { await subir(J.id, files[i]); J.mudou = true; } catch (err) { aviso('Erro ao anexar foto: ' + (err && err.message || err)); }
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Adicionar foto'; }
    await desenhar();
  }
  async function desenhar() {
    if (!J) return;
    var grade = document.getElementById('tf-grade'); if (!grade) return;
    var itens = await listar(J.id);
    if (!J) return;
    (J.urls || []).forEach(function (u) { URL.revokeObjectURL(u); }); J.urls = [];
    if (!itens.length) { grade.outerHTML = '<div id="tf-grade" class="tf-vazio">Nenhuma foto ainda. Use o botão abaixo ou cole uma imagem (Ctrl/⌘ V).</div>'; return; }
    var u = eu() || {};
    grade.outerHTML = '<div id="tf-grade" class="tf-grade">' + itens.map(function (it, i) {
      return '<div class="tf-item tf-carregando" data-i="' + i + '">…' +
        (String(it.criado_por) === String(u.id) ? '<button class="tf-del" type="button" title="Remover foto" data-del="' + i + '">&times;</button>' : '') + '</div>';
    }).join('') + '</div>';
    var g = document.getElementById('tf-grade');
    g.onclick = async function (e) {
      var d = e.target.closest('[data-del]');
      if (d) {
        e.stopPropagation();
        if (!window.confirm('Remover esta foto?')) return;
        try { await removerUma(itens[+d.getAttribute('data-del')]); J.mudou = true; await desenhar(); } catch (err) { aviso('Erro ao remover: ' + (err && err.message || err)); }
        return;
      }
      var cel = e.target.closest('.tf-item'); var img = cel && cel.querySelector('img');
      if (!img) return;
      var z = document.createElement('div'); z.id = 'tf-zoom'; z.className = 'tf-zoom';
      z.innerHTML = '<img src="' + img.src + '" alt="">'; z.onclick = function () { z.remove(); };
      document.body.appendChild(z);
    };
    itens.forEach(function (it, i) {
      sb().storage.from(BUCKET).download(it.storage_path).then(function (r) {
        var cel = g.querySelector('.tf-item[data-i="' + i + '"]'); if (!cel || !J) return;
        if (r.error || !r.data) { cel.firstChild && cel.firstChild.nodeType === 3 && (cel.firstChild.nodeValue = 'indisponível'); return; }
        var url = URL.createObjectURL(r.data); J.urls.push(url);
        cel.classList.remove('tf-carregando');
        if (cel.firstChild && cel.firstChild.nodeType === 3) cel.removeChild(cel.firstChild);
        var im = document.createElement('img'); im.src = url; im.alt = ''; cel.insertBefore(im, cel.firstChild);
      });
    });
  }
  function abrir(id, titulo, opts) {
    if (!id || !sb()) return;
    css(); if (J) fechar();
    J = { id: String(id), titulo: titulo || 'Tarefa', aoMudar: opts && opts.aoMudar, urls: [], mudou: false };
    var f = document.createElement('div'); f.id = 'tf-fundo'; f.className = 'tf-fundo';
    f.innerHTML = '<div class="tf-box" role="dialog" aria-label="Fotos da tarefa">' +
      '<div class="tf-hd"><div class="tf-hd-tx"><div class="tf-lb">Fotos da tarefa</div><div class="tf-tit">' + esc(J.titulo) + '</div></div>' +
        '<button class="tf-x" type="button" title="Fechar" aria-label="Fechar">&times;</button></div>' +
      '<div class="tf-corpo"><div id="tf-grade" class="tf-vazio">Carregando…</div></div>' +
      '<div class="tf-pe"><div class="tf-nota">As fotos somem quando a tarefa for concluída.</div>' +
        '<input type="file" id="tf-file" accept="image/png,image/jpeg,image/webp" multiple hidden>' +
        '<button class="tf-btn" id="tf-add" type="button">Adicionar foto</button></div>' +
      '</div>';
    f.addEventListener('mousedown', function (e) { if (e.target === f) fechar(); });
    document.body.appendChild(f);
    f.querySelector('.tf-x').onclick = fechar;
    var inp = f.querySelector('#tf-file');
    f.querySelector('#tf-add').onclick = function () { inp.click(); };
    inp.onchange = function () { var fs = Array.from(inp.files || []); inp.value = ''; enviar(fs); };
    f.addEventListener('dragover', function (e) { e.preventDefault(); });
    f.addEventListener('drop', function (e) { e.preventDefault(); enviar(Array.from((e.dataTransfer && e.dataTransfer.files) || [])); });
    document.addEventListener('paste', aoColar);
    document.addEventListener('keydown', aoTecla);
    desenhar();
  }

  window.ExpTarefaFotos = { abrir: abrir, contar: contar, apagar: apagar, faxina: faxina };
})();
