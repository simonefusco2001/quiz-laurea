// Domande del quiz (copiate dal Kahoot "Chi vuole essere dottore?").
// Le risposte corrette NON stanno qui: sono nel database (tabella quiz_key).
window.QUESTIONS = [
  { q: "Di cosa parla davvero la tesi di Simone?", a: ["Perché i clienti disdicono l'assicurazione", "Perché i clienti abbandonano la banca", "Perché i clienti cambiano operatore telefonico", "Perché gli abbonati lasciano le piattaforme di streaming"] },
  { q: "Come si chiama la squadra di fantacalcio di Simone?", a: ["Atletico Madonna", "Inter Nos", "Ac Avanti Cristo", "Real Mastella"] },
  { q: "Come si chiama il podcast che Simone ha fatto con i suoi amici?", a: ["Controtendenza", "Fuori Tendenza", "Fuori Contesto", "Fuori Target"] },
  { q: "Cosa si è dimenticato Simone il giorno della laurea?", a: ["La giacca", "Le scarpe eleganti", "La copia stampata della tesi", "La cravatta"] },
  { q: "Quanti minuti poteva durare al massimo la presentazione? Spoiler: non erano 15 :(", a: ["10", "7", "12", "5"] },
  { q: "Cosa ha rischiato Simone dopo aver svuotato degli estintori in un garage?", a: ["Una multa", "Tante botte dal padre", "Un risarcimento da centinaia di euro", "Tutte e tre"] },
  { q: "Quante porte di casa ha rotto Simone?", a: ["2", "5", "1", "4"] },
  { q: "Dove è stato abbandonato Simone, circondato dalle signorine della strada?", a: ["In un distributore di benzina", "Fuori da un locale", "In un autogrill", "In un parcheggio"] },
  { q: "Quanti supplì ha mangiato Simone in una sola sera?", a: ["3", "10", "5", "2"] },
  { q: "Qual è l'hobby preferito di Simone?", a: ["Cucinare", "Calcetto con gli amici", "Palestra", "Videogiochi"] },
  { q: "Cosa odia di più Simone?", a: ["Chi fa spoiler", "L'ananas sulla pizza", "Chi risponde \"ok\" a un messaggio lungo", "Chi arriva in ritardo"] },
  { q: "Cosa ha fatto Simone appena finita la proclamazione?", a: ["Ha insultato il professore", "Ha mangiato un supplì", "È tornato a casa a dormire", "È andato a pranzo con gli amici"] },
  { q: "Cosa risponde Simone a \"E ora che fai dopo la laurea?\"", a: ["Mi prendo una pausa lunga", "Mi godo il Natale", "Cerco lavoro", "Mi faccio mantenere"] },
  { q: "Cosa urla Simone quando perde a fantacalcio?", a: ["Disinstallo tutto", "Invoca il nostro signore", "Non gioco più", "Comblotto"] },
  { q: "Cosa dice Simone quando è in ritardo?", a: ["Dieci minuti e ci sono", "Sto parcheggiando", "Sono già sotto", "Sto arrivando"] },
  { q: "Quale frase di Simone fa alzare gli occhi al cielo a tutti?", a: ["Posso dire una cosa?", "Claude dice...", "Io l'avevo detto", "Non si fa così"] },
  { q: "Quale di queste persone ha più probabilità di parlare di lavoro alla festa?", a: ["Papà", "Antonio", "Valerio", "Lorenzo"] },
  { q: "Quale santo Simone invoca di più?", a: ["Dio", "Padre Pio", "San Gennaro", "Madonna"] },
  { q: "Quanti anni Simone ha vissuto a Varese?", a: ["3", "7", "4", "10"] },
  { q: "A chi assomiglia di più Simone?", a: ["Il capitone", "Tinky Winky", "Il cantante del Volo", "Christian Grey"] },
].map((x, i) => ({ ...x, img: `img/domanda_${String(i + 1).padStart(2, "0")}.jpg` }));
