// Pannello del conduttore: QR, avvio, domande, risposta giusta, podio, ricomincia.
(function () {
  const C = window.Quiz;
  const Q = window.QUESTIONS;
  const main = document.getElementById("main");
  const playerUrl = new URL("./", location.href).href;

  let pin = sessionStorage.getItem("quiz_pin") || "";
  let state = null;
  let viewKey = "";
  let timer = null;
  let statsPoll = null;
  let revealing = false;

  const show = (html) => { main.innerHTML = html; };
  const stop = () => { clearInterval(timer); clearInterval(statsPoll); timer = statsPoll = null; };

  async function act(btn, fn) {
    if (btn) btn.disabled = true;
    try { await fn(); } catch (e) { alert("Errore: " + ((e && e.message) || "connessione") + ". Riprova."); }
    if (btn) btn.disabled = false;
  }

  const startQuestion = (i) => C.rpc("host_start_question", { p_pin: pin, p_q: i });
  const reveal = () => C.rpc("host_reveal", { p_pin: pin });
  const setPhase = (p) => C.rpc("host_set_phase", { p_pin: pin, p_phase: p });

  function footer() {
    return `
      <div class="card small" style="margin-top:auto">
        <p style="margin-bottom:8px"><b>Link del quiz:</b> <a href="${playerUrl}" target="_blank">${C.esc(playerUrl)}</a></p>
        <button class="btn danger" id="reset">Ricomincia da zero</button>
      </div>`;
  }
  function bindFooter() {
    const b = document.getElementById("reset");
    if (!b) return;
    b.addEventListener("click", () => {
      const ok = prompt("Cancella giocatori e punteggi e torna all'inizio.\nScrivi RESET per confermare.");
      if (ok !== "RESET") return;
      act(b, async () => { await C.rpc("host_reset", { p_pin: pin }); viewKey = ""; });
    });
  }

  // ---------- Accesso ----------
  function showLogin(msg = "") {
    show(`
      <section class="screen center">
        <span class="pill">🎬 Regia</span>
        <h1 class="big-title">Pannello di Simone</h1>
        <form id="login" class="card" style="width:100%;display:flex;flex-direction:column;gap:12px">
          <input id="pin" type="password" placeholder="PIN del conduttore" required>
          <p class="error">${C.esc(msg)}</p>
          <button class="btn" type="submit">Entra</button>
        </form>
      </section>`);
    document.getElementById("login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const p = document.getElementById("pin").value.trim();
      try {
        const ok = await C.rpc("host_check", { p_pin: p });
        if (!ok) return showLogin("PIN sbagliato");
        pin = p; sessionStorage.setItem("quiz_pin", pin);
        start();
      } catch (_) { showLogin("Connessione lenta, riprova"); }
    });
  }

  function start() { viewKey = ""; C.keepAwake(); C.watchState(render); }

  function render(s) {
    state = s;
    const key = `${s.phase}|${s.q_index}|${s.q_started_at}`;
    if (key === viewKey) return;
    viewKey = key;
    stop();
    revealing = false;
    if (s.phase === "question") return renderQuestion(s);
    if (s.phase === "reveal") return renderReveal(s);
    if (s.phase === "podium") return renderPodium();
    return renderLobby(s);
  }

  // ---------- Sala d'attesa ----------
  function renderLobby(s) {
    const resume = s.q_index >= 0;
    show(`
      <section class="screen">
        <div class="q-head"><span class="pill">🎬 Regia</span><span class="pill" style="background:#fff"><b id="count">0</b> giocatori</span></div>
        <div class="card" style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px">
          <h2>Inquadra per giocare</h2>
          <div class="qr" id="qr"></div>
          <button class="btn yellow" id="dl">Scarica il QR</button>
        </div>
        <div class="card"><div class="names" id="names"><span class="muted">Ancora nessuno</span></div></div>
        <button class="btn" id="go">${resume ? `Riprendi dalla domanda ${s.q_index + 2}` : "Avvia il quiz"}</button>
        ${footer()}
      </section>`);
    new QRCode(document.getElementById("qr"), { text: playerUrl, width: 440, height: 440, correctLevel: QRCode.CorrectLevel.M });
    document.getElementById("dl").addEventListener("click", downloadQr);
    document.getElementById("go").addEventListener("click", (e) => act(e.target, async () => {
      const next = resume ? s.q_index + 1 : 0;
      if (next >= Q.length) await setPhase("podium"); else await startQuestion(next);
    }));
    bindFooter();
    const refresh = async () => {
      const { data } = await C.sb.from("players").select("name").order("created_at");
      if (!data) return;
      const c = document.getElementById("count"), n = document.getElementById("names");
      if (!c || !n) return;
      c.textContent = data.length;
      n.innerHTML = data.length ? data.map((p) => `<span>${C.esc(p.name)}</span>`).join("") : '<span class="muted">Ancora nessuno</span>';
    };
    refresh();
    statsPoll = setInterval(refresh, 2000);
  }

  function downloadQr() {
    const box = document.getElementById("qr");
    const canvas = box.querySelector("canvas");
    // QR con margine bianco e titolo, pronto da mandare su WhatsApp
    const out = document.createElement("canvas");
    out.width = 600; out.height = 720;
    const g = out.getContext("2d");
    g.fillStyle = "#fff6e5"; g.fillRect(0, 0, 600, 720);
    g.fillStyle = "#111"; g.font = "800 40px 'Bricolage Grotesque', sans-serif"; g.textAlign = "center";
    g.fillText("Chi vuole essere dottore?", 300, 70);
    g.fillStyle = "#fff"; g.fillRect(60, 110, 480, 480);
    g.strokeStyle = "#111"; g.lineWidth = 6; g.strokeRect(60, 110, 480, 480);
    g.drawImage(canvas, 80, 130, 440, 440);
    g.fillStyle = "#111"; g.font = "600 24px Inter, sans-serif";
    g.fillText("Inquadra e gioca al quiz su Simone 🎓", 300, 650);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = "qr-quiz-simone.png";
    a.click();
  }

  // ---------- Domanda in corso ----------
  function renderQuestion(s) {
    const qi = s.q_index, q = Q[qi];
    show(`
      <section class="screen">
        <div class="q-head"><span class="pill">Domanda ${qi + 1} di ${Q.length}</span><div class="timer" id="t">${Math.ceil(C.remaining(s))}</div></div>
        <div class="timebar"><div id="bar"></div></div>
        <h2 class="q-text">${C.esc(q.q)}</h2>
        <img class="q-img" src="${q.img}" alt="">
        <div class="card" style="text-align:center"><p class="small muted">Hanno risposto</p><p style="font-size:34px;font-weight:800"><span id="ans">0</span> / <span id="tot">0</span></p></div>
        <button class="btn yellow" id="rev">Mostra la risposta ora</button>
        ${footer()}
      </section>`);
    document.getElementById("rev").addEventListener("click", (e) => act(e.target, reveal));
    bindFooter();

    let answered = 0, players = 0;
    const doReveal = () => {
      if (revealing) return;
      revealing = true;
      reveal().catch(() => { revealing = false; });
    };
    const update = () => {
      const r = C.remaining(s);
      const t = document.getElementById("t"), bar = document.getElementById("bar");
      if (t) { t.textContent = Math.ceil(r); t.classList.toggle("low", r <= 5); }
      if (bar) bar.style.width = (100 * r / s.q_seconds) + "%";
      // si passa alla risposta quando scade il tempo (+1 s di margine) o hanno risposto tutti
      if (r <= 0 && C.remaining({ ...s, q_seconds: s.q_seconds + 1 }) <= 0) doReveal();
      else if (players > 0 && answered >= players) doReveal();
    };
    const stats = async () => {
      try {
        const rows = await C.rpc("host_answer_stats", { p_pin: pin }, 1);
        if (rows && rows[0]) { answered = rows[0].answered; players = rows[0].players; }
        const a = document.getElementById("ans"), tt = document.getElementById("tot");
        if (a) a.textContent = answered;
        if (tt) tt.textContent = players;
      } catch (_) { /* al prossimo giro */ }
    };
    update(); stats();
    timer = setInterval(update, 200);
    statsPoll = setInterval(stats, 1500);
  }

  // ---------- Risposta giusta ----------
  function renderReveal(s) {
    const qi = s.q_index, q = Q[qi];
    const last = qi >= Q.length - 1;
    show(`
      <section class="screen">
        <span class="pill" style="align-self:flex-start">Domanda ${qi + 1} di ${Q.length}</span>
        <h2 class="q-text">${C.esc(q.q)}</h2>
        <div class="answers">${q.a.map((a, i) => C.answerButton(i, a, i === s.correct ? "correct" : "dim")
          .replace("</button>", i === s.correct ? '<span class="tick">✔</span></button>' : "</button>")).join("")}</div>
        <button class="btn" id="next">${last ? "🏆 Mostra il podio" : `Prossima domanda (${qi + 2})`}</button>
        <button class="btn white" id="pause">Pausa (torna alla sala d'attesa)</button>
        ${footer()}
      </section>`);
    document.querySelectorAll(".ans").forEach((b) => { b.disabled = true; });
    document.getElementById("next").addEventListener("click", (e) => act(e.target, () => last ? setPhase("podium") : startQuestion(qi + 1)));
    document.getElementById("pause").addEventListener("click", (e) => act(e.target, () => setPhase("lobby")));
    bindFooter();
  }

  // ---------- Podio ----------
  async function renderPodium() {
    const top = await C.top(10);
    show(`
      <section class="screen">
        <span class="pill" style="align-self:flex-start">🏆 Podio</span>
        ${C.podiumHtml(top.slice(0, 3))}
        <h3>Classifica (solo tu la vedi tutta)</h3>
        ${C.boardHtml(top, "")}
        ${footer()}
      </section>`);
    C.playPodium(main);
    bindFooter();
  }

  // ---------- Avvio ----------
  async function init() {
    if (!C.configured) {
      show(`<section class="screen center"><h2>Quiz non ancora configurato</h2><p class="muted">Mancano i dati di Supabase in js/config.js.</p></section>`);
      return;
    }
    await C.syncClock();
    if (pin) {
      try { if (await C.rpc("host_check", { p_pin: pin })) return start(); } catch (_) { /* niente */ }
    }
    showLogin();
  }

  init();
})();
