let experienceDB = {};
let totalLearnedGames = 0;
const transpositionTable = new Map();
const cloudCache = new Map();

// === P2P МАЯЧОК "СВОЙ-ЧУЖОЙ" (HVH EXTENSION DETECTOR) ===
const MY_INSTANCE_ID = "cc_" + Math.random().toString(36).slice(2, 10);
const activeRoomBeacons = new Map();

async function syncRoomBeacon(roomId, myColor, style, elo, autoMove) {
  if (!roomId || roomId.length < 8) return { detected: false };
  const cleanRoom = roomId.slice(0, 8).toLowerCase();
  const topic = `cc_rw10_${cleanRoom}`;
  const url = `https://ntfy.sh/${topic}`;

  // 1. Отправляем свой маячок при входе в комнату или смене настроек
  const beaconKey = `${topic}_${myColor}_${style}_${elo}_${autoMove}`;
  if (!activeRoomBeacons.has(beaconKey)) {
    if (activeRoomBeacons.size > 200) activeRoomBeacons.clear();
    activeRoomBeacons.set(beaconKey, Date.now());
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Title": "CC_BEACON" },
        body: JSON.stringify({
          id: MY_INSTANCE_ID,
          color: myColor,
          style,
          elo,
          auto: Boolean(autoMove),
          ts: Date.now()
        })
      });
    } catch (e) {}
  }

  // 2. Проверяем наличие маячка от второго игрока в этой же партии
  try {
    const res = await fetch(`${url}/json?poll=1&since=20m`, { cache: "no-store" });
    if (!res.ok) return { detected: false };
    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      let env = null;
      try { env = JSON.parse(lines[i]); } catch (e) { continue; }
      if (!env || !env.message) continue;

      let data = null;
      try { data = JSON.parse(env.message); } catch (e) { continue; }
      if (!data || !data.id) continue;

      // Срабатывает и между разными ПК (разный id), и при тесте в двух вкладках одного браузера (разный цвет)
      const isDifferentInstance = data.id !== MY_INSTANCE_ID;
      const isOppositeSide = myColor && data.color && data.color !== myColor;

      if (isDifferentInstance || isOppositeSide) {
        return {
          detected: true,
          enemyStyle: data.style || "tal",
          enemyElo: data.elo || 2000,
          enemyAuto: Boolean(data.auto)
        };
      }
    }
  } catch (e) {}

  return { detected: false };
}

let lastAnalyzedState = {
  board: null,
  turn: null,
  pureBestScoreForWhite: 0
};

if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(["experienceDB", "totalLearnedGames"], (res) => {
    if (res.experienceDB) experienceDB = res.experienceDB;
    if (res.totalLearnedGames) totalLearnedGames = Number(res.totalLearnedGames);
  });
}

function saveExperienceDB() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ experienceDB, totalLearnedGames });
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CHECK_PEER_BEACON") {
    syncRoomBeacon(request.roomId, request.myColor, request.style, request.elo, request.autoMove)
      .then((res) => sendResponse(res))
      .catch(() => sendResponse({ detected: false }));
    return true;
  }

  if (request.type === "ANALYZE_POSITION") {
    analyzeMasterRework(
      request.fen,
      request.elo || 2000,
      request.style || "tal",
      request.pass || "fast"
    )
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (request.type === "RECORD_GAME_RESULT") {
    const { history, result } = request;
    if (Array.isArray(history) && history.length > 0) {
      totalLearnedGames++;
      history.forEach((item, idx) => {
        if (!item.fenKey || !item.uci) return;
        if (!experienceDB[item.fenKey]) experienceDB[item.fenKey] = {};
        if (!experienceDB[item.fenKey][item.uci]) {
          experienceDB[item.fenKey][item.uci] = { bonus: 0, games: 0 };
        }
        const entry = experienceDB[item.fenKey][item.uci];
        entry.games++;

        if (result === "win") {
          entry.bonus = Math.min(220, entry.bonus + 42);
        } else if (result === "loss") {
          if (idx >= history.length - 4) {
            entry.bonus = Math.max(-300, entry.bonus - 95);
          } else {
            entry.bonus = Math.max(-140, entry.bonus - 25);
          }
        }
      });
      saveExperienceDB();
    }
    sendResponse({
      ok: true,
      totalLearnedGames,
      positionsCount: Object.keys(experienceDB).length
    });
    return true;
  }

  if (request.type === "TRAIN_MOVE_MANUAL") {
    const { fenKey, uci, delta } = request;
    if (fenKey && uci) {
      if (!experienceDB[fenKey]) experienceDB[fenKey] = {};
      if (!experienceDB[fenKey][uci]) experienceDB[fenKey][uci] = { bonus: 0, games: 0 };
      experienceDB[fenKey][uci].bonus = Math.max(-320, Math.min(300, experienceDB[fenKey][uci].bonus + delta));
      experienceDB[fenKey][uci].games++;
      saveExperienceDB();
    }
    sendResponse({
      ok: true,
      positionsCount: Object.keys(experienceDB).length
    });
    return true;
  }

  if (request.type === "GET_MEMORY_STATS") {
    sendResponse({
      totalLearnedGames,
      positionsCount: Object.keys(experienceDB).length,
      experienceDB
    });
    return true;
  }

  if (request.type === "CLEAR_MEMORY") {
    experienceDB = {};
    totalLearnedGames = 0;
    transpositionTable.clear();
    cloudCache.clear();
    saveExperienceDB();
    sendResponse({ ok: true });
    return true;
  }
});

const PIECE_VALUES = { p: 100, n: 320, b: 335, r: 500, q: 920, k: 20000 };
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const GM_STYLES = {
  mogging:   { tropism: 3.15, safety: 1.45, space: 1.65, bishopBonus: 24, sacrificeBoost: 315, squeeze: 1.50, checkBonus: 58, structure: 1.25 },
  tal:       { tropism: 2.85, safety: 1.35, space: 1.45, bishopBonus: 20, sacrificeBoost: 305, squeeze: 0.60, checkBonus: 48, structure: 1.15 },
  alphazero: { tropism: 2.35, safety: 1.65, space: 2.25, bishopBonus: 55, sacrificeBoost: 245, squeeze: 2.35, checkBonus: 32, structure: 1.75 },
  morphy:    { tropism: 3.30, safety: 1.25, space: 2.05, bishopBonus: 42, sacrificeBoost: 320, squeeze: 0.90, checkBonus: 65, structure: 1.05 },
  hikaru:    { tropism: 2.65, safety: 1.75, space: 1.85, bishopBonus: 30, sacrificeBoost: 210, squeeze: 1.65, checkBonus: 52, structure: 1.35 },
  kasparov:  { tropism: 2.25, safety: 1.55, space: 1.95, bishopBonus: 28, sacrificeBoost: 210, squeeze: 1.10, checkBonus: 34, structure: 1.30 },
  fischer:   { tropism: 1.75, safety: 1.75, space: 1.65, bishopBonus: 48, sacrificeBoost: 145, squeeze: 1.30, checkBonus: 24, structure: 1.45 },
  carlsen:   { tropism: 1.45, safety: 2.10, space: 1.55, bishopBonus: 25, sacrificeBoost: 85,  squeeze: 1.90, checkBonus: 18, structure: 1.80 },
  solid:     { tropism: 0.75, safety: 2.50, space: 1.25, bishopBonus: 18, sacrificeBoost: 0,   squeeze: 2.70, checkBonus: 12, structure: 1.90 },
  botvinnik: { tropism: 1.25, safety: 2.35, space: 1.60, bishopBonus: 28, sacrificeBoost: 60,  squeeze: 2.20, checkBonus: 15, structure: 2.15 },
  balanced:  { tropism: 1.55, safety: 1.90, space: 1.45, bishopBonus: 24, sacrificeBoost: 125, squeeze: 1.10, checkBonus: 22, structure: 1.50 }
};

