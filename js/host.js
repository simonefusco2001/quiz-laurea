// Pannello del conduttore (pensato per il telefono): QR, avvio, domande, risposta giusta, podio, ricomincia.
// Il pulsante principale sta sempre in basso, a portata di pollice.
(function () {
  const C = window.Quiz;
  const Q = window.QUESTIONS;
  const main = document.getElementById("main");
  const playerUrl = new URL("./", location.href).href;

  let pin = sessionStorage.getItem("quiz_pin") || "";
  let viewKey = "";
  let timer = null;
  let statsPoll = null;
  let revealing = false;

  const show = (html) => { main.innerHTML = html; window.scrollTo(0, 0); };
  const stop = () => { clearInterval(timer); clearInterval(statsPoll); timer = statsPoll = null; };
  const $ = (id) => document.getElementById(id);

  async function act(btn, fn) {
    if (btn) btn.disabled = true;
    try { await fn(); } catch (e) { alert("Errore: " + ((e && e.message) || "connessione") + ". Riprova."); }
    if (btn) btn.disabled = false;
  }

  const startQuestion = (i) => C.rpc("host_start_question", { p_pin: pin, p_q: i });
  const reveal = () => C.rpc("host_reveal", { p_pin: pin });
  const setPhase = (p) => C.rpc("host_set_phase", { p_pin: pin, p_phase: p });

  // Menu "Altro" chiuso in fondo: link, pausa, ricomincia (cose che servono di rado)
  function more(withPause) {
    return `
      <details class="more">
        <summary>Altro</summary>
        <div class="more-body">
          <p class="small">Link per i giocatori:<br><a href="${playerUrl}" target="_blank">${C.esc(playerUrl)}</a></p>
          ${withPause ? '<button class="btn white" id="pause">Pausa (tutti in sala d\'attesa)</button>' : ""}
          <button class="btn danger" id="reset">Ricomincia da zero</button>
        </div>
      </details>`;
  }
  function bindMore() {
    const p = $("pause");
    if (p) p.addEventListener("click", () => act(p, () => setPhase("lobby")));
    const b = $("reset");
    if (b) b.addEventListener("click", () => {
      const ok = prompt("Cancella giocatori e punteggi e torna all'inizio.\nScrivi RESET per confermare.");
      if (ok !== "RESET") return;
      act(b, async () => { await C.rpc("host_reset", { p_pin: pin }); viewKey = ""; });
    });
  }

  const top = (left, mid, withTimer, s) => `
    <div class="q-top">
      <span class="pill">${left}</span>
      <span class="q-name">${mid}</span>
      ${withTimer ? `<div class="timer" id="t">${Math.ceil(C.remaining(s))}</div>` : ""}
    </div>`;

  // ---------- Accesso ----------
  function showLogin(msg = "") {
    show(`
      <section class="screen center">
        <span class="pill">🎬 Regia</span>
        <h1 class="big-title">Pannello di Simone</h1>
        <form id="login" class="card" style="width:100%;display:flex;flex-direction:column;gap:12px">
          <input id="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN del conduttore" required>
          <p class="error">${C.esc(msg)}</p>
          <button class="btn" type="submit">Entra</button>
        </form>
      </section>`);
    $("login").addEventListener("submit", async (e) => {
      e.preventDefault();
      const p = $("pin").value.trim();
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
    const next = resume ? s.q_index + 1 : 0;
    const label = resume ? (next >= Q.length ? "🏆 Mostra il podio" : `Riprendi dalla domanda ${next + 1}`) : "▶ Avvia il quiz";
    show(`
      <section class="screen host">
        ${top("🎬 Regia", resume ? "In pausa" : "Sala d'attesa", false)}
        <div class="card count-card">
          <p class="bignum" id="count">0</p>
          <p class="small muted">giocatori dentro</p>
        </div>
        <div class="card"><div class="names" id="names"><span class="muted">Ancora nessuno</span></div></div>
        <div class="card lobby-qr">
          <div class="qr" id="qr"></div>
          <div class="lobby-qr-text">
            <b>Fate inquadrare il QR</b>
            <span class="small muted">a chi non l'ha ancora ricevuto</span>
            <button class="btn yellow slim" id="dl">Scarica QR</button>
          </div>
        </div>
        ${more(false)}
        <div class="actionbar"><button class="btn" id="go">${label}</button></div>
      </section>`);
    new QRCode($("qr"), { text: playerUrl, width: 400, height: 400, correctLevel: QRCode.CorrectLevel.M });
    $("dl").addEventListener("click", downloadQr);
    $("go").addEventListener("click", (e) => act(e.currentTarget, () => next >= Q.length ? setPhase("podium") : startQuestion(next)));
    bindMore();
    const refresh = async () => {
      const { data } = await C.sb.from("players").select("name").order("created_at");
      if (!data || !$("count")) return;
      $("count").textContent = data.length;
      $("names").innerHTML = data.length ? data.map((p) => `<span>${C.esc(p.name)}</span>`).join("") : '<span class="muted">Ancora nessuno</span>';
    };
    refresh();
    statsPoll = setInterval(refresh, 2000);
  }

  function downloadQr() {
    const canvas = $("qr").querySelector("canvas");
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
      <section class="screen host">
        ${top(`${qi + 1}/${Q.length}`, "Domanda in corso", true, s)}
        <div class="timebar"><div id="bar"></div></div>
        <h2 class="q-text">${C.esc(q.q)}</h2>
        <div class="card count-card">
          <p class="bignum"><span id="ans">0</span><span class="muted"> / <span id="tot">0</span></span></p>
          <p class="small muted">hanno risposto</p>
          <div class="progress"><div id="prog"></div></div>
        </div>
        <div class="answers mini">${q.a.map((a, i) => C.answerButton(i, a)).join("")}</div>
        ${more(true)}
        <div class="actionbar"><button class="btn yellow" id="rev">Mostra la risposta ora</button></div>
      </section>`);
    document.querySelectorAll(".answers .ans").forEach((b) => { b.disabled = true; });
    $("rev").addEventListener("click", (e) => act(e.currentTarget, reveal));
    bindMore();

    let answered = 0, players = 0;
    const doReveal = () => {
      if (revealing) return;
      revealing = true;
      reveal().catch(() => { revealing = false; });
    };
    const update = () => {
      const r = C.remaining(s);
      const t = $("t"), bar = $("bar");
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
        if (!$("ans")) return;
        $("ans").textContent = answered;
        $("tot").textContent = players;
        $("prog").style.width = (players ? 100 * answered / players : 0) + "%";
      } catch (_) { /* al prossimo giro */ }
    };
    update(); stats();
    timer = setInterval(update, 200);
    statsPoll = setInterval(stats, 1500);
  }

  // ---------- Risposta giusta ----------
  async function renderReveal(s) {
    const qi = s.q_index, q = Q[qi];
    const last = qi >= Q.length - 1;
    const nextQ = last ? null : Q[qi + 1];
    show(`
      <section class="screen host">
        ${top(`${qi + 1}/${Q.length}`, "Risposta", false)}
        <h2 class="q-text">${C.esc(q.q)}</h2>
        <div class="answers mini" id="rows">${rowsHtml(q, s.correct, null)}</div>
        <p class="small muted" id="summary"></p>
        ${more(true)}
        <div class="actionbar">
          ${nextQ ? `<p class="next-hint">Prossima: ${C.esc(nextQ.q)}</p>` : ""}
          <button class="btn" id="next">${last ? "🏆 Mostra il podio" : `Prossima domanda (${qi + 2}) →`}</button>
        </div>
      </section>`);
    document.querySelectorAll(".answers .ans").forEach((b) => { b.disabled = true; });
    $("next").addEventListener("click", (e) => act(e.currentTarget, () => last ? setPhase("podium") : startQuestion(qi + 1)));
    bindMore();

    // quante persone hanno scelto ogni risposta
    try {
      const counts = await C.rpc("host_choice_counts", { p_pin: pin }, 2);
      if (viewKey !== `${s.phase}|${s.q_index}|${s.q_started_at}` || !$("rows")) return;
      const by = [0, 0, 0, 0];
      (counts || []).forEach((r) => { by[r.choice] = r.n; });
      const tot = by.reduce((a, b) => a + b, 0);
      $("rows").innerHTML = rowsHtml(q, s.correct, by);
      document.querySelectorAll(".answers .ans").forEach((b) => { b.disabled = true; });
      $("summary").textContent = tot ? `${by[s.correct]} su ${tot} hanno indovinato` : "Nessuno ha risposto";
    } catch (_) { /* il conteggio è un di più */ }
  }

  function rowsHtml(q, correct, counts) {
    return q.a.map((a, i) => {
      const extra = (i === correct ? '<span class="tick">✔</span>' : "") + (counts ? `<span class="cnt">${counts[i]}</span>` : "");
      return C.answerButton(i, a, i === correct ? "correct" : "dim").replace("</button>", extra + "</button>");
    }).join("");
  }

  // ---------- Podio ----------
  async function renderPodium() {
    const top10 = await C.top(10);
    show(`
      <section class="screen host">
        ${top("🏆 Podio", "Fine del quiz", false)}
        ${C.podiumHtml(top10.slice(0, 3))}
        <h3>Classifica (la vedi solo tu)</h3>
        ${C.boardHtml(top10, "")}
        ${more(false)}
      </section>`);
    C.playPodium(main);
    bindMore();
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
