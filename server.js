const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const questionsData = require("./public/questions.json");
const categories = questionsData.categories;
const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, app: "Estamos Juntos, Amor… Sempre" }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({length: 5}, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}
function cleanName(value) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, 24);
}
function publicRoom(room) {
  return {
    code: room.code,
    mode: room.mode,
    category: room.category,
    round: room.round,
    maxRounds: room.maxRounds,
    status: room.status,
    players: [...room.players.values()].map(p => ({id:p.id, name:p.name, score:p.score, ready:p.ready})),
    currentQuestion: room.currentQuestion,
    answers: room.status === "revealed" ? Object.fromEntries(room.answers) : {},
    answeredIds: [...room.answers.keys()],
    hostId: room.hostId,
    chat: room.chat.slice(-40)
  };
}
function emitRoom(room) { io.to(room.code).emit("room:update", publicRoom(room)); }
function chooseQuestion(category, previousIds = []) {
  let pool = categories.filter(c => category === "Todas" || c.name === category);
  let all = pool.flatMap(c => c.questions.map((text, idx) => ({id: `${c.name}:${idx}`, category:c.name, text})));
  if (!all.length) all = categories.flatMap(c => c.questions.map((text, idx) => ({id:`${c.name}:${idx}`, category:c.name, text})));
  const fresh = all.filter(q => !previousIds.includes(q.id));
  const pickFrom = fresh.length ? fresh : all;
  return pickFrom[crypto.randomInt(pickFrom.length)];
}
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.roomCode = null;
  if (!room) return;
  room.players.delete(socket.id);
  room.answers.delete(socket.id);
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value || null;
  if (room.players.size === 0) rooms.delete(code);
  else emitRoom(room);
}
io.on("connection", socket => {
  socket.emit("app:ready", {categories: ["Todas", ...categories.map(c => c.name)], totalQuestions: categories.reduce((n,c)=>n+c.questions.length,0)});
  socket.on("room:create", (payload = {}, cb = () => {}) => {
    leaveRoom(socket);
    const name = cleanName(payload.name);
    if (!name) return cb({ok:false, error:"Escreve o teu nome para continuar."});
    const code = makeCode();
    const room = {
      code, mode: payload.mode === "local" ? "local" : "online",
      category: categories.some(c=>c.name===payload.category) ? payload.category : "Todas",
      maxRounds: Math.max(3, Math.min(30, Number(payload.maxRounds) || 10)),
      round: 0, status:"lobby", players:new Map(), answers:new Map(),
      hostId:socket.id, currentQuestion:null, usedQuestionIds:[], chat:[]
    };
    room.players.set(socket.id, {id:socket.id, name, score:0, ready:true});
    rooms.set(code, room);
    socket.join(code); socket.data.roomCode = code;
    cb({ok:true, code, room:publicRoom(room)});
    emitRoom(room);
  });
  socket.on("room:join", (payload = {}, cb = () => {}) => {
    leaveRoom(socket);
    const code = String(payload.code || "").trim().toUpperCase();
    const name = cleanName(payload.name);
    const room = rooms.get(code);
    if (!name) return cb({ok:false, error:"Escreve o teu nome para continuar."});
    if (!room) return cb({ok:false, error:"Não encontrei essa sala. Confirma o código."});
    if (room.players.size >= 2 && !room.players.has(socket.id)) return cb({ok:false, error:"Esta sala já tem dois jogadores."});
    if (room.status !== "lobby" && room.status !== "finished") return cb({ok:false, error:"A partida já começou. Pede ao anfitrião para criar outra sala."});
    room.players.set(socket.id, {id:socket.id, name, score:0, ready:true});
    socket.join(code); socket.data.roomCode = code;
    cb({ok:true, code, room:publicRoom(room)});
    emitRoom(room);
  });
  socket.on("room:start", (_payload, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb({ok:false,error:"Entra numa sala primeiro."});
    if (room.hostId !== socket.id) return cb({ok:false,error:"Só quem criou a sala pode iniciar."});
    if (room.players.size < 2 && room.mode !== "local") return cb({ok:false,error:"A outra pessoa ainda não entrou na sala."});
    if (room.status !== "lobby" && room.status !== "finished") return cb({ok:false,error:"A partida já está em curso."});
    room.round = 1; room.status = "question"; room.answers.clear();
    room.currentQuestion = chooseQuestion(room.category, room.usedQuestionIds);
    room.usedQuestionIds.push(room.currentQuestion.id);
    cb({ok:true}); emitRoom(room);
  });
  socket.on("answer:submit", (payload = {}, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== "question") return cb({ok:false,error:"Não há uma pergunta aberta neste momento."});
    if (!room.players.has(socket.id)) return cb({ok:false,error:"Não estás nesta sala."});
    const answer = String(payload.answer || "").trim().slice(0, 1000);
    if (!answer) return cb({ok:false,error:"Escreve uma resposta antes de enviar."});
    room.answers.set(socket.id, answer);
    emitRoom(room);
    cb({ok:true});
    if (room.answers.size >= Math.min(2, room.players.size) && room.players.size >= 2) {
      // Answers remain hidden until host reveals them.
      room.status = "ready-to-reveal";
      emitRoom(room);
    }
  });
  socket.on("round:reveal", (_payload, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb({ok:false,error:"Sala não encontrada."});
    if (room.hostId !== socket.id) return cb({ok:false,error:"Só o anfitrião pode revelar as respostas."});
    if (room.answers.size < Math.min(2, room.players.size)) return cb({ok:false,error:"Esperem pelas respostas dos dois jogadores."});
    room.status = "revealed"; emitRoom(room); cb({ok:true});
  });
  socket.on("score:award", (payload = {}, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== "revealed") return cb({ok:false,error:"Revela as respostas primeiro."});
    if (room.hostId !== socket.id) return cb({ok:false,error:"Só o anfitrião pode atribuir pontos."});
    const player = room.players.get(String(payload.playerId || ""));
    if (!player) return cb({ok:false,error:"Jogador não encontrado."});
    player.score += Math.max(0, Math.min(5, Number(payload.points) || 0));
    emitRoom(room); cb({ok:true});
  });
  socket.on("round:next", (_payload, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb({ok:false,error:"Sala não encontrada."});
    if (room.hostId !== socket.id) return cb({ok:false,error:"Só o anfitrião pode avançar."});
    if (room.status !== "revealed") return cb({ok:false,error:"Revela as respostas antes de avançar."});
    if (room.round >= room.maxRounds) {
      room.status = "finished";
      emitRoom(room); cb({ok:true, finished:true}); return;
    }
    room.round += 1; room.status = "question"; room.answers.clear();
    room.currentQuestion = chooseQuestion(room.category, room.usedQuestionIds);
    room.usedQuestionIds.push(room.currentQuestion.id);
    emitRoom(room); cb({ok:true});
  });
  socket.on("room:restart", (_payload, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb({ok:false,error:"Sala não encontrada."});
    if (room.hostId !== socket.id) return cb({ok:false,error:"Só o anfitrião pode recomeçar."});
    room.round=0; room.status="lobby"; room.answers.clear(); room.currentQuestion=null;
    room.usedQuestionIds=[]; room.players.forEach(p=>p.score=0);
    emitRoom(room); cb({ok:true});
  });
  socket.on("chat:send", (payload = {}, cb = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.players.has(socket.id)) return cb({ok:false,error:"Entra numa sala primeiro."});
    const message = String(payload.message || "").trim().slice(0, 300);
    if (!message) return cb({ok:false,error:"Escreve uma mensagem."});
    room.chat.push({id:crypto.randomUUID(), name:room.players.get(socket.id).name, text:message, at:new Date().toISOString()});
    room.chat = room.chat.slice(-80);
    emitRoom(room); cb({ok:true});
  });
  socket.on("room:leave", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

server.listen(PORT, () => {
  console.log(`Estamos Juntos, Amor… Sempre a correr na porta ${PORT}`);
  if (PUBLIC_URL) console.log(`URL pública: ${PUBLIC_URL}`);
});