async function fetchLichessCloud3000(fen, pieceCount) {
  if (pieceCount < 22) return null;
  if (cloudCache.has(fen)) return cloudCache.get(fen);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 220);
  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      cloudCache.set(fen, null);
      return null;
    }
    const data = await res.json();
    if (data && Array.isArray(data.pvs) && data.pvs.length > 0) {
      const parsed = data.pvs.map((pv) => {
        const moves = (pv.moves || "").split(" ");
        const firstUci = moves[0] || "";
        return {
          uci: firstUci,
          from: firstUci.slice(0, 2),
          to: firstUci.slice(2, 4),
          cp: pv.cp !== undefined ? pv.cp : (pv.mate ? pv.mate * 3000 : 0),
          pvChain: moves.slice(0, 4).map(u => `${u.slice(0, 2)}→${u.slice(2, 4)}`).join(" ➔ ")
        };
      });
      if (cloudCache.size > 600) cloudCache.clear();
      cloudCache.set(fen, parsed);
      return parsed;
    }
  } catch (e) {
    clearTimeout(timer);
  }
  return null;
}

const OPENING_BOOK = {
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": [
    { from: "e2", to: "e4", name: "Королевский дебют (1. e4)", bonus: 98, aggressive: true },
    { from: "d2", to: "d4", name: "Ферзевый дебют (1. d4)", bonus: 95 },
    { from: "c2", to: "c4", name: "Английское начало (1. c4)", bonus: 88 }
  ],
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": [
    { from: "c7", to: "c5", name: "Сицилианская защита (1... c5)", bonus: 99, aggressive: true },
    { from: "e7", to: "e5", name: "Открытый дебют (1... e5)", bonus: 95 },
    { from: "c7", to: "c6", name: "Защита Каро-Канн (1... c6)", bonus: 90 },
    { from: "e7", to: "e6", name: "Французская защита (1... e6)", bonus: 89 }
  ],
  "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b": [
    { from: "g8", to: "f6", name: "Индийская защита (1... Nf6)", bonus: 97, aggressive: true },
    { from: "d7", to: "d5", name: "Классический ферзевый ответ (1... d5)", bonus: 94 },
    { from: "e7", to: "e5", name: "Гамбит Энглунда (1... e5?!)", bonus: 92, aggressive: true }
  ],
  "rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b": [
    { from: "d5", to: "e4", name: "Каро-Канн: Размен на e4 (3... dxe4)", bonus: 96 }
  ],
  "rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR b": [
    { from: "g8", to: "f6", name: "Каро-Канн: Вариант Тартаковера (4... Nf6)", bonus: 95 },
    { from: "c8", to: "f5", name: "Каро-Канн: Классический вывод слона (4... Bf5)", bonus: 96 }
  ],
  "rnbqkb1r/pp2pppp/2p2n2/8/3PN3/8/PPP2PPP/R1BQKBNR w": [
    { from: "e4", to: "g5", name: "👽 Заход на Инопланетный гамбит (5. Ng5!)", bonus: 115, aggressive: true },
    { from: "e4", to: "f6", name: "Классический размен на f6 (5. Nxf6+)", bonus: 92 }
  ],
  "rnbqkb1r/pp2ppp1/2p2n1p/6N1/3P4/8/PPP2PPP/R1BQKBNR w": [
    { from: "g5", to: "f7", name: "👽 ИНОПЛАНЕТНЫЙ ГАМБИТ (6. Nxf7!!)", bonus: 260, aggressive: true }
  ],
  "rnbq1b1r/pp2ppk1/2p2n1p/8/3P4/8/PPP2PPP/R1BQKBNR w": [
    { from: "f1", to: "c4", name: "👽 Инопланетный гамбит (7. Bc4+)", bonus: 160, aggressive: true },
    { from: "g1", to: "f3", name: "👽 Инопланетный гамбит (7. Nf3)", bonus: 155, aggressive: true }
  ],
  "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w": [
    { from: "g1", to: "f3", name: "🚀 Гамбит Теннисона / ICBM (2. Nf3!)", bonus: 102, aggressive: true },
    { from: "e4", to: "d5", name: "Скандинавская защита (2. exd5)", bonus: 96 }
  ],
  "rnbqkbnr/ppp1pppp/8/8/4p3/5N2/PPPP1PPP/RNBQKB1R w": [
    { from: "f3", to: "g5", name: "🚀 Гамбит Теннисона (3. Ng5!)", bonus: 115, aggressive: true }
  ],
  "rnbqkb1r/ppp1pppp/5n2/6N1/4p3/8/PPPP1PPP/RNBQKB1R w": [
    { from: "d2", to: "d3", name: "🚀 ICBM Ракета (4. d3!)", bonus: 120, aggressive: true }
  ],
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w": [
    { from: "f3", to: "e5", name: "🎃 Гамбит Хэллоуин (4. Nxe5?!)", bonus: 112, aggressive: true },
    { from: "f1", to: "b5", name: "Дебют четырех коней (4. Bb5)", bonus: 96 }
  ],
  "r1bqkb1r/pppp1ppp/2n5/4p3/2Bpn3/5N2/PPP2PPP/RNBQ1RK1 w": [
    { from: "b1", to: "c3", name: "💥 Гамбит Нахмансона (6. Nc3!!)", bonus: 195, aggressive: true },
    { from: "f1", to: "e1", name: "Атака Макса Ланге (6. Re1)", bonus: 96 }
  ],
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": [
    { from: "g1", to: "f3", name: "Атака пешки e5 (2. Nf3)", bonus: 97 },
    { from: "f2", to: "f4", name: "Королевский гамбит (2. f4!)", bonus: 96, aggressive: true },
    { from: "d2", to: "d4", name: "Северный гамбит (2. d4!)", bonus: 93, aggressive: true }
  ],
  "rnbqkbnr/pppp1ppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR w": [
    { from: "c2", to: "c3", name: "Северный гамбит (3. c3!)", bonus: 99, aggressive: true }
  ],
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": [
    { from: "b8", to: "c6", name: "Классическая защита (2... Nc6)", bonus: 97 },
    { from: "g8", to: "f6", name: "Русская партия (2... Nf6)", bonus: 94 }
  ],
  "rnbqkb1r/pppp1ppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b": [
    { from: "b8", to: "c6", name: "⚡ Гамбит Стаффорда (3... Nc6?!)", bonus: 118, aggressive: true },
    { from: "d7", to: "d6", name: "Классическая Русская партия (3... d6)", bonus: 96 }
  ],
  "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w": [
    { from: "d2", to: "d4", name: "🔥 Гамбит Урусова (3. d4!) — взрывной штурм центра!", bonus: 112, aggressive: true },
    { from: "d2", to: "d3", name: "Спокойный дебют слона (3. d3)", bonus: 92 }
  ],
  "rnbqkb1r/ppp2ppp/3p1n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w": [
    { from: "e5", to: "f7", name: "💣 Гамбит Кохрена (4. Nxf7?!) — жертва коня ради атаки на короля!", bonus: 118, aggressive: true },
    { from: "e5", to: "f3", name: "Классический отход коня (4. Nf3)", bonus: 96 }
  ],
  "rnbqkbnr/pppp2pp/8/4pp2/4P3/5N2/PPPP1PPP/RNBQKB1R w": [
    { from: "f3", to: "e5", name: "⚡ Опровержение Латышского гамбита (3. Nxe5!)", bonus: 145, aggressive: true }
  ],
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": [
    { from: "f1", to: "c4", name: "Итальянская партия (3. Bc4)", bonus: 97, aggressive: true },
    { from: "f1", to: "b5", name: "Испанская партия (3. Bb5)", bonus: 96 },
    { from: "d2", to: "d4", name: "Шотландская партия (3. d4!)", bonus: 94, aggressive: true }
  ],
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w": [
    { from: "b2", to: "b4", name: "🔥 Гамбит Эванса (4. b4!)", bonus: 99, aggressive: true },
    { from: "c2", to: "c3", name: "Итальянский центр (4. c3)", bonus: 94 }
  ],
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w": [
    { from: "f3", to: "g5", name: "⚔ Атака Фегателло / Fried Liver (4. Ng5!)", bonus: 108, aggressive: true },
    { from: "d2", to: "d4", name: "Шотландский гамбит (4. d4!)", bonus: 95, aggressive: true }
  ],
  "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b": [
    { from: "d7", to: "d5", name: "Точный перехват инициативы (4... d5!)", bonus: 175 },
    { from: "f8", to: "c5", name: "🔥 Контратака Тракслера (4... Bc5?!)", bonus: 115, aggressive: true }
  ]
};

