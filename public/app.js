const socket = io();
const $ = (id) => document.getElementById(id);
let currentRoom = null;
let myId = null;
let currentName = "";
let soundOn = false;
let lastChatCount = 0;

function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast._timer); toast._timer = setTimeout(() => el.classList.remove("show"), 2800);
}
function request(event, payload = {}) {
  return new Promise(resolve => socket.timeout(8000).emit(event, payload, (err, response) => {
    if (err) return resolve({ok:false,error:"A ligação demorou demasiado. Tenta novamente."});
    resolve(response || {ok:false,error:"Não foi possível concluir a ação."});
  }));
}
function setView(view) {
  $("welcome").classList.toggle("active", view === "welcome");
  $("game").classList.toggle("active", view === "game");
  window.scrollTo({top:0,behavior:"smooth"});
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function roomError(result) { if (!result.ok) toast(result.error || "Algo correu mal."); return result.ok; }
async function createRoom() {
  currentName = $("playerName").value.trim();
  if (!currentName) { $("playerName").focus(); return toast("Escreve o teu nome primeiro."); }
  const result = await request("room:create", {name:currentName,category:$("category").value, maxRounds:$("rounds").value, mode:$("playMode").value});
  if (!roomError(result)) return;
  currentRoom = result.code; setView("game"); toast("Sala criada! Partilha o código com a tua cara-metade. ♡");
  renderRoom(result.room);
}
async function joinRoom() {
  currentName = $("playerName").value.trim();
  if (!currentName) { $("playerName").focus(); return toast("Escreve o teu nome primeiro."); }
  const code = $("roomCode").value.trim().toUpperCase();
  if (!code) { $("roomCode").focus(); return toast("Escreve o código da sala."); }
  const result = await request("room:join", {name:currentName,code});
  if (!roomError(result)) return;
  currentRoom = result.code; setView("game"); toast("Entraste na sala. Que comece a cumplicidade! ♡"); renderRoom(result.room);
}
function renderPlayers(room) {
  const wrap = $("players"); wrap.innerHTML = "";
  room.players.forEach(p => {
    const chip = document.createElement("div"); chip.className = "player-chip";
    chip.innerHTML = `<div class="avatar">${escapeHtml(p.name.slice(0,1).toUpperCase())}</div><div><strong>${escapeHtml(p.name)}${p.id===room.hostId?" ✦":""}</strong><small>${p.id===myId?"És tu":"Na sala"}</small></div><span class="player-score">${p.score} pts</span>`;
    wrap.appendChild(chip);
  });
  if (!room.players.length) $("lobbyMessage").textContent = "A sala está vazia.";
  else if (room.players.length < 2) $("lobbyMessage").textContent = "À espera da outra pessoa… Partilha o código da sala.";
  else $("lobbyMessage").textContent = "Os dois corações estão na sala. Estão prontos? ♡";
}
function renderChat(room) {
  const wrap = $("chatMessages");
  if (!room.chat || !room.chat.length) {
    wrap.innerHTML = '<div class="chat-empty">Deixa aqui uma mensagem bonita. Às vezes, uma frase muda o dia. ♡</div>'; return;
  }
  wrap.innerHTML = room.chat.map(m => {
    const mine = m.name === currentName;
    const at = m.at ? new Date(m.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "";
    return `<div class="message ${mine?"mine":""}"><strong>${escapeHtml(m.name)}</strong><p>${escapeHtml(m.text)}</p><time>${at}</time></div>`;
  }).join("");
  if (room.chat.length !== lastChatCount) wrap.scrollTop = wrap.scrollHeight;
  lastChatCount = room.chat.length;
}
function renderAnswers(room) {
  const list = $("answersList");
  list.innerHTML = room.players.map(p => {
    const answer = room.answers && room.answers[p.id];
    return `<div class="answer-card"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(answer || "Sem resposta.")}</p></div>`;
  }).join("");
  const controls = $("scoreControls");
  controls.innerHTML = "";
  if (room.hostId === myId) {
    room.players.forEach(p => {
      const row = document.createElement("div"); row.className = "score-row";
      row.innerHTML = `<span>${escapeHtml(p.name)} · + pontos de carinho</span><div class="score-buttons"><button data-player="${p.id}" data-points="1">+1</button><button data-player="${p.id}" data-points="2">+2</button><button data-player="${p.id}" data-points="3">+3</button></div>`;
      controls.appendChild(row);
    });
    controls.querySelectorAll("button").forEach(btn => btn.addEventListener("click", async () => {
      const r = await request("score:award", {playerId:btn.dataset.player, points:Number(btn.dataset.points)});
      if (roomError(r)) toast("Pontos de carinho atribuídos! ♡");
    }));
  } else controls.innerHTML = '<p class="tiny-note">O anfitrião pode atribuir pontos de carinho às respostas.</p>';
}
function renderRoom(room) {
  if (!room) return;
  currentRoom = room.code;
  $("roomCodeDisplay").textContent = room.code;
  $("roundLabel").textContent = room.round ? `RONDA ${room.round} / ${room.maxRounds}` : `PRONTOS PARA ${room.maxRounds} RONDAS`;
  renderPlayers(room); renderChat(room);
  const isHost = room.hostId === myId;
  $("startGame").hidden = !(room.status === "lobby" && isHost);
  $("startGame").disabled = room.players.length < 2 && room.mode !== "local";
  $("lobbyMessage").hidden = room.status !== "lobby";
  $("questionPanel").hidden = room.status === "lobby";
  if (room.status === "lobby") return;
  $("questionText").textContent = room.currentQuestion ? room.currentQuestion.text : "Preparados para mais uma ronda?";
  $("categoryLabel").textContent = room.currentQuestion ? room.currentQuestion.category.toUpperCase() : "A VOSSA HISTÓRIA";
  $("answerForm").hidden = room.status !== "question";
  $("waitingAnswers").hidden = !["ready-to-reveal","revealed"].includes(room.status) || room.status === "revealed";
  $("revealArea").hidden = room.status !== "revealed";
  $("finishedArea").hidden = room.status !== "finished";
  $("statusLabel").textContent = room.status === "question" ? "A TUA VEZ DE RESPONDER" : room.status === "ready-to-reveal" ? "RESPOSTAS RECEBIDAS" : room.status === "revealed" ? "MOMENTO DE PARTILHAR" : "FIM DE JOGO";
  if (room.status === "question") {
    const submitted = room.answeredIds.includes(myId);
    $("answerText").disabled = submitted;
    $("submitAnswer").disabled = submitted;
    $("answerText").placeholder = submitted ? "A tua resposta já foi guardada." : "Responde com o coração…";
    if (submitted) $("waitingAnswers").hidden = false;
    else $("waitingAnswers").hidden = true;
  }
  if (room.status === "ready-to-reveal") {
    $("waitingAnswers").hidden = false;
    $("waitingAnswers").querySelector("strong").textContent = "As duas respostas chegaram!";
    $("waitingAnswers").querySelector("p").textContent = isHost ? "Podes revelar as respostas quando quiseres." : "O anfitrião vai revelar as respostas.";
    let reveal = $("revealButton");
    if (!reveal) {
      reveal = document.createElement("button"); reveal.id = "revealButton"; reveal.className = "primary-button"; reveal.textContent = "Revelar respostas ♡";
      $("waitingAnswers").appendChild(reveal);
      reveal.addEventListener("click", async () => { const r = await request("round:reveal"); if (!roomError(r)) return; });
    }
    reveal.hidden = !isHost;
  } else {
    const reveal = $("revealButton"); if (reveal) reveal.hidden = true;
  }
  if (room.status === "revealed") {
    renderAnswers(room);
    $("nextRound").hidden = !isHost;
    $("nextRound").textContent = room.round >= room.maxRounds ? "Ver resultado final ♡" : "Próxima ronda →";
  }
  if (room.status === "finished") {
    const ranking = [...room.players].sort((a,b)=>b.score-a.score);
    $("winnerText").textContent = ranking.length > 1 && ranking[0].score !== ranking[1].score
      ? `${ranking[0].name} terminou com mais pontos de carinho — mas o prémio maior é terem jogado juntos.`
      : "Empate nos pontos, vitória na cumplicidade. O mais importante foi partilharem este momento.";
    $("restartGame").hidden = !isHost;
  }
}
socket.on("connect", () => { myId = socket.id; $("connection").classList.add("online"); $("connection").innerHTML = "<i></i> Ligado"; });
socket.on("disconnect", () => { $("connection").classList.remove("online"); $("connection").innerHTML = "<i></i> Sem ligação"; toast("A ligação caiu. A tentar voltar a ligar…"); });
socket.on("app:ready", data => {
  $("category").innerHTML = "";
  (data.categories || ["Todas"]).forEach(c => { const o = document.createElement("option"); o.value=c; o.textContent=c; $("category").appendChild(o); });
});
socket.on("room:update", room => {
  if (currentRoom && room.code === currentRoom) renderRoom(room);
});
$("createRoom").addEventListener("click", createRoom);
$("joinRoom").addEventListener("click", joinRoom);
$("roomCode").addEventListener("input", e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5));
$("roomCode").addEventListener("keydown", e => { if (e.key === "Enter") joinRoom(); });
$("startGame").addEventListener("click", async () => { const r = await request("room:start"); if (roomError(r)) toast("A primeira pergunta está à vossa espera!"); });
$("answerText").addEventListener("input", () => $("charCount").textContent = `${$("answerText").value.length} / 1000`);
$("answerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const answer = $("answerText").value.trim();
  if (!answer) return toast("Escreve a tua resposta primeiro.");
  const r = await request("answer:submit", {answer});
  if (!roomError(r)) return;
  $("answerText").value = ""; $("charCount").textContent = "0 / 1000";
  toast("Resposta guardada com carinho. ♡");
});
$("nextRound").addEventListener("click", async () => { const r = await request("round:next"); if (!roomError(r)) return; if (r.finished) toast("Que bonita partida! ♡"); else $("answerText").value = ""; });
$("restartGame").addEventListener("click", async () => { const r = await request("room:restart"); if (roomError(r)) toast("Uma nova história começa agora. ♡"); });
$("chatForm").addEventListener("submit", async e => {
  e.preventDefault(); const message = $("chatInput").value.trim(); if (!message) return;
  const r = await request("chat:send", {message}); if (roomError(r)) $("chatInput").value = "";
});
$("copyCode").addEventListener("click", async () => {
  if (!currentRoom) return;
  try { await navigator.clipboard.writeText(currentRoom); toast("Código copiado: " + currentRoom); }
  catch { toast("O código da sala é " + currentRoom + "."); }
});
$("backHome").addEventListener("click", async () => {
  await request("room:leave"); currentRoom = null; setView("welcome");
});
$("soundToggle").addEventListener("click", () => { soundOn = !soundOn; $("soundToggle").textContent = soundOn ? "♫" : "♪"; toast(soundOn ? "Som ativado (em breve mais efeitos)." : "Som desativado."); });
