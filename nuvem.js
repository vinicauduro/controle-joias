// Nuvem do Controle de Joias (Supabase): login e sincronização entre celular e computador.
// Sem chave em config.js o app funciona só neste aparelho.
//
// Como sincroniza: o app continua mexendo em db e chamando salvar(). Aqui comparamos cada
// peça, venda, cliente e fornecedor com a última versão conhecida e colocamos numa fila só
// o que mudou. A fila fica guardada no aparelho e vai para a nuvem assim que houver internet.
// De tempos em tempos (e ao voltar para o app) buscamos o que mudou nos outros aparelhos.
const Nuvem = (() => {
  const cfg = window.JOIAS_CONFIG || {};
  const ativa = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  // O app fica no mesmo endereço (vinicauduro.github.io) que a Agenda Corretor, que usa o mesmo
  // projeto Supabase. Com uma chave própria, o login das joias não se mistura com o da agenda.
  const sb = ativa ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { storageKey: 'joias-auth' } }) : null;
  const URL_APP = location.origin + location.pathname;
  const TABELA = 'joias_registros';
  const COLECOES = ['pecas', 'vendas', 'clientes', 'fornecedores'];
  const LOTE = 500;

  const st = { usuario: null, snap: {}, pend: {}, seq: 0, cursor: '', enviando: false, recebendo: false, erro: '', timer: null, ultimaSinc: 0 };

  const chave = n => 'joias_' + n + '_' + st.usuario.id;
  const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } };
  function persistir() { gravar(chave('snap'), st.snap); gravar(chave('pend'), st.pend); gravar(chave('cursor'), st.cursor); atualizarStatus(); }

  // impressão digital curta de um registro (para saber se mudou sem guardar uma cópia inteira)
  function hash(obj) {
    const s = JSON.stringify(obj); let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + s.length.toString(36);
  }
  function registros() {
    const out = new Map();
    for (const c of COLECOES) for (const r of (db[c] || [])) if (r && r.id) out.set(c + ':' + r.id, r);
    out.set('config:config', db.config);
    return out;
  }

  // Compara o db com a última versão conhecida e põe na fila o que mudou ou sumiu.
  function detectar() {
    if (!st.usuario) return;
    const atuais = registros(); let mudou = false;
    for (const [k, r] of atuais) { const h = hash(r); if (st.snap[k] !== h) { st.snap[k] = h; st.pend[k] = ++st.seq; mudou = true; } }
    for (const k of Object.keys(st.snap)) if (!atuais.has(k)) { delete st.snap[k]; st.pend[k] = ++st.seq; mudou = true; }
    if (mudou) { persistir(); agendarEnvio(); }
  }
  function agendarEnvio() { clearTimeout(st.timer); st.timer = setTimeout(enviar, 1200); }

  async function enviar() {
    if (!st.usuario || st.enviando || !navigator.onLine) return;
    const chaves = Object.keys(st.pend); if (!chaves.length) return;
    st.enviando = true; atualizarStatus();
    try {
      const atuais = registros();
      for (let i = 0; i < chaves.length; i += LOTE) {
        const parte = chaves.slice(i, i + LOTE);
        const versao = parte.map(k => st.pend[k]);
        const linhas = parte.map(k => {
          const [colecao, ...resto] = k.split(':'); const r = atuais.get(k);
          return { dono: st.usuario.id, colecao, id: resto.join(':'), dados: r || null, excluido: !r };
        });
        const { error } = await sb.from(TABELA).upsert(linhas, { onConflict: 'dono,colecao,id' });
        if (error) throw error;
        // só tira da fila o que não mudou de novo enquanto era enviado
        parte.forEach((k, j) => { if (st.pend[k] === versao[j]) delete st.pend[k]; });
        persistir();
      }
      st.erro = '';
    } catch (e) {
      st.erro = (e && e.message) || String(e);
      console.warn('Nuvem: envio falhou', e);
    } finally {
      st.enviando = false; atualizarStatus();
      if (!st.erro && Object.keys(st.pend).length) agendarEnvio();
    }
  }

  // Busca o que mudou na nuvem desde a última vez (com 5 minutos de folga; aplicar de novo não faz mal).
  async function receber() {
    if (!st.usuario || st.recebendo || !navigator.onLine) return;
    st.recebendo = true; atualizarStatus();
    try {
      const desde = st.cursor ? new Date(new Date(st.cursor).getTime() - 5 * 6e4).toISOString() : '1970-01-01T00:00:00Z';
      let de = 0, alterou = false, maior = st.cursor;
      for (;;) {
        const { data, error } = await sb.from(TABELA).select('colecao,id,dados,excluido,atualizado_em')
          .gt('atualizado_em', desde).order('atualizado_em', { ascending: true }).range(de, de + 999);
        if (error) throw error;
        for (const r of data) {
          if (!maior || r.atualizado_em > maior) maior = r.atualizado_em;
          if (aplicar(r)) alterou = true;
        }
        if (data.length < 1000) break;
        de += 1000;
      }
      st.cursor = maior || st.cursor; st.erro = ''; st.ultimaSinc = Date.now();
      persistir();
      if (alterou) { try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch (e) {} if (!document.querySelector('#modais .modal')) render(); }
    } catch (e) {
      st.erro = (e && e.message) || String(e);
      console.warn('Nuvem: recebimento falhou', e);
    } finally { st.recebendo = false; atualizarStatus(); }
  }
  function aplicar(r) {
    const k = r.colecao + ':' + r.id;
    if (st.pend[k]) return false; // a alteração deste aparelho ainda vai subir e vale mais
    if (r.colecao === 'config') {
      if (r.excluido || !r.dados) return false;
      const h = hash(r.dados); if (st.snap[k] === h) return false;
      db.config = Object.assign({}, db.config, r.dados); st.snap[k] = hash(db.config); return true;
    }
    if (!COLECOES.includes(r.colecao)) return false;
    const lista = db[r.colecao] || (db[r.colecao] = []);
    const i = lista.findIndex(x => x.id === r.id);
    if (r.excluido || !r.dados) {
      if (i < 0) { delete st.snap[k]; return false; }
      lista.splice(i, 1); delete st.snap[k]; return true;
    }
    const h = hash(r.dados); if (st.snap[k] === h && i >= 0) return false;
    if (i >= 0) lista[i] = r.dados; else lista.push(r.dados);
    st.snap[k] = h; return true;
  }

  async function sincronizar() { await enviar(); await receber(); await enviar(); }

  // ===== sessão =====
  async function entrou(usuario) {
    if (st.usuario && st.usuario.id === usuario.id) return;
    st.usuario = { id: usuario.id, email: usuario.email };
    fecharLogin();
    const primeiraVez = localStorage.getItem(chave('snap')) == null;
    st.snap = ler(chave('snap'), {}); st.pend = ler(chave('pend'), {}); st.cursor = ler(chave('cursor'), '');
    st.seq = Math.max(0, ...Object.values(st.pend));
    if (primeiraVez && (db.pecas.length || db.vendas.length || db.clientes.length)) {
      const { count } = await sb.from(TABELA).select('id', { count: 'exact', head: true }).eq('excluido', false);
      if (count > 0 && confirm('Esta conta já tem dados na nuvem.\n\nOK = usar os dados da nuvem neste aparelho (os daqui são descartados).\nCancelar = juntar os dados daqui com os da nuvem.')) {
        db = dbVazio(); try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch (e) {}
      }
    }
    // A primeira vez neste aparelho: tudo o que já existe aqui sobe para a nuvem.
    detectar();
    render();
    await sincronizar();
    toast('Conectada à nuvem ☁️');
  }

  async function iniciar() {
    if (!ativa) return;
    document.getElementById('btnNuvem').classList.remove('oculto');
    sb.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY') return novaSenha();
      if (sessao && sessao.user) entrou(sessao.user);
    });
    const { data } = await sb.auth.getSession();
    if (data.session && data.session.user) await entrou(data.session.user);
    else abrirLogin();
    setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
    window.addEventListener('online', sincronizar);
    window.addEventListener('offline', atualizarStatus);
  }

  // ===== telas =====
  function atualizarStatus() {
    const b = document.getElementById('btnNuvem'); if (!b) return;
    const n = Object.keys(st.pend).length;
    b.textContent = !st.usuario ? '☁️' : !navigator.onLine ? '☁️✕' : st.erro ? '☁️⚠️' : (st.enviando || st.recebendo) ? '☁️…' : n ? '☁️⏳' + n : '☁️✓';
  }
  function menu() {
    if (!st.usuario) return abrirLogin();
    const n = Object.keys(st.pend).length;
    abrirModal('Nuvem', `<div class="card">
      <div class="resumo-linha"><span>Conta</span><b>${esc(st.usuario.email)}</b></div>
      <div class="resumo-linha"><span>Situação</span><b>${!navigator.onLine ? 'sem internet' : st.erro ? '⚠️ erro' : n ? n + ' alteração(ões) para enviar' : 'tudo sincronizado ✓'}</b></div>
      ${st.ultimaSinc ? `<div class="resumo-linha"><span>Última sincronização</span><b>${new Date(st.ultimaSinc).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b></div>` : ''}
      ${st.erro ? `<div class="mini neg" style="margin-top:6px">${esc(st.erro)}</div>` : ''}</div>
      <p class="mini">Os dados ficam guardados na nuvem e neste aparelho. Entre com a mesma conta no celular e no computador para ver tudo igual. Sem internet, o app continua funcionando e envia as alterações quando a conexão voltar.</p>
      <div class="acoes"><button class="btn" onclick="fecharModal();Nuvem.sincronizar()">🔄 Sincronizar agora</button>
      <button class="btn perigo" onclick="Nuvem.sair()">Sair</button></div>`);
  }
  async function sair() {
    const n = Object.keys(st.pend).length;
    if (n && !confirm(`Ainda há ${n} alteração(ões) que não chegaram à nuvem e serão perdidas. Sair mesmo assim?`)) return;
    if (!n && !confirm('Sair da conta? Os dados continuam na nuvem.')) return;
    await sb.auth.signOut().catch(() => {});
    for (const k of ['snap', 'pend', 'cursor']) localStorage.removeItem(chave(k));
    st.usuario = null; st.snap = {}; st.pend = {}; st.cursor = '';
    db = dbVazio(); try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch (e) {}
    fecharModal(); render(); atualizarStatus(); abrirLogin();
  }

  function abrirLogin(modo) {
    modo = modo || 'entrar';
    let el = document.getElementById('telaLogin');
    if (!el) { el = document.createElement('div'); el.id = 'telaLogin'; document.body.appendChild(el); }
    const criar = modo === 'criar';
    el.innerHTML = `<div class="login"><div class="login-caixa">
      <div style="font-size:2.4rem">💍</div><h2 style="margin:6px 0 2px">${esc(db.config.nomeLoja || 'Controle de Joias')}</h2>
      <p class="mini" style="margin:0 0 10px">${criar ? 'Crie a conta uma vez; depois é só entrar com ela no celular e no computador.' : 'Entre para ver seus dados no celular e no computador.'}</p>
      <label>E-mail</label><input id="lgEmail" type="email" autocomplete="email" inputmode="email">
      <label>Senha</label><input id="lgSenha" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}" placeholder="${criar ? 'mínimo 6 caracteres' : ''}">
      <div class="mini neg" id="lgErro" style="margin-top:8px"></div>
      <div class="acoes"><button class="btn bloco" id="lgOk">${criar ? 'Criar conta' : 'Entrar'}</button></div>
      <div class="acoes" style="justify-content:space-between">
        <button class="btn sec peq" onclick="Nuvem.abrirLogin('${criar ? 'entrar' : 'criar'}')">${criar ? 'Já tenho conta' : 'Criar conta'}</button>
        ${criar ? '' : '<button class="btn sec peq" id="lgEsqueci">Esqueci a senha</button>'}
      </div></div></div>`;
    const erro = m => { document.getElementById('lgErro').textContent = m; };
    const ok = document.getElementById('lgOk');
    const enviarForm = async () => {
      const email = document.getElementById('lgEmail').value.trim(), senha = document.getElementById('lgSenha').value;
      if (!email || !senha) return erro('Preencha e-mail e senha.');
      ok.disabled = true; ok.textContent = 'Aguarde…'; erro('');
      try {
        if (criar) {
          const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: URL_APP } });
          if (error) throw error;
          if (!data.session) { erro(''); el.querySelector('.login-caixa').innerHTML = `<div style="font-size:2rem">📧</div><h2>Confirme o e-mail</h2><p>Enviamos um link para <b>${esc(email)}</b>. Abra o link e depois entre com a senha.</p><div class="acoes"><button class="btn bloco" onclick="Nuvem.abrirLogin()">Voltar para entrar</button></div>`; return; }
          await entrou(data.session.user);
        } else {
          const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
          if (error) throw error;
          await entrou(data.user);
        }
      } catch (e) {
        const m = (e && e.message) || '';
        erro(/invalid login/i.test(m) ? 'E-mail ou senha incorretos.' : /not confirmed/i.test(m) ? 'Confirme o e-mail pelo link que enviamos antes de entrar.' : /already registered/i.test(m) ? 'Este e-mail já tem conta. Toque em "Já tenho conta".' : /fetch|network/i.test(m) ? 'Sem conexão com a internet.' : m || 'Não foi possível continuar.');
      } finally { if (document.body.contains(ok)) { ok.disabled = false; ok.textContent = criar ? 'Criar conta' : 'Entrar'; } }
    };
    ok.onclick = enviarForm;
    document.getElementById('lgSenha').onkeydown = e => { if (e.key === 'Enter') enviarForm(); };
    const esq = document.getElementById('lgEsqueci');
    if (esq) esq.onclick = async () => {
      const email = document.getElementById('lgEmail').value.trim(); if (!email) return erro('Digite o e-mail primeiro.');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: URL_APP });
      erro(error ? error.message : ''); if (!error) toast('Enviamos um link para criar uma nova senha');
    };
    setTimeout(() => { const i = document.getElementById('lgEmail'); if (i) i.focus(); }, 50);
  }
  function fecharLogin() { const el = document.getElementById('telaLogin'); if (el) el.remove(); }
  async function novaSenha() {
    const s = prompt('Digite a nova senha (mínimo 6 caracteres):'); if (!s) return;
    const { error } = await sb.auth.updateUser({ password: s });
    toast(error ? 'Erro: ' + error.message : 'Senha alterada');
  }

  return { ativa, iniciar, mudou: detectar, sincronizar, menu, sair, abrirLogin };
})();