const PST = {
  p: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [80, 80, 80, 80, 80, 80, 80, 80],
    [25, 25, 32, 42, 42, 32, 25, 25],
    [10, 10, 18, 34, 34, 18, 10, 10],
    [0,  0,  6, 36, 36,  6,  0,  0],
    [5, -5, -5, 10, 10, -5, -5,  5],
    [5, 10, 10,-25,-25, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-30,  6, 22, 28, 28, 22,  6,-30],
    [-30, 10, 26, 32, 32, 26, 10,-30],
    [-30,  6, 24, 28, 28, 24,  6,-30],
    [-30,  6, 18, 22, 22, 18,  6,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  2,  0,  0,  0,  0,  2,-10],
    [-10,  6, 16, 22, 22, 16,  6,-10],
    [-10, 14, 16, 22, 22, 16, 14,-10],
    [-10,  6, 24, 18, 18, 24,  6,-10],
    [-10, 16, 14, 16, 16, 14, 16,-10],
    [-10, 12,  0,  0,  0,  0, 12,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  r: [
    [  0,  0,  4,  8,  8,  4,  0,  0],
    [ 22, 28, 28, 28, 28, 28, 28, 22],
    [ -5,  0,  0,  2,  2,  0,  0, -5],
    [ -5,  0,  0,  2,  2,  0,  0, -5],
    [ -5,  0,  0,  2,  2,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  8, 16, 16,  8,  0,  0]
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [-10,  5, 10, 14, 14, 10,  5,-10],
    [ -5,  0, 10, 14, 14, 10,  0, -5],
    [  0,  0,  6, 10, 10,  6,  0, -5],
    [-10,  6,  6,  6,  6,  6,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ],
  k: [
    [-40,-50,-50,-60,-60,-50,-50,-40],
    [-40,-50,-50,-60,-60,-50,-50,-40],
    [-40,-50,-50,-60,-60,-50,-50,-40],
    [-40,-50,-50,-60,-60,-50,-50,-40],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [ 10, 15, -5,-15,-15, -5, 15, 10],
    [ 20, 35, 15, -5,  5, 10, 35, 20]
  ]
};

const ENDGAME_KING_PST = [
  [-25,-15, -5,  0,  0, -5,-15,-25],
  [-15,  5, 18, 25, 25, 18,  5,-15],
  [ -5, 18, 35, 45, 45, 35, 18, -5],
  [  0, 25, 45, 58, 58, 45, 25,  0],
  [  0, 25, 45, 58, 58, 45, 25,  0],
  [ -5, 18, 35, 45, 45, 35, 18, -5],
  [-15,  5, 18, 25, 25, 18,  5,-15],
  [-25,-15, -5,  0,  0, -5,-15,-25]
];

function parseFEN(fen) {
  const parts = (fen || "").trim().split(/\s+/);
  const rows = (parts[0] || "8/8/8/8/8/8/8/8").split("/");
  const turn = parts[1] || "w";
  const castling = parts[2] || "-";
  const epSquare = (parts[3] && parts[3] !== "-") ? parts[3] : null;

  const board = [];
  let pieceCount = 0;
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (const ch of (rows[r] || "8")) {
      if (!isNaN(ch)) {
        for (let i = 0; i < parseInt(ch, 10); i++) row.push(null);
      } else {
        row.push(ch);
        pieceCount++;
      }
    }
    board.push(row);
  }
  return {
    board,
    turn,
    castling,
    epSquare,
    pieceCount,
    boardKey: `${parts[0]} ${turn}`
  };
}

function boardToHash(board, turn, castling = "-", epSquare = null) {
  let s = `${turn}_${castling}_${epSquare || "-"}_`;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      s += board[r][c] || ".";
    }
  }
  return s;
}

function isColor(p, color) {
  if (!p) return false;
  return color === "w" ? p === p.toUpperCase() : p === p.toLowerCase();
}

function isSquareAttacked(board, r, c, byColor) {
  const isW = byColor === "w";
  const P = isW ? "P" : "p";
  const N = isW ? "N" : "n";
  const B = isW ? "B" : "b";
  const R = isW ? "R" : "r";
  const Q = isW ? "Q" : "q";
  const K = isW ? "K" : "k";

  const pawnRow = isW ? r + 1 : r - 1;
  if (pawnRow >= 0 && pawnRow <= 7) {
    if (c > 0 && board[pawnRow][c - 1] === P) return true;
    if (c < 7 && board[pawnRow][c + 1] === P) return true;
  }

  const knightSteps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (let i = 0; i < 8; i++) {
    const nr = r + knightSteps[i][0], nc = c + knightSteps[i][1];
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7 && board[nr][nc] === N) return true;
  }

  const kingSteps = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (let i = 0; i < 8; i++) {
    const nr = r + kingSteps[i][0], nc = c + kingSteps[i][1];
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7 && board[nr][nc] === K) return true;
  }

  const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (let i = 0; i < 4; i++) {
    let nr = r + diagDirs[i][0], nc = c + diagDirs[i][1];
    while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const p = board[nr][nc];
      if (p) {
        if (p === B || p === Q) return true;
        break;
      }
      nr += diagDirs[i][0];
      nc += diagDirs[i][1];
    }
  }

  const orthoDirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (let i = 0; i < 4; i++) {
    let nr = r + orthoDirs[i][0], nc = c + orthoDirs[i][1];
    while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const p = board[nr][nc];
      if (p) {
        if (p === R || p === Q) return true;
        break;
      }
      nr += orthoDirs[i][0];
      nc += orthoDirs[i][1];
    }
  }
  return false;
}

