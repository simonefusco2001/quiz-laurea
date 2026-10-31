// Pagina del giocatore: entra con un nome, risponde dal telefono, vede il podio finale.
(function () {
  const C = window.Quiz;
  const Q = window.QUESTIONS;
  const main = document.getElementById("main");

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* niente */ } },
    del(k) { try { localStorage.removeItem(k); } catch (_) { /* niente */ } },
  };

  let pid = store.get("quiz_pid", null);
  let myName = store.get("quiz_name", "");
  let answered = store.get("quiz_answered", {}); // { indiceDomanda: scelta }
  let state = null;
  let viewKey = "";
  let ticker = null;
  let lobbyPoll = null;
  let autoSend = null; // invio automatico della risposta selezionata ma non confermata

  const header = () => `<div class="q-head"><span class="pill nowrap">🎓 Quiz di Simone</span>${myName ? `<span class="pill nowrap" style="background:#fff;max-width:50%;overflow:hidden;text-overflow:ellipsis">${C.esc(myName)}</span>` : ""}</div>`;
  // Riga compatta per domanda/attesa/esito: numero domanda, nome, timer (facoltativo)
  const qTop = (s, withTimer) => `
    <div class="q-top">
      <span class="pill">${s.q_index + 1}/${Q.length}</span>
      <span class="q-name">${C.esc(myName)}</span>
      ${withTimer ? `<div class="timer" id="t">${Math.ceil(C.remaining(s))}</div>` : ""}
    </div>
    ${withTimer ? '<div class="timebar"><div id="bar"></div></div>' : ""}`;
  const show = (html) => { main.innerHTML = html; window.scrollTo(0, 0); };
  const stopTimers = () => { clearInterval(ticker); clearInterval(lobbyPoll); clearTimeout(autoSend); ticker = lobbyPoll = autoSend = null; };

  function preloadImages() {
    Q.forEach((q) => { const i = new Image(); i.src = q.img; });
  }

  function forgetPlayer() {
    pid = null; myName = ""; answered = {};
    store.del("quiz_pid"); store.del("quiz_name"); store.del("quiz_answered");
  }

  // ---------- Ingresso ----------
  function showJoin(msg = "") {
    stopTimers();
    viewKey = "join";
    show(`
      <section class="screen center">
        <span class="pill">🎓 Festa di laurea di Simone</span>
        <h1 class="big-title">Chi vuole essere dottore?</h1>
        <p class="muted">20 domande per scoprire chi conosce davvero Simone.</p>
        <form id="join" class="card" style="width:100%;display:flex;flex-direction:column;gap:12px">
          <label for="name" style="font-weight:700;text-align:left">Come ti chiami?</label>
          <input id="name" type="text" maxlength="20" autocomplete="off" placeholder="Il tuo nome" required>
          <p class="error" id="err">${C.esc(msg)}</p>
          <button class="btn" type="submit">Entra nel quiz</button>
        </form>
      </section>`);
    const form = document.getElementById("join");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      const name = document.getElementById("name").value.trim();
      if (!name) return;
      btn.disabled = true;
      try {
        const id = await C.rpc("join_game", { p_name: name });
        pid = id; myName = name; answered = {};
        store.set("quiz_pid", pid); store.set("quiz_name", myName); store.set("quiz_answered", answered);
        startGame();
      } catch (err) {
        const m = (err && err.message) || "";
        document.getElementById("err").textContent = m.includes("nome_preso")
          ? "Questo nome è già preso: aggiungi un'iniziale o un soprannome."
          : "Connessione lenta, riprova.";
        btn.disabled = false;
      }
    });
  }

  // ---------- Partita ----------
  function startGame() {
    preloadImages();
    C.keepAwake();
    viewKey = "";
    C.watchState(render);
  }

  function render(s) {
    state = s;
    const key = `${s.phase}|${s.q_index}|${s.q_started_at}`;
    if (key === viewKey) return;
    viewKey = key;
    stopTimers();
    if (s.phase === "question") return renderQuestion(s);
    if (s.phase === "reveal") return renderReveal(s);
    if (s.phase === "podium") return renderPodium();
    return renderLobby(s); // lobby (e la vecchia fase "leaderboard", che non usiamo)
  }

  async function renderLobby(s) {
    // Dopo un "ricomincia" del conduttore il giocatore non esiste più: si rientra col nome.
    try {
      const info = await C.rpc("player_info", { p_player: pid });
      if (!info || !info.length) { forgetPlayer(); return showJoin(); }
    } catch (_) { /* rete lenta: andiamo avanti */ }

    const started = s.q_index >= 0;
    show(`
      <section class="screen center">
        ${header()}
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px;width:100%">
          <div class="bounce" style="font-size:56px">🎓</div>
          <h1 class="big-title">Ci sei, ${C.esc(myName)}!</h1>
          <p class="dots">${started ? "Pausa, si riparte tra poco" : "Aspetta che Simone faccia partire il quiz"}</p>
          <div class="card"><p class="small muted" style="margin-bottom:8px"><b id="count">0</b> giocatori dentro</p><div class="names" id="names"></div></div>
        </div>
      </section>`);
    const refresh = async () => {
      const { data } = await C.sb.from("players").select("name").order("created_at");
      if (!data) return;
      const c = document.getElementById("count"), n = document.getElementById("names");
      if (!c || !n) return;
      c.textContent = data.length;
      n.innerHTML = data.map((p) => `<span>${C.esc(p.name)}</span>`).join("");
    };
    refresh();
    lobbyPoll = setInterval(refresh, 3000);
  }

  function renderQuestion(s) {
    const qi = s.q_index;
    const q = Q[qi];
    if (!q) return;
    if (answered[qi] !== undefined) return renderWaiting(s, answered[qi]);

    show(`
      <section class="screen fit">
        ${qTop(s, true)}
        <h2 class="q-text">${C.esc(q.q)}</h2>
        <div class="img-wrap"><img src="${q.img}" alt=""></div>
        <div class="answers" id="answers">${q.a.map((a, i) => C.answerButton(i, a)).join("")}</div>
        <button class="btn confirm" id="confirm" disabled>Scegli una risposta</button>
      </section>`);

    fitQuestion();
    setTimeout(fitQuestion, 300); // secondo controllo, a schermata assestata

    // Si può cambiare risposta quante volte si vuole: conta solo quando si preme Conferma
    // (i punti dipendono dal momento della conferma).
    const buttons = [...document.querySelectorAll(".ans")];
    const confirmBtn = document.getElementById("confirm");
    let selected = null;
    let sending = false;

    const send = async () => {
      if (sending || selected === null || answered[qi] !== undefined) return;
      sending = true;
      clearTimeout(autoSend);
      buttons.forEach((x) => { x.disabled = true; });
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Invio…";
      try {
        const ok = await C.rpc("submit_answer", { p_player: pid, p_choice: selected });
        if (!ok) { stopTimers(); return renderWaiting(s, null, "Troppo tardi! ⏰"); }
        answered[qi] = selected;
        store.set("quiz_answered", answered);
        renderWaiting(s, selected);
      } catch (_) {
        sending = false;
        if (C.remaining(s) <= 0) return renderWaiting(s, null, "Connessione persa 😢");
        buttons.forEach((x) => { x.disabled = false; });
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Connessione lenta: riprova";
      }
    };

    tick(s, () => {
      if (sending) return;
      buttons.forEach((b) => { b.disabled = true; b.classList.add("dim"); });
      renderWaiting(s, null);
    });

    buttons.forEach((b) => b.addEventListener("click", () => {
      if (sending || C.remaining(s) <= 0 || answered[qi] !== undefined) return;
      selected = Number(b.dataset.i);
      buttons.forEach((x) => { x.classList.toggle("chosen", x === b); x.classList.toggle("dim", x !== b); });
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Conferma risposta ✔";
    }));
    confirmBtn.addEventListener("click", send);

    // Chi ha scelto ma non ha confermato: la risposta parte da sola un attimo prima dello scadere
    autoSend = setTimeout(send, Math.max(0, (C.remaining(s) - 0.8) * 1000));
  }

  // Fa stare domanda, foto e risposte in una schermata su qualsiasi telefono:
  // prima layout normale, poi risposte 2x2, poi testi più piccoli, la foto si toglie solo per ultima.
  function fitQuestion() {
    const fit = document.querySelector(".fit");
    if (!fit || !document.querySelector(".img-wrap")) return;
    const img = fit.querySelector(".img-wrap");
    const imgH = () => img.getBoundingClientRect().height;
    const overflows = () => fit.scrollHeight > fit.clientHeight + 1;
    fit.classList.remove("compact", "tiny");
    img.style.display = "";
    if (imgH() >= 110 && !overflows()) return;
    fit.classList.add("compact");
    if (imgH() >= 80 && !overflows()) return;
    fit.classList.add("tiny");
    if (imgH() >= 60 && !overflows()) return;
    img.style.display = "none"; // spazio troppo poco: meglio niente foto che una striscia
  }

  // Altezza reale visibile (Safari su iPhone ha barre che 100vh non considera)
  function setAppHeight() {
    const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    document.documentElement.style.setProperty("--app-h", Math.round(h) + "px");
    fitQuestion();
  }
  setAppHeight();
  // i caratteri del titolo arrivano dopo e allungano il testo: si riadatta quando sono pronti
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitQuestion);
  window.addEventListener("load", fitQuestion);
  window.addEventListener("resize", setAppHeight);
  window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 300));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", setAppHeight);

  // Timer con barra; onEnd scatta quando il tempo finisce.
  function tick(s, onEnd) {
    clearInterval(ticker);
    const update = () => {
      const r = C.remaining(s);
      const t = document.getElementById("t"), bar = document.getElementById("bar");
      if (t) { t.textContent = Math.ceil(r); t.classList.toggle("low", r <= 5); }
      if (bar) bar.style.width = (100 * r / s.q_seconds) + "%";
      if (r <= 0) { clearInterval(ticker); ticker = null; if (onEnd) onEnd(); }
    };
    update();
    ticker = setInterval(update, 200);
  }

  function renderWaiting(s, choice, title) {
    const q = Q[s.q_index];
    const sent = choice !== null && choice !== undefined;
    show(`
      <section class="screen fit">
        ${qTop(s, true)}
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:14px">
          <div class="bounce" style="font-size:56px">${sent ? "🤞" : "⏰"}</div>
          <h2 class="big-title">${title || (sent ? "Risposta inviata!" : "Tempo scaduto!")}</h2>
          ${sent ? `<div style="width:100%">${C.answerButton(choice, q.a[choice], "chosen")}</div>` : ""}
          <p class="dots">Vediamo se conosci davvero Simone</p>
        </div>
      </section>`);
    tick(s, null);
  }

  async function renderReveal(s) {
    const qi = s.q_index;
    const q = Q[qi];
    show(`<section class="screen">${qTop(s, false)}<div class="screen center"><p class="dots">Vediamo</p></div></section>`);
    let r = null;
    try {
      const rows = await C.rpc("my_result", { p_player: pid, p_q: qi });
      r = rows && rows[0];
    } catch (_) { /* mostriamo comunque la risposta giusta */ }
    if (viewKey !== `${s.phase}|${s.q_index}|${s.q_started_at}`) return; // nel frattempo è cambiato tutto

    const mine = r && r.choice !== null ? r.choice : answered[qi];
    const hasMine = mine !== undefined && mine !== null;
    const ok = r ? r.correct : hasMine && mine === s.correct;
    const total = r ? `<p class="total">Totale: <b>${r.score}</b> punti</p>` : "";
    let box;
    if (ok) box = `<div class="card result ok"><div class="big">Giusto! 🎉</div><p class="gain">+${r ? r.points : ""} punti</p>${total}</div>`;
    else if (hasMine) box = `<div class="card result ko"><div class="big">Sbagliato 😬</div><p>Simone si sente tradito.</p>${total}</div>`;
    else box = `<div class="card result ko"><div class="big">Niente risposta 💤</div><p>Il buffet ha avuto la meglio?</p>${total}</div>`;

    const correctBtn = C.answerButton(s.correct, q.a[s.correct], "correct").replace("</button>", '<span class="tick">✔</span></button>');
    show(`
      <section class="screen">
        ${qTop(s, false)}
        ${box}
        <p class="small muted">${C.esc(q.q)}</p>
        <div class="answers">
          <p class="small label"><b>Risposta giusta</b></p>
          ${correctBtn}
          ${hasMine && !ok ? `<p class="small muted label">Tu avevi detto</p>${C.answerButton(mine, q.a[mine], "dim")}` : ""}
        </div>
      </section>`);
    document.querySelectorAll(".ans").forEach((b) => { b.disabled = true; });
  }

  async function renderPodium() {
    show(`<section class="screen center">${header()}<p class="dots">Rullo di tamburi</p></section>`);
    const top = await C.top(3);
    let mine = null;
    try { const rows = await C.rpc("my_result", { p_player: pid, p_q: -1 }); mine = rows && rows[0]; } catch (_) { /* niente */ }
    show(`
      <section class="screen center">
        ${header()}
        <span class="pill">🏆 Il podio</span>
        <h1 class="big-title">Chi conosce davvero Simone?</h1>
        ${C.podiumHtml(top)}
        ${mine ? `<div class="card" style="width:100%"><p class="small muted">La tua posizione</p><p style="font-size:28px;font-weight:800">${mine.rank}° su ${mine.total}</p><p>${mine.score} punti</p></div>` : ""}
      </section>`);
    C.playPodium(main);
  }

  // ---------- Avvio ----------
  async function init() {
    if (!C.configured) {
      show(`<section class="screen center"><h2>Quiz non ancora configurato</h2><p class="muted">Mancano i dati di Supabase in js/config.js.</p></section>`);
      return;
    }
    await C.syncClock();
    if (pid) {
      try {
        const info = await C.rpc("player_info", { p_player: pid });
        if (info && info.length) { myName = info[0].name; return startGame(); }
        forgetPlayer();
      } catch (_) { return startGame(); } // rete lenta: proviamo comunque
    }
    showJoin();
  }

  init();
})();