function findKing(board, kingColor) {
  const kChar = kingColor === "w" ? "K" : "k";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === kChar) return { r, c };
    }
  }
  return { r: kingColor === "w" ? 7 : 0, c: 4 };
}

function isKingInCheck(board, kingColor) {
  const enemy = kingColor === "w" ? "b" : "w";
  const k = findKing(board, kingColor);
  return isSquareAttacked(board, k.r, k.c, enemy);
}

function countNonPawnMaterial(board) {
  let mat = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const t = p.toLowerCase();
      if (t !== "p" && t !== "k") mat += PIECE_VALUES[t] || 0;
    }
  }
  return mat;
}

function evaluateKingAttackAndShield(board, attackerColor) {
  const defenderColor = attackerColor === "w" ? "b" : "w";
  const enemyKing = findKing(board, defenderColor);
  let attackScore = 0;

  const shieldRow = defenderColor === "w" ? enemyKing.r - 1 : enemyKing.r + 1;
  const enemyPawnChar = defenderColor === "w" ? "P" : "p";
  if (shieldRow >= 0 && shieldRow <= 7) {
    for (let dc = -1; dc <= 1; dc++) {
      const sc = enemyKing.c + dc;
      if (sc >= 0 && sc <= 7 && board[shieldRow][sc] !== enemyPawnChar) {
        attackScore += 32;
      }
    }
  }

  let attackedKingZoneSquares = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const kr = enemyKing.r + dr, kc = enemyKing.c + dc;
      if (kr >= 0 && kr <= 7 && kc >= 0 && kc <= 7) {
        if (isSquareAttacked(board, kr, kc, attackerColor)) {
          attackedKingZoneSquares++;
        }
      }
    }
  }
  attackScore += attackedKingZoneSquares * 26;
  return attackScore;
}

function evaluatePawnStructureAndEndgame(board, isEndgame, wKing, bKing) {
  const wPawnsPerCol = [0, 0, 0, 0, 0, 0, 0, 0];
  const bPawnsPerCol = [0, 0, 0, 0, 0, 0, 0, 0];
  const wRooks = [];
  const bRooks = [];
  const wPawns = [];
  const bPawns = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p === "P") {
        wPawnsPerCol[c]++;
        wPawns.push({ r, c });
      } else if (p === "p") {
        bPawnsPerCol[c]++;
        bPawns.push({ r, c });
      } else if (p === "R") wRooks.push({ r, c });
      else if (p === "r") bRooks.push({ r, c });
    }
  }

  let structScore = 0;

  for (let c = 0; c < 8; c++) {
    if (wPawnsPerCol[c] > 1) structScore -= (wPawnsPerCol[c] - 1) * 18;
    if (bPawnsPerCol[c] > 1) structScore += (bPawnsPerCol[c] - 1) * 18;

    const wHasNeighbor = (c > 0 && wPawnsPerCol[c - 1] > 0) || (c < 7 && wPawnsPerCol[c + 1] > 0);
    if (wPawnsPerCol[c] > 0 && !wHasNeighbor) structScore -= 15;

    const bHasNeighbor = (c > 0 && bPawnsPerCol[c - 1] > 0) || (c < 7 && bPawnsPerCol[c + 1] > 0);
    if (bPawnsPerCol[c] > 0 && !bHasNeighbor) structScore += 15;
  }

  const passedBonusByRank = isEndgame
    ? [0, 145, 95, 60, 35, 18, 8, 0]
    : [0, 78, 50, 32, 18, 10, 5, 0];

  for (const wp of wPawns) {
    const defendedByPawn =
      wp.r < 7 &&
      ((wp.c > 0 && board[wp.r + 1][wp.c - 1] === "P") ||
        (wp.c < 7 && board[wp.r + 1][wp.c + 1] === "P"));
    if (defendedByPawn) structScore += 12;

    let passed = true;
    for (let rr = 0; rr < wp.r && passed; rr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cc = wp.c + dc;
        if (cc >= 0 && cc <= 7 && board[rr][cc] === "p") passed = false;
      }
    }
    if (passed) {
      structScore += passedBonusByRank[wp.r];
      if (isEndgame) {
        const ownKingDist = Math.max(Math.abs(wKing.r - wp.r), Math.abs(wKing.c - wp.c));
        const enemyKingDist = Math.max(Math.abs(bKing.r - wp.r), Math.abs(bKing.c - wp.c));
        structScore += (7 - ownKingDist) * 10;
        structScore += enemyKingDist * 12;
        if (enemyKingDist > wp.r + 1) structScore += 180;
      }
    } else if (isEndgame) {
      const ownKingDist = Math.max(Math.abs(wKing.r - wp.r), Math.abs(wKing.c - wp.c));
      structScore += (7 - ownKingDist) * 5;
    }

    if (isEndgame) {
      const attackedByEnemyKing = Math.abs(bKing.r - wp.r) <= 1 && Math.abs(bKing.c - wp.c) <= 1;
      const defendedByOwnKing = Math.abs(wKing.r - wp.r) <= 1 && Math.abs(wKing.c - wp.c) <= 1;
      if (attackedByEnemyKing && !defendedByPawn && !defendedByOwnKing) {
        structScore -= 55;
      }
    }
  }

  for (const bp of bPawns) {
    const defendedByPawn =
      bp.r > 0 &&
      ((bp.c > 0 && board[bp.r - 1][bp.c - 1] === "p") ||
        (bp.c < 7 && board[bp.r - 1][bp.c + 1] === "p"));
    if (defendedByPawn) structScore -= 12;

    let passed = true;
    for (let rr = bp.r + 1; rr <= 7 && passed; rr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const cc = bp.c + dc;
        if (cc >= 0 && cc <= 7 && board[rr][cc] === "P") passed = false;
      }
    }
    if (passed) {
      structScore -= passedBonusByRank[7 - bp.r];
      if (isEndgame) {
        const ownKingDist = Math.max(Math.abs(bKing.r - bp.r), Math.abs(bKing.c - bp.c));
        const enemyKingDist = Math.max(Math.abs(wKing.r - bp.r), Math.abs(wKing.c - bp.c));
        structScore -= (7 - ownKingDist) * 10;
        structScore -= enemyKingDist * 12;
        if (enemyKingDist > (7 - bp.r) + 1) structScore -= 180;
      }
    } else if (isEndgame) {
      const ownKingDist = Math.max(Math.abs(bKing.r - bp.r), Math.abs(bKing.c - bp.c));
      structScore -= (7 - ownKingDist) * 5;
    }

    if (isEndgame) {
      const attackedByEnemyKing = Math.abs(wKing.r - bp.r) <= 1 && Math.abs(wKing.c - bp.c) <= 1;
      const defendedByOwnKing = Math.abs(bKing.r - bp.r) <= 1 && Math.abs(bKing.c - bp.c) <= 1;
      if (attackedByEnemyKing && !defendedByPawn && !defendedByOwnKing) {
        structScore += 55;
      }
    }
  }

  for (const wr of wRooks) {
    if (wPawnsPerCol[wr.c] === 0) {
      structScore += bPawnsPerCol[wr.c] === 0 ? 22 : 12;
    }
  }
  for (const br of bRooks) {
    if (bPawnsPerCol[br.c] === 0) {
      structScore -= wPawnsPerCol[br.c] === 0 ? 22 : 12;
    }
  }

  return structScore;
}

function evaluateBoard(board, side, style = "tal") {
  let score = 0;
  const wKing = findKing(board, "w");
  const bKing = findKing(board, "b");
  const profile = GM_STYLES[style] || GM_STYLES.balanced;

  let wBishops = 0, bBishops = 0;
  const nonPawnMaterial = countNonPawnMaterial(board);
  const isEndgame = nonPawnMaterial <= 2600;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const isW = p === p.toUpperCase();
      const type = p.toLowerCase();
      if (type === "b") {
        if (isW) wBishops++; else bBishops++;
      }

      const val = PIECE_VALUES[type] || 0;
      const pstR = isW ? r : 7 - r;

      let pstVal = 0;
      if (type === "k" && isEndgame) {
        pstVal = ENDGAME_KING_PST[pstR][c];
      } else {
        pstVal = (PST[type] && PST[type][pstR]) ? PST[type][pstR][c] : 0;
      }
      const pst = Math.round(pstVal * profile.space);

      let kingAttackBonus = 0;
      if (!isEndgame && (type === "q" || type === "n" || type === "b" || type === "r")) {
        const targetK = isW ? bKing : wKing;
        const dist = Math.abs(r - targetK.r) + Math.abs(c - targetK.c);
        kingAttackBonus = Math.round(Math.max(0, (8 - dist) * (type === "q" ? 7 : 4)) * profile.tropism);
      }

      if (isW) score += val + pst + kingAttackBonus;
      else score -= (val + pst + kingAttackBonus);
    }
  }

  if (wBishops >= 2) score += profile.bishopBonus;
  if (bBishops >= 2) score -= profile.bishopBonus;

  score += Math.round(evaluatePawnStructureAndEndgame(board, isEndgame, wKing, bKing) * (profile.structure || 1.3));

  if (!isEndgame && profile.tropism >= 2.2) {
    const wAttack = evaluateKingAttackAndShield(board, "w");
    const bAttack = evaluateKingAttackAndShield(board, "b");
    score += (wAttack - bAttack);
  }

  return side === "w" ? score : -score;
}

function generateMoves(board, turn, castling = "KQkq", epSquare = null) {
  const moves = [];
  const enemy = turn === "w" ? "b" : "w";
  const rookChar = turn === "w" ? "R" : "r";

  let epR = -1, epC = -1;
  if (epSquare && epSquare.length === 2) {
    epC = FILES.indexOf(epSquare[0]);
    epR = 8 - parseInt(epSquare[1], 10);
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!isColor(p, turn)) continue;
      const type = p.toLowerCase();

      const push = (tr, tc, extra = {}) => {
        if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
        const target = board[tr][tc];
        if (isColor(target, turn)) return false;

        if (type === "p" && (tr === 0 || tr === 7)) {
          moves.push({
            fromR: r, fromC: c, toR: tr, toC: tc,
            piece: type,
            captured: target ? target.toLowerCase() : null,
            promo: "q"
          });
          moves.push({
            fromR: r, fromC: c, toR: tr, toC: tc,
            piece: type,
            captured: target ? target.toLowerCase() : null,
            promo: "n"
          });
          return !target;
        }

        moves.push({
          fromR: r, fromC: c, toR: tr, toC: tc,
          piece: type,
          captured: extra.isEnPassant ? "p" : (target ? target.toLowerCase() : null),
          isEnPassant: Boolean(extra.isEnPassant),
          promo: null
        });
        return !target;
      };

      if (type === "p") {
        const dir = turn === "w" ? -1 : 1;
        const startRow = turn === "w" ? 6 : 1;
        if (r + dir >= 0 && r + dir <= 7 && !board[r + dir][c]) {
          push(r + dir, c);
          if (r === startRow && !board[r + dir * 2][c]) push(r + dir * 2, c);
        }
        for (const dc of [-1, 1]) {
          const nr = r + dir, nc = c + dc;
          if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
            if (isColor(board[nr][nc], enemy)) {
              push(nr, nc);
            } else if (nr === epR && nc === epC && !board[nr][nc]) {
              push(nr, nc, { isEnPassant: true });
            }
          }
        }
      } else if (type === "n") {
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) push(r + dr, c + dc);
      } else if (type === "k") {
        for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) push(r + dr, c + dc);

        const homeRow = turn === "w" ? 7 : 0;
        const canShort = turn === "w" ? castling.includes("K") : castling.includes("k");
        const canLong = turn === "w" ? castling.includes("Q") : castling.includes("q");

        if (r === homeRow && c === 4 && (canShort || canLong) && !isSquareAttacked(board, homeRow, 4, enemy)) {
          if (
            canShort &&
            board[homeRow][7] === rookChar &&
            !board[homeRow][5] &&
            !board[homeRow][6] &&
            !isSquareAttacked(board, homeRow, 5, enemy) &&
            !isSquareAttacked(board, homeRow, 6, enemy)
          ) {
            push(homeRow, 6);
          }
          if (
            canLong &&
            board[homeRow][0] === rookChar &&
            !board[homeRow][3] &&
            !board[homeRow][2] &&
            !board[homeRow][1] &&
            !isSquareAttacked(board, homeRow, 3, enemy) &&
            !isSquareAttacked(board, homeRow, 2, enemy)
          ) {
            push(homeRow, 2);
          }
        }
      } else {
        const dirs = [];
        if (type === "b" || type === "q") dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
        if (type === "r" || type === "q") dirs.push([-1,0],[1,0],[0,-1],[0,1]);
        for (const [dr, dc] of dirs) {
          let nr = r + dr, nc = c + dc;
          while (push(nr, nc)) { nr += dr; nc += dc; }
        }
      }
    }
  }
  return moves;
}

function makeMove(board, m) {
  const copy = board.map(r => r.slice());
  let p = copy[m.fromR][m.fromC];
  const isWhite = p === p.toUpperCase();

  if (m.piece === "p" && (m.toR === 0 || m.toR === 7)) {
    const promoChar = m.promo === "n" ? "n" : "q";
    p = isWhite ? promoChar.toUpperCase() : promoChar;
  }

  if (m.isEnPassant) {
    copy[m.fromR][m.toC] = null;
  }

  if (m.piece === "k" && Math.abs(m.toC - m.fromC) === 2) {
    if (m.toC === 6) { copy[m.toR][5] = copy[m.toR][7]; copy[m.toR][7] = null; }
    if (m.toC === 2) { copy[m.toR][3] = copy[m.toR][0]; copy[m.toR][0] = null; }
  }

  copy[m.toR][m.toC] = p;
  copy[m.fromR][m.fromC] = null;
  return copy;
}

function updateCastlingAfterMove(castling, m) {
  if (!castling || castling === "-") return "-";
  let res = castling;
  if (m.piece === "k") {
    res = m.fromR === 7 ? res.replace("K", "").replace("Q", "") : res.replace("k", "").replace("q", "");
  }
  if (m.fromR === 7 && m.fromC === 0) res = res.replace("Q", "");
  if (m.fromR === 7 && m.fromC === 7) res = res.replace("K", "");
  if (m.fromR === 0 && m.fromC === 0) res = res.replace("q", "");
  if (m.fromR === 0 && m.fromC === 7) res = res.replace("k", "");
  if (m.toR === 7 && m.toC === 0) res = res.replace("Q", "");
  if (m.toR === 7 && m.toC === 7) res = res.replace("K", "");
  if (m.toR === 0 && m.toC === 0) res = res.replace("q", "");
  if (m.toR === 0 && m.toC === 7) res = res.replace("k", "");
  return res || "-";
}

function getNextEpSquare(m) {
  if (m.piece === "p" && Math.abs(m.toR - m.fromR) === 2) {
    const midRow = (m.fromR + m.toR) / 2;
    return `${FILES[m.fromC]}${8 - midRow}`;
  }
  return null;
}

function generateLegalMoves(board, turn, castling = "KQkq", epSquare = null) {
  const legal = generateMoves(board, turn, castling, epSquare).filter(
    m => !isKingInCheck(makeMove(board, m), turn)
  );
  legal.sort((a, b) => {
    const promoA = a.promo ? (a.promo === "q" ? 900 : 350) : 0;
    const promoB = b.promo ? (b.promo === "q" ? 900 : 350) : 0;
    const capA = a.captured ? PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece] : 0;
    const capB = b.captured ? PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece] : 0;
    const centerA = (a.toR >= 2 && a.toR <= 5 && a.toC >= 2 && a.toC <= 5) ? 15 : 0;
    const centerB = (b.toR >= 2 && b.toR <= 5 && b.toC >= 2 && b.toC <= 5) ? 15 : 0;
    return (promoB + capB + centerB) - (promoA + capA + centerA);
  });
  return legal;
}

function moveToText(m) {
  if (!m) return "";
  const pr = m.promo ? `=${m.promo.toUpperCase()}` : "";
  return `${FILES[m.fromC]}${8 - m.fromR}→${FILES[m.toC]}${8 - m.toR}${pr}`;
}

function quiescence(board, turn, alpha, beta, style, qd = 0) {
  const pat = evaluateBoard(board, turn, style);
  if (qd >= 4) return pat;
  if (pat >= beta) return beta;
  if (alpha < pat) alpha = pat;
  const enemy = turn === "w" ? "b" : "w";
  const caps = generateLegalMoves(board, turn, "-", null).filter(m => m.captured || m.promo);
  for (const m of caps) {
    const s = -quiescence(makeMove(board, m), enemy, -beta, -alpha, style, qd + 1);
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }
  return alpha;
}

function searchPV(board, turn, depth, alpha, beta, style, castling = "-", epSquare = null, extUsed = 0) {
  if (depth <= 0) {
    return { score: quiescence(board, turn, alpha, beta, style, 0), pv: [] };
  }

  const ttKey = `${boardToHash(board, turn, castling, epSquare)}_${depth}_${style}`;
  const cached = transpositionTable.get(ttKey);
  if (cached && cached.alpha <= alpha && cached.beta >= beta) {
    return cached.res;
  }

  const legal = generateLegalMoves(board, turn, castling, epSquare);
  if (legal.length === 0) {
    const mateScore = isKingInCheck(board, turn) ? -19000 - depth * 100 : 0;
    return { score: mateScore, pv: [] };
  }

  const enemy = turn === "w" ? "b" : "w";
  let bestScore = -Infinity;
  let bestPV = [];
  const origAlpha = alpha;

  for (const m of legal) {
    const nextB = makeMove(board, m);
    const nextCastling = updateCastlingAfterMove(castling, m);
    const nextEp = getNextEpSquare(m);
    const givesChk = extUsed < 1 && isKingInCheck(nextB, enemy);
    const nextDepth = givesChk ? depth : depth - 1;
    const child = searchPV(
      nextB,
      enemy,
      nextDepth,
      -beta,
      -alpha,
      style,
      nextCastling,
      nextEp,
      givesChk ? extUsed + 1 : extUsed
    );
    const score = -child.score;

    if (score > bestScore) {
      bestScore = score;
      bestPV = [moveToText(m), ...child.pv];
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  const res = { score: bestScore, pv: bestPV };
  if (transpositionTable.size > 28000) transpositionTable.clear();
  transpositionTable.set(ttKey, { alpha: origAlpha, beta, res });
  return res;
}

function getHangingDetails(board, ourSide) {
  const enemy = ourSide === "w" ? "b" : "w";
  const enemyCaptures = generateLegalMoves(board, enemy, "-", null).filter(m => m.captured);
  let worstLoss = 0;
  let hangingSquare = null;

  for (const cap of enemyCaptures) {
    const victimVal = PIECE_VALUES[cap.captured] || 0;
    const attackerVal = PIECE_VALUES[cap.piece] || 0;
    const afterCapBoard = makeMove(board, cap);
    const ourRecaptures = generateLegalMoves(afterCapBoard, ourSide, "-", null).filter(
      r => r.toR === cap.toR && r.toC === cap.toC
    );
    const netLoss = ourRecaptures.length > 0 ? Math.max(0, victimVal - attackerVal) : victimVal;
    if (netLoss > worstLoss) {
      worstLoss = netLoss;
      hangingSquare = `${FILES[cap.toC]}${8 - cap.toR}`;
    }
  }
  return { worstLoss, hangingSquare };
}

function detectForkMotif(boardAfter, movedR, movedC, ourSide) {
  const enemy = ourSide === "w" ? "b" : "w";
  const ourPiece = boardAfter[movedR][movedC];
  if (!ourPiece) return false;
  const ourVal = PIECE_VALUES[ourPiece.toLowerCase()] || 100;

  const nextAttacks = generateMoves(boardAfter, ourSide, "-", null).filter(
    m => m.fromR === movedR && m.fromC === movedC && m.captured
  );

  let valuableTargets = 0;
  for (const att of nextAttacks) {
    const targetVal = PIECE_VALUES[att.captured] || 0;
    const targetProtected = isSquareAttacked(boardAfter, att.toR, att.toC, enemy);
    if (targetVal > ourVal || (targetVal >= 300 && !targetProtected) || att.captured === "k") {
      valuableTargets++;
    }
  }
  return valuableTargets >= 2;
}

function detectPinMotif(boardAfter, movedR, movedC, ourSide) {
  const p = boardAfter[movedR][movedC];
  if (!p) return false;
  const type = p.toLowerCase();
  if (type !== "b" && type !== "r" && type !== "q") return false;

  const dirs = [];
  if (type === "b" || type === "q") dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
  if (type === "r" || type === "q") dirs.push([-1,0],[1,0],[0,-1],[0,1]);

  for (const [dr, dc] of dirs) {
    let nr = movedR + dr, nc = movedC + dc;
    let firstEnemy = null;
    while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const sqP = boardAfter[nr][nc];
      if (sqP) {
        if (isColor(sqP, ourSide)) break;
        if (!firstEnemy) {
          firstEnemy = sqP.toLowerCase();
        } else {
          const secondEnemy = sqP.toLowerCase();
          if (secondEnemy === "k" || (secondEnemy === "q" && firstEnemy !== "p")) {
            return true;
          }
          break;
        }
      }
      nr += dr;
      nc += dc;
    }
  }
  return false;
}

function detectLastOpponentMove(prevBoard, currBoard, opponentColor) {
  if (!prevBoard || !currBoard) return null;
  let diffSquares = 0;
  let fromSq = null;
  let toSq = null;
  let movedPiece = "p";
  let fromRow = -1, toRow = -1, colIndex = -1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const pOld = prevBoard[r][c];
      const pNew = currBoard[r][c];
      if (pOld !== pNew) {
        diffSquares++;
        if (isColor(pOld, opponentColor) && !pNew) {
          if (!fromSq || pOld.toLowerCase() === "k") {
            fromSq = `${FILES[c]}${8 - r}`;
            movedPiece = pOld.toLowerCase();
            fromRow = r;
            colIndex = c;
          }
        }
        if (isColor(pNew, opponentColor) && pOld !== pNew) {
          if (!toSq || pNew.toLowerCase() === "k") {
            toSq = `${FILES[c]}${8 - r}`;
            movedPiece = pNew.toLowerCase();
            toRow = r;
          }
        }
      }
    }
  }

  if (diffSquares > 4 || diffSquares === 0) return null;
  if (fromSq && toSq) {
    const isDoublePawnPush = movedPiece === "p" && Math.abs(toRow - fromRow) === 2;
    const epTarget = isDoublePawnPush ? `${FILES[colIndex]}${8 - (fromRow + toRow) / 2}` : null;
    return { from: fromSq, to: toSq, piece: movedPiece, color: opponentColor, epTarget };
  }
  return null;
}

async function analyzeMasterRework(fen, elo, style = "tal", pass = "fast") {
  const { board, turn, castling, epSquare: fenEp, pieceCount, boardKey } = parseFEN(fen);
  const enemy = turn === "w" ? "b" : "w";

  let detectedOppMove = null;
  if (lastAnalyzedState.board && lastAnalyzedState.turn !== turn) {
    detectedOppMove = detectLastOpponentMove(lastAnalyzedState.board, board, enemy);
  }
  const activeEpSquare = fenEp || (detectedOppMove ? detectedOppMove.epTarget : null);

  const legal = generateLegalMoves(board, turn, castling, activeEpSquare);
  if (legal.length === 0) return { best: null, average: null, worst: null };

  const nonPawnMaterial = countNonPawnMaterial(board);
  const isEndgame = nonPawnMaterial <= 2600;
  const isPawnEndgame = nonPawnMaterial <= 650;

  const enemyKingPos = findKing(board, enemy);
  const enemyKingSquare = `${FILES[enemyKingPos.c]}${8 - enemyKingPos.r}`;

  const profile = GM_STYLES[style] || GM_STYLES.balanced;
  const inCheckBefore = isKingInCheck(board, turn);
  const { worstLoss: threatBefore, hangingSquare } = getHangingDetails(board, turn);
  const bookMoves = OPENING_BOOK[boardKey] || [];
  const learnedForPos = experienceDB[boardKey] || {};

  let cloudLines = null;
  if (pass === "fast") {
    cloudLines = cloudCache.get(fen) || null;
  } else if (elo >= 1800) {
    cloudLines = await fetchLichessCloud3000(fen, pieceCount);
  }

  let searchDepth = pass === "fast" ? 2 : (legal.length <= 26 ? 3 : 2);
  if (pass === "deep" && !cloudLines && legal.length <= 18) {
    searchDepth = 4;
  }
  if (isPawnEndgame && legal.length <= 16) {
    searchDepth = pass === "fast" ? 3 : 4;
  }

  const kingAttackBefore = evaluateKingAttackAndShield(board, turn);
  const enemyMobilityBefore = generateMoves(board, enemy, "-", null).length;

  const scored = legal.map(m => {
    const nextB = makeMove(board, m);
    const nextCastling = updateCastlingAfterMove(castling, m);
    const nextEp = getNextEpSquare(m);

    const gainedNow = m.captured ? (PIECE_VALUES[m.captured] || 0) : 0;
    const { worstLoss: threatAfter } = getHangingDetails(nextB, turn);

    const givesCheck = isKingInCheck(nextB, enemy);
    const isMateInOne = givesCheck && generateLegalMoves(nextB, enemy, nextCastling, nextEp).length === 0;

    let searchScore = 0;
    let pvResult = { pv: [] };

    if (isMateInOne) {
      searchScore = 29900;
    } else {
      pvResult = searchPV(nextB, enemy, searchDepth, -30000, 30000, style, nextCastling, nextEp, 0);
      searchScore = -pvResult.score;
    }

    const fromSq = `${FILES[m.fromC]}${8 - m.fromR}`;
    const toSq = `${FILES[m.toC]}${8 - m.toR}`;
    const promoSuffix = m.promo ? m.promo : "";
    const uci = fromSq + toSq + promoSuffix;

    const bookEntry = bookMoves.find(b => b.from === fromSq && b.to === toSq);
    let bookBonus = bookEntry ? bookEntry.bonus : 0;
    if (bookEntry && profile.tropism >= 2.2 && bookEntry.aggressive) {
      bookBonus += 58;
    }

    const expEntry = learnedForPos[uci];
    const memoryBonus = expEntry ? expEntry.bonus : 0;

    let kingPenalty = 0;
    const isCastling = m.piece === "k" && Math.abs(m.fromC - m.toC) === 2;
    if (m.piece === "k") {
      if (!isEndgame && !inCheckBefore && !isCastling) {
        kingPenalty = -220;
      } else if (isEndgame) {
        const distCenterBefore = Math.abs(3.5 - m.fromR) + Math.abs(3.5 - m.fromC);
        const distCenterAfter = Math.abs(3.5 - m.toR) + Math.abs(3.5 - m.toC);
        if (distCenterAfter < distCenterBefore) {
          kingPenalty = 35;
        }
      }
    }
    const castlingBonus = isCastling ? 78 : 0;

    let kickBonus = 0;
    if (m.piece === "p") {
      const nextMoves = generateMoves(nextB, turn, "-", null).filter(nm => nm.fromR === m.toR && nm.fromC === m.toC && nm.captured);
      if (nextMoves.some(nm => PIECE_VALUES[nm.captured] >= 300)) {
        kickBonus = profile.tropism >= 2.6 ? 78 : 50;
      }
    }

    let mobilitySqueezeBonus = 0;
    if (profile.squeeze >= 1.5) {
      const enemyMobilityAfter = generateMoves(nextB, enemy, "-", null).length;
      mobilitySqueezeBonus = Math.round((enemyMobilityBefore - enemyMobilityAfter) * profile.squeeze * 2);
    }

    const kingAttackAfter = evaluateKingAttackAndShield(nextB, turn);
    const kingAttackJump = kingAttackAfter - kingAttackBefore;

    const isGMIntuitiveSacrifice =
      !isEndgame &&
      profile.sacrificeBoost >= 200 &&
      threatAfter >= 140 &&
      threatAfter <= 450 &&
      (givesCheck || m.captured === "p" || m.captured === "n" || m.captured === "b") &&
      kingAttackJump >= 35 &&
      searchScore > -195;

    const isWinningSacrifice = searchScore > 320 || isGMIntuitiveSacrifice;
    const gmSacrificeBoost = isGMIntuitiveSacrifice ? profile.sacrificeBoost : 0;

    const netTacticalPenalty = (!isWinningSacrifice && threatAfter > gainedNow + 25)
      ? -Math.round((threatAfter - gainedNow) * profile.safety)
      : 0;

    const savedHangingBonus = (threatBefore >= 75 && threatAfter < 50) ? 95 : 0;

    const isFork = detectForkMotif(nextB, m.toR, m.toC, turn);
    const forkBonus = isFork ? 72 : 0;

    const isPin = detectPinMotif(nextB, m.toR, m.toC, turn);
    const pinBonus = isPin ? 58 : 0;

    const checkBonus = givesCheck ? profile.checkBonus : 0;

    let cloudBonus = 0;
    let fromCloud = false;
    let cloudPV = null;
    if (cloudLines && !isMateInOne) {
      const cIdx = cloudLines.findIndex(cl => cl.from === fromSq && cl.to === toSq);
      if (cIdx === 0) {
        cloudBonus = elo >= 2500 ? 250 : 140;
        fromCloud = true;
        cloudPV = cloudLines[0].pvChain;
      } else if (cIdx === 1) {
        cloudBonus = 70;
      }
    }

    const finalScore = isMateInOne
      ? 50000
      : searchScore +
        bookBonus +
        memoryBonus +
        kingPenalty +
        castlingBonus +
        kickBonus +
        mobilitySqueezeBonus +
        gmSacrificeBoost +
        savedHangingBonus +
        forkBonus +
        pinBonus +
        checkBonus +
        cloudBonus +
        netTacticalPenalty;

    const movedPieceAttacked = isSquareAttacked(nextB, m.toR, m.toC, enemy);
    const putUnderAttack = !isWinningSacrifice && movedPieceAttacked && (threatAfter > gainedNow + 25);

    const moveLabel = m.promo ? `${fromSq}→${toSq}=${m.promo.toUpperCase()}` : `${fromSq}→${toSq}`;
    const fullPV = isMateInOne
      ? `${moveLabel}# (МАТ В 1 ХОД!)`
      : (cloudPV || [moveLabel, ...pvResult.pv.slice(0, 3)].join(" ➔ "));

    return {
      uci,
      from: fromSq,
      to: toSq,
      promo: m.promo || null,
      isEnPassant: Boolean(m.isEnPassant),
      piece: m.piece,
      stepDist: Math.abs(m.toR - m.fromR),
      isCastling,
      fromCloud,
      bookName: bookEntry ? bookEntry.name : null,
      memoryBonus,
      memoryGames: expEntry ? expEntry.games : 0,
      pvLine: fullPV,
      captured: m.captured,
      isMateInOne,
      isCheckmate: isMateInOne || searchScore > 15000,
      isSacrifice: (threatAfter >= 140 && isWinningSacrifice) || isGMIntuitiveSacrifice,
      isTalSacrifice: isGMIntuitiveSacrifice,
      isFork,
      isPin,
      savedHangingPiece: threatBefore >= 75 && threatAfter < 50,
      ignoredHangingPiece: !isWinningSacrifice && threatBefore >= 75 && threatAfter >= 75 && gainedNow < threatBefore,
      underDirectAttack: putUnderAttack,
      ruinedCastling: kingPenalty < 0,
      kicksEnemyPiece: kickBonus > 0,
      givesCheck,
      pureSearchScore: searchScore,
      trueScore: finalScore,
      evalPawns: isMateInOne ? "МАТ #1" : (searchScore / 100).toFixed(2),
      whitePerspectiveEval: isMateInOne
        ? (turn === "w" ? 10 : -10)
        : ((turn === "w" ? searchScore : -searchScore) / 100).toFixed(2)
    };
  });

  scored.sort((a, b) => b.trueScore - a.trueScore);

  const topScore = scored[0].trueScore;
  const solidMoves = scored.filter(m =>
    !m.ignoredHangingPiece &&
    !m.underDirectAttack &&
    !m.ruinedCastling &&
    (topScore - m.trueScore <= 145)
  );
  const safePool = solidMoves.length > 0 ? solidMoves : scored;

  let bestMove = safePool[0];
  if (!bestMove.isMateInOne) {
    if (elo <= 700 && safePool.length >= 3) {
      bestMove = safePool[2];
    } else if (elo <= 1250 && safePool.length >= 2) {
      bestMove = safePool[1];
    }
  }

  const avgCandidates = safePool.filter(
    m => m.uci !== bestMove.uci && !(m.from === bestMove.from && m.to === bestMove.to && m.promo === "n")
  );
  const averageMove =
    avgCandidates[0] ||
    scored.find(m => m.uci !== bestMove.uci && !(m.from === bestMove.from && m.to === bestMove.to && m.promo === "n")) ||
    bestMove;
  const worstMove = scored[scored.length - 1];

  const clampedPure = Math.max(-1200, Math.min(1200, scored[0].pureSearchScore));
  const currentPureWhiteScore = turn === "w" ? clampedPure : -clampedPure;

  let opponentEvalDropPawns = 0;
  if (detectedOppMove && lastAnalyzedState.board) {
    const rawDiff = turn === "w"
      ? (currentPureWhiteScore - lastAnalyzedState.pureBestScoreForWhite)
      : (lastAnalyzedState.pureBestScoreForWhite - currentPureWhiteScore);
    opponentEvalDropPawns = Math.max(0, rawDiff / 100).toFixed(2);
  }

  if (pass === "fast" || !lastAnalyzedState.board) {
    lastAnalyzedState = {
      board: board.map(r => r.slice()),
      turn,
      pureBestScoreForWhite: currentPureWhiteScore
    };
  }

  return {
    pass,
    best: bestMove,
    average: averageMove,
    worst: worstMove,
    enemyKingSquare,
    hangingSquare: threatBefore >= 75 ? hangingSquare : null,
    lastOpponentMove: detectedOppMove,
    opponentEvalDropPawns,
    boardKey,
    elo,
    style,
    totalLearnedGames,
    positionsCount: Object.keys(experienceDB).length
  };
}