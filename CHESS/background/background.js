let experienceDB = {};
let totalLearnedGames = 0;
const transpositionTable = new Map();
const cloudCache = new Map();
const killerMoves = Array.from({ length: 16 }, () => [null, null]);

const MY_INSTANCE_ID = "cc_" + Math.random().toString(36).slice(2, 10);
const activeRoomBeacons = new Map();

async function syncRoomBeacon(roomId, myColor, style, elo, autoMove) {
  if (!roomId || roomId.length < 8) return { detected: false };
  const cleanRoom = roomId.slice(0, 8).toLowerCase();
  const topic = `cc_rw10_${cleanRoom}`;
  const url = `https://ntfy.sh/${topic}`;

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
  pureBestScoreForWhite: 0,
  prevTurnScoreForWhite: 0,
  lastDropPawns: 0
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
    analyzeAdaptiveMaster(
      request.fen,
      request.elo || 2000,
      request.style || "tal",
      request.pass || "fast",
      request.lastEnemyMove || null,
      Boolean(request.bulletTurbo)
    )
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (request.type === "GET_INSTANT_PREMOVE") {
    try {
      const { board, castling, epSquare } = parseFEN(request.fen);
      const myColor = request.myColor || "w";
      const enemyColor = myColor === "w" ? "b" : "w";
      const plan = computeSmartNextPremove(
        board,
        myColor,
        enemyColor,
        castling,
        epSquare,
        request.lastOurMove || null,
        request.style || "tal"
      );
      sendResponse(plan || { canPremove: false });
    } catch (err) {
      sendResponse({ canPremove: false });
    }
    return false;
  }

  if (request.type === "RECORD_GAME_RESULT") {
    const { history, result } = request;
    if (Array.isArray(history) && history.length > 0) {
      totalLearnedGames++;
      const startIdx = Math.max(0, history.length - 10);
      for (let idx = startIdx; idx < history.length; idx++) {
        const item = history[idx];
        if (!item.fenKey || !item.uci) continue;
        if (!experienceDB[item.fenKey]) experienceDB[item.fenKey] = {};
        if (!experienceDB[item.fenKey][item.uci]) {
          experienceDB[item.fenKey][item.uci] = { bonus: 0, games: 0 };
        }
        const entry = experienceDB[item.fenKey][item.uci];
        entry.games++;

        if (result === "win") {
          entry.bonus = Math.min(65, entry.bonus + 15);
        } else if (result === "loss") {
          entry.bonus = idx >= history.length - 4
            ? Math.max(-160, entry.bonus - 55)
            : Math.max(-60, entry.bonus - 15);
        }
      }
      saveExperienceDB();
    }
    sendResponse({
      ok: true,
      totalLearnedGames,
      positionsCount: Object.keys(experienceDB).length
    });
    return false;
  }

  if (request.type === "TRAIN_MOVE_MANUAL") {
    const { fenKey, uci, delta } = request;
    if (fenKey && uci) {
      if (!experienceDB[fenKey]) experienceDB[fenKey] = {};
      if (!experienceDB[fenKey][uci]) experienceDB[fenKey][uci] = { bonus: 0, games: 0 };
      experienceDB[fenKey][uci].bonus = Math.max(-250, Math.min(180, experienceDB[fenKey][uci].bonus + delta));
      experienceDB[fenKey][uci].games++;
      saveExperienceDB();
    }
    sendResponse({
      ok: true,
      positionsCount: Object.keys(experienceDB).length
    });
    return false;
  }

  if (request.type === "GET_MEMORY_STATS") {
    sendResponse({
      totalLearnedGames,
      positionsCount: Object.keys(experienceDB).length,
      experienceDB
    });
    return false;
  }

  if (request.type === "CLEAR_MEMORY") {
    experienceDB = {};
    totalLearnedGames = 0;
    transpositionTable.clear();
    cloudCache.clear();
    saveExperienceDB();
    sendResponse({ ok: true });
    return false;
  }
});

const PIECE_VALUES = { p: 100, n: 320, b: 335, r: 500, q: 920, k: 20000 };
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const GM_STYLES = {
  mogging:   { tropism: 2.25, safety: 2.20, space: 1.55, bishopBonus: 26, sacrificeBoost: 85, squeeze: 1.50, checkBonus: 22, structure: 1.35 },
  tal:       { tropism: 2.35, safety: 2.10, space: 1.50, bishopBonus: 24, sacrificeBoost: 85, squeeze: 1.10, checkBonus: 22, structure: 1.30 },
  alphazero: { tropism: 2.05, safety: 2.25, space: 2.00, bishopBonus: 46, sacrificeBoost: 75, squeeze: 2.10, checkBonus: 18, structure: 1.75 },
  morphy:    { tropism: 2.30, safety: 2.10, space: 1.80, bishopBonus: 36, sacrificeBoost: 80, squeeze: 1.20, checkBonus: 22, structure: 1.25 },
  hikaru:    { tropism: 2.10, safety: 2.20, space: 1.70, bishopBonus: 30, sacrificeBoost: 70, squeeze: 1.65, checkBonus: 20, structure: 1.40 },
  kasparov:  { tropism: 2.00, safety: 2.20, space: 1.80, bishopBonus: 30, sacrificeBoost: 75, squeeze: 1.35, checkBonus: 18, structure: 1.45 },
  fischer:   { tropism: 1.75, safety: 2.30, space: 1.65, bishopBonus: 44, sacrificeBoost: 55, squeeze: 1.40, checkBonus: 16, structure: 1.55 },
  carlsen:   { tropism: 1.50, safety: 2.45, space: 1.55, bishopBonus: 28, sacrificeBoost: 40, squeeze: 1.90, checkBonus: 14, structure: 1.85 },
  solid:     { tropism: 1.05, safety: 2.65, space: 1.30, bishopBonus: 22, sacrificeBoost: 0,  squeeze: 2.40, checkBonus: 10, structure: 1.95 },
  botvinnik: { tropism: 1.30, safety: 2.50, space: 1.60, bishopBonus: 28, sacrificeBoost: 30, squeeze: 2.10, checkBonus: 12, structure: 2.15 },
  balanced:  { tropism: 1.60, safety: 2.35, space: 1.50, bishopBonus: 26, sacrificeBoost: 45, squeeze: 1.30, checkBonus: 15, structure: 1.60 }
};

async function fetchLichessCloud3000(fen, pieceCount) {
  if (pieceCount < 16) return null;
  if (cloudCache.has(fen)) return cloudCache.get(fen);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240);
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
          promo: firstUci.length > 4 ? firstUci[4].toLowerCase() : null,
          cp: pv.cp !== undefined ? pv.cp : (pv.mate ? pv.mate * 3000 : 0),
          pvChain: moves.slice(0, 4).map(u => `${u.slice(0, 2)}→${u.slice(2, 4)}`).join(" ➔ ")
        };
      });
      if (cloudCache.size > 2000) cloudCache.clear();
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
    { from: "e2", to: "e4", name: "Королевский дебют (1. e4)", bonus: 45 },
    { from: "d2", to: "d4", name: "Ферзевый дебют (1. d4)", bonus: 45 },
    { from: "c2", to: "c4", name: "Английское начало (1. c4)", bonus: 38 }
  ],
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": [
    { from: "c7", to: "c5", name: "Сицилианская защита (1... c5)", bonus: 48 },
    { from: "e7", to: "e5", name: "Открытый дебют (1... e5)", bonus: 46 },
    { from: "c7", to: "c6", name: "Защита Каро-Канн (1... c6)", bonus: 42 },
    { from: "e7", to: "e6", name: "Французская защита (1... e6)", bonus: 40 }
  ],
  "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b": [
    { from: "g8", to: "f6", name: "Индийская защита (1... Nf6)", bonus: 48 },
    { from: "d7", to: "d5", name: "Классический ферзевый ответ (1... d5)", bonus: 46 }
  ],
  "rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b": [
    { from: "d5", to: "e4", name: "Каро-Канн: Размен на e4 (3... dxe4)", bonus: 45 }
  ],
  "rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR b": [
    { from: "c8", to: "f5", name: "Каро-Канн: Классический вариант (4... Bf5)", bonus: 48 },
    { from: "g8", to: "f6", name: "Каро-Канн: Вариант Тартаковера (4... Nf6)", bonus: 44 }
  ],
  "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w": [
    { from: "e4", to: "d5", name: "Скандинавская защита (2. exd5!)", bonus: 50 }
  ],
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": [
    { from: "g1", to: "f3", name: "Атака пешки e5 (2. Nf3)", bonus: 48 }
  ],
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": [
    { from: "b8", to: "c6", name: "Классическая защита (2... Nc6)", bonus: 48 },
    { from: "g8", to: "f6", name: "Русская партия (2... Nf6)", bonus: 45 }
  ],
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": [
    { from: "f1", to: "c4", name: "Итальянская партия (3. Bc4)", bonus: 48 },
    { from: "f1", to: "b5", name: "Испанская партия (3. Bb5)", bonus: 48 },
    { from: "d2", to: "d4", name: "Шотландская партия (3. d4)", bonus: 45 }
  ],
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w": [
    { from: "c2", to: "c3", name: "Итальянский центр (4. c3)", bonus: 46 },
    { from: "b2", to: "b4", name: "Гамбит Эванса (4. b4)", bonus: 42 }
  ],
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w": [
    { from: "d2", to: "d3", name: "Тихая Итальянка (4. d3)", bonus: 46 },
    { from: "f3", to: "g5", name: "Атака Фегателло / Нападение на f7 (4. Ng5)", bonus: 44 }
  ],
  "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b": [
    { from: "d7", to: "d5", name: "Точный перехват инициативы по теории (4... d5!)", bonus: 95 }
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

function getAttackersOfSquare(board, r, c, byColor) {
  const isW = byColor === "w";
  const P = isW ? "P" : "p";
  const N = isW ? "N" : "n";
  const B = isW ? "B" : "b";
  const R = isW ? "R" : "r";
  const Q = isW ? "Q" : "q";
  const K = isW ? "K" : "k";
  const attackers = [];

  const pawnRow = isW ? r + 1 : r - 1;
  if (pawnRow >= 0 && pawnRow <= 7) {
    if (c > 0 && board[pawnRow][c - 1] === P) attackers.push(100);
    if (c < 7 && board[pawnRow][c + 1] === P) attackers.push(100);
  }

  const knightSteps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (let i = 0; i < 8; i++) {
    const nr = r + knightSteps[i][0], nc = c + knightSteps[i][1];
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7 && board[nr][nc] === N) attackers.push(320);
  }

  const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (let i = 0; i < 4; i++) {
    let nr = r + diagDirs[i][0], nc = c + diagDirs[i][1];
    while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const p = board[nr][nc];
      if (p) {
        if (p === B) attackers.push(335);
        else if (p === Q) attackers.push(920);
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
        if (p === R) attackers.push(500);
        else if (p === Q) attackers.push(920);
        break;
      }
      nr += orthoDirs[i][0];
      nc += orthoDirs[i][1];
    }
  }

  const kingSteps = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (let i = 0; i < 8; i++) {
    const nr = r + kingSteps[i][0], nc = c + kingSteps[i][1];
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7 && board[nr][nc] === K) attackers.push(20000);
  }

  attackers.sort((a, b) => a - b);
  return attackers;
}

function seeExchangeScore(boardAfterMove, toR, toC, movedPieceType, capturedPieceType, moverColor) {
  const enemy = moverColor === "w" ? "b" : "w";
  const gain = capturedPieceType ? (PIECE_VALUES[capturedPieceType] || 100) : 0;
  const pieceOnSquareVal = PIECE_VALUES[movedPieceType] || 100;

  const enemyAttackers = getAttackersOfSquare(boardAfterMove, toR, toC, enemy);
  if (enemyAttackers.length === 0) return gain;

  const ourDefenders = getAttackersOfSquare(boardAfterMove, toR, toC, moverColor);
  if (ourDefenders.length === 0) {
    return gain - pieceOnSquareVal;
  }

  const swapList = [gain];
  let currentValOnSq = pieceOnSquareVal;
  let eIdx = 0;
  let oIdx = 0;
  let side = "enemy";

  while (true) {
    if (side === "enemy") {
      if (eIdx >= enemyAttackers.length) break;
      swapList.push(currentValOnSq - swapList[swapList.length - 1]);
      currentValOnSq = enemyAttackers[eIdx++];
      side = "our";
    } else {
      if (oIdx >= ourDefenders.length) break;
      swapList.push(currentValOnSq - swapList[swapList.length - 1]);
      currentValOnSq = ourDefenders[oIdx++];
      side = "enemy";
    }
  }

  for (let i = swapList.length - 1; i > 0; i--) {
    swapList[i - 1] = -Math.max(-swapList[i - 1], swapList[i]);
  }
  return swapList[0];
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
        attackScore += 24;
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
  attackScore += attackedKingZoneSquares * 20;
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
        const enemyKingDistToPawn = Math.max(Math.abs(bKing.r - wp.r), Math.abs(bKing.c - wp.c));
        const enemyKingDistToPromote = Math.max(bKing.r, Math.abs(bKing.c - wp.c));
        const stepsToPromote = wp.r === 6 ? 5 : wp.r;
        structScore += (7 - ownKingDist) * 10;
        structScore += enemyKingDistToPawn * 12;
        if (enemyKingDistToPromote > stepsToPromote + 1) structScore += 180;
      }
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
        const enemyKingDistToPawn = Math.max(Math.abs(wKing.r - bp.r), Math.abs(wKing.c - bp.c));
        const enemyKingDistToPromote = Math.max(7 - wKing.r, Math.abs(wKing.c - bp.c));
        const stepsToPromote = bp.r === 1 ? 5 : (7 - bp.r);
        structScore -= (7 - ownKingDist) * 10;
        structScore -= enemyKingDistToPawn * 12;
        if (enemyKingDistToPromote > stepsToPromote + 1) structScore -= 180;
      }
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
  const egPhase = Math.max(0, Math.min(1, (3800 - nonPawnMaterial) / 2600));

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
      if (type === "k") {
        const mgK = PST.k[pstR][c];
        const egK = ENDGAME_KING_PST[pstR][c];
        pstVal = Math.round(mgK * (1 - egPhase) + egK * egPhase);
      } else {
        pstVal = (PST[type] && PST[type][pstR]) ? PST[type][pstR][c] : 0;
      }
      const pst = Math.round(pstVal * Math.min(1.6, profile.space));

      let kingAttackBonus = 0;
      if (!isEndgame && (type === "q" || type === "n" || type === "b" || type === "r")) {
        const targetK = isW ? bKing : wKing;
        const dist = Math.abs(r - targetK.r) + Math.abs(c - targetK.c);
        kingAttackBonus = Math.round(Math.max(0, (8 - dist) * (type === "q" ? 5 : 3)) * Math.min(2.0, profile.tropism));
      }

      if (isW) score += val + pst + kingAttackBonus;
      else score -= (val + pst + kingAttackBonus);
    }
  }

  if (wBishops >= 2) score += profile.bishopBonus;
  if (bBishops >= 2) score -= profile.bishopBonus;

  score += Math.round(evaluatePawnStructureAndEndgame(board, isEndgame, wKing, bKing) * (profile.structure || 1.3));

  if (!isEndgame) {
    const wAttack = evaluateKingAttackAndShield(board, "w");
    const bAttack = evaluateKingAttackAndShield(board, "b");
    score += Math.round((wAttack - bAttack) * 0.85);
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

function moveKeyShort(m) {
  return `${m.fromR}${m.fromC}${m.toR}${m.toC}${m.promo || ""}`;
}

function generateLegalMoves(board, turn, castling = "KQkq", epSquare = null, ttMoveKey = null, ply = 0) {
  const legal = generateMoves(board, turn, castling, epSquare).filter(
    m => !isKingInCheck(makeMove(board, m), turn)
  );
  const killers = killerMoves[Math.min(15, ply)] || [null, null];

  legal.sort((a, b) => {
    const keyA = moveKeyShort(a);
    const keyB = moveKeyShort(b);
    if (ttMoveKey) {
      if (keyA === ttMoveKey) return -100000;
      if (keyB === ttMoveKey) return 100000;
    }
    const promoA = a.promo ? (a.promo === "q" ? 950 : 400) : 0;
    const promoB = b.promo ? (b.promo === "q" ? 950 : 400) : 0;
    const capA = a.captured ? PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece] : 0;
    const capB = b.captured ? PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece] : 0;
    const killerA = (keyA === killers[0] || keyA === killers[1]) ? 250 : 0;
    const killerB = (keyB === killers[0] || keyB === killers[1]) ? 250 : 0;
    const centerA = (a.toR >= 2 && a.toR <= 5 && a.toC >= 2 && a.toC <= 5) ? 15 : 0;
    const centerB = (b.toR >= 2 && b.toR <= 5 && b.toC >= 2 && b.toC <= 5) ? 15 : 0;
    return (promoB + capB + killerB + centerB) - (promoA + capA + killerA + centerA);
  });
  return legal;
}

function moveToText(m) {
  if (!m) return "";
  const pr = m.promo ? `=${m.promo.toUpperCase()}` : "";
  return `${FILES[m.fromC]}${8 - m.fromR}→${FILES[m.toC]}${8 - m.toR}${pr}`;
}

function quiescence(board, turn, alpha, beta, style, qd = 0, maxQd = 4, ply = 0) {
  const inCheck = isKingInCheck(board, turn);
  if (!inCheck) {
    const pat = evaluateBoard(board, turn, style);
    if (qd >= maxQd) return pat;
    if (pat >= beta) return beta;
    if (alpha < pat) alpha = pat;
  } else if (qd >= maxQd + 1) {
    return evaluateBoard(board, turn, style);
  }

  const enemy = turn === "w" ? "b" : "w";
  const allMoves = generateMoves(board, turn, "-", null);
  const candidates = inCheck
    ? allMoves
    : allMoves.filter(m => m.captured || m.promo);

  candidates.sort((a, b) => {
    const ca = a.captured ? PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece] : 0;
    const cb = b.captured ? PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece] : 0;
    return cb - ca;
  });

  let legalFound = 0;
  for (const m of candidates) {
    const nextB = makeMove(board, m);
    if (isKingInCheck(nextB, turn)) continue;
    legalFound++;

    if (!inCheck && !m.promo && m.captured && PIECE_VALUES[m.piece] > PIECE_VALUES[m.captured]) {
      const seeScore = seeExchangeScore(nextB, m.toR, m.toC, m.piece, m.captured, turn);
      if (seeScore < -80 && !isKingInCheck(nextB, enemy)) continue;
    }

    const s = -quiescence(nextB, enemy, -beta, -alpha, style, qd + 1, maxQd, ply + 1);
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }

  if (inCheck && legalFound === 0) {
    return -20000 + ply * 20;
  }
  return alpha;
}

function searchPV(
  board,
  turn,
  depth,
  alpha,
  beta,
  style,
  castling = "-",
  epSquare = null,
  extUsed = 0,
  dangerMode = false,
  ply = 0
) {
  if (depth <= 0) {
    return { score: quiescence(board, turn, alpha, beta, style, 0, dangerMode ? 5 : 4, ply), pv: [] };
  }

  const baseHash = boardToHash(board, turn, castling, epSquare);
  const ttKey = `${baseHash}_${style}`;
  const cached = transpositionTable.get(ttKey);
  if (cached && cached.depth >= depth && Math.abs(cached.res.score) < 18000) {
    if (cached.flag === "EXACT") return cached.res;
    if (cached.flag === "LOWER" && cached.res.score >= beta) return cached.res;
    if (cached.flag === "UPPER" && cached.res.score <= alpha) return cached.res;
  }

  const ttMoveKey = cached?.bestKey || null;

  const legal = generateLegalMoves(board, turn, castling, epSquare, ttMoveKey, ply);
  if (legal.length === 0) {
    const mateScore = isKingInCheck(board, turn) ? -20000 + ply * 20 : 0;
    return { score: mateScore, pv: [] };
  }

  const enemy = turn === "w" ? "b" : "w";
  let bestScore = -Infinity;
  let bestPV = [];
  let bestKey = null;
  const origAlpha = alpha;

  for (let i = 0; i < legal.length; i++) {
    const m = legal[i];
    const nextB = makeMove(board, m);
    const nextCastling = updateCastlingAfterMove(castling, m);
    const nextEp = getNextEpSquare(m);
    const givesChk = extUsed < 2 && isKingInCheck(nextB, enemy);

    let nextDepth = givesChk ? depth : depth - 1;
    if (!dangerMode && !givesChk && !m.captured && !m.promo && depth >= 3 && i >= 8) {
      nextDepth = depth - 2;
    }

    let child = searchPV(
      nextB,
      enemy,
      nextDepth,
      -beta,
      -alpha,
      style,
      nextCastling,
      nextEp,
      givesChk ? extUsed + 1 : extUsed,
      dangerMode,
      ply + 1
    );
    let score = -child.score;

    if (nextDepth < depth - 1 && score > alpha) {
      child = searchPV(
        nextB,
        enemy,
        depth - 1,
        -beta,
        -alpha,
        style,
        nextCastling,
        nextEp,
        extUsed,
        dangerMode,
        ply + 1
      );
      score = -child.score;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPV = [moveToText(m), ...child.pv];
      bestKey = moveKeyShort(m);
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (!m.captured && !m.promo && ply < 16) {
        const kKey = moveKeyShort(m);
        if (killerMoves[ply][0] !== kKey) {
          killerMoves[ply][1] = killerMoves[ply][0];
          killerMoves[ply][0] = kKey;
        }
      }
      break;
    }
  }

  const res = { score: bestScore, pv: bestPV };
  const flag = bestScore <= origAlpha ? "UPPER" : (bestScore >= beta ? "LOWER" : "EXACT");
  if (transpositionTable.size > 160000) transpositionTable.clear();
  if (!cached || depth >= cached.depth) {
    transpositionTable.set(ttKey, { depth, flag, res, bestKey });
  }
  return res;
}

function allowsEnemyMateInOne(boardAfterOurMove, ourColor, enemyColor, castling, epSquare) {
  const enemyReplies = generateLegalMoves(boardAfterOurMove, enemyColor, castling, epSquare);
  for (const em of enemyReplies) {
    const afterEnemy = makeMove(boardAfterOurMove, em);
    if (isKingInCheck(afterEnemy, ourColor)) {
      const nextCast = updateCastlingAfterMove(castling, em);
      const nextEp = getNextEpSquare(em);
      const ourEscapes = generateLegalMoves(afterEnemy, ourColor, nextCast, nextEp);
      if (ourEscapes.length === 0) return true;
    }
  }
  return false;
}

function allowsEnemyForcedMateInTwo(boardAfterOurMove, ourColor, enemyColor, castling, epSquare) {
  const enemyMoves = generateLegalMoves(boardAfterOurMove, enemyColor, castling, epSquare);
  const ourKing = findKing(boardAfterOurMove, ourColor);

  for (const em of enemyMoves) {
    const afterEnemy = makeMove(boardAfterOurMove, em);
    const givesChk = isKingInCheck(afterEnemy, ourColor);
    const nearOurKing = Math.abs(em.toR - ourKing.r) <= 2 && Math.abs(em.toC - ourKing.c) <= 2;

    if (!givesChk && !em.captured && !nearOurKing) continue;

    if (!givesChk) {
      const seeEnemy = seeExchangeScore(afterEnemy, em.toR, em.toC, em.piece, em.captured, enemyColor);
      if (seeEnemy < -200) continue;
    }

    const nextCast = updateCastlingAfterMove(castling, em);
    const nextEp = getNextEpSquare(em);
    const ourDefenses = generateLegalMoves(afterEnemy, ourColor, nextCast, nextEp);

    if (ourDefenses.length === 0) {
      if (givesChk) return true;
      continue;
    }

    if (ourDefenses.length <= 8) {
      let allResponsesGetMated = true;
      for (const def of ourDefenses) {
        const afterDef = makeMove(afterEnemy, def);
        const defCast = updateCastlingAfterMove(nextCast, def);
        const defEp = getNextEpSquare(def);
        if (!allowsEnemyMateInOne(afterDef, ourColor, enemyColor, defCast, defEp)) {
          allResponsesGetMated = false;
          break;
        }
      }
      if (allResponsesGetMated) return true;
    }
  }
  return false;
}

function detectKingDangerState(board, ourColor, enemyColor, inCheckBefore, threatBefore) {
  if (inCheckBefore) return { isDanger: true, reason: "ШАХ НАШЕМУ КОРОЛЮ" };

  if (allowsEnemyMateInOne(board, ourColor, enemyColor, "-", null)) {
    return { isDanger: true, reason: "ПРЯМАЯ УГРОЗА МАТА ОТ СОПЕРНИКА" };
  }

  const ourKing = findKing(board, ourColor);
  let attackedKingSquares = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const kr = ourKing.r + dr, kc = ourKing.c + dc;
      if (kr >= 0 && kr <= 7 && kc >= 0 && kc <= 7) {
        if (isSquareAttacked(board, kr, kc, enemyColor)) {
          attackedKingSquares++;
        }
      }
    }
  }

  if (attackedKingSquares >= 3) {
    return { isDanger: true, reason: "ШТУРМ ЗОНЫ НАШЕГО КОРОЛЯ" };
  }
  if (threatBefore >= 320 && attackedKingSquares >= 2) {
    return { isDanger: true, reason: "ТАКТИЧЕСКИЙ УДАР ПО ФИГУРЕ И КОРОЛЮ" };
  }

  return { isDanger: false, reason: "" };
}

function getHangingDetails(board, ourSide) {
  let worstLoss = 0;
  let hangingSquare = null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!isColor(p, ourSide)) continue;
      const pieceType = p.toLowerCase();
      if (pieceType === "k") continue;

      const netLoss = Math.max(0, -seeExchangeScore(board, r, c, pieceType, null, ourSide));

      if (netLoss > worstLoss) {
        worstLoss = netLoss;
        hangingSquare = `${FILES[c]}${8 - r}`;
      }
    }
  }
  return { worstLoss, hangingSquare };
}

function detectForkMotif(boardAfter, movedR, movedC, ourSide) {
  const enemy = ourSide === "w" ? "b" : "w";
  const ourPiece = boardAfter[movedR][movedC];
  if (!ourPiece) return false;
  const ourVal = PIECE_VALUES[ourPiece.toLowerCase()] || 100;

  if (seeExchangeScore(boardAfter, movedR, movedC, ourPiece.toLowerCase(), null, ourSide) < 0) {
    return false;
  }

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
        if (isColor(pOld, opponentColor) && !isColor(pNew, opponentColor)) {
          if (!fromSq || pOld.toLowerCase() === "k") {
            fromSq = `${FILES[c]}${8 - r}`;
            movedPiece = pOld.toLowerCase();
            fromRow = r;
            colIndex = c;
          }
        }
        if (isColor(pNew, opponentColor) && !isColor(pOld, opponentColor)) {
          if (!toSq || pNew.toLowerCase() === "k") {
            toSq = `${FILES[c]}${8 - r}`;
            movedPiece = pNew.toLowerCase();
            toRow = r;
          }
        }
      }
    }
  }

  if (diffSquares > 8 || diffSquares === 0) return null;
  if (fromSq && toSq) {
    const isDoublePawnPush = movedPiece === "p" && Math.abs(toRow - fromRow) === 2;
    const epTarget = isDoublePawnPush ? `${FILES[colIndex]}${8 - (fromRow + toRow) / 2}` : null;
    return { from: fromSq, to: toSq, piece: movedPiece, color: opponentColor, epTarget };
  }
  return null;
}

function computeSmartNextPremove(boardOnEnemyTurn, myColor, enemyColor, castling, epSquare, lastOurMove, style = "tal") {
  const enemyMoves = generateLegalMoves(boardOnEnemyTurn, enemyColor, castling, epSquare);
  if (enemyMoves.length === 0) return null;

  const enemyScored = enemyMoves.map((em) => {
    const nb = makeMove(boardOnEnemyTurn, em);
    const seeScore = seeExchangeScore(nb, em.toR, em.toC, em.piece, em.captured, enemyColor);
    const { worstLoss: enemyHangingLoss } = getHangingDetails(nb, enemyColor);

    const givesCheck = isKingInCheck(nb, myColor);
    const isEnemyMateInOne = givesCheck && generateLegalMoves(nb, myColor, "-", null).length === 0;
    if (isEnemyMateInOne) {
      return { em, nb, seeScore: 9999, score: 50000 };
    }

    const blunderPenalty = seeScore < -50 ? seeScore * 3.2 : seeScore * 1.1;
    const hangingPenalty = enemyHangingLoss > 80 ? -enemyHangingLoss * 1.4 : 0;
    const safeCheckBonus = (givesCheck && seeScore >= 0) ? 45 : 0;

    const evalScore = evaluateBoard(nb, enemyColor, style) + blunderPenalty + hangingPenalty + safeCheckBonus;
    return { em, nb, seeScore, score: evalScore };
  });

  enemyScored.sort((a, b) => b.score - a.score);

  const topScore = enemyScored[0].score;
  const reasonableEnemyMoves = enemyScored.filter(
    (item, idx) => idx === 0 || (item.seeScore >= -80 && (topScore - item.score) <= 180)
  ).slice(0, 3);

  const topEnemy = enemyScored[0];
  const secondEnemy = enemyScored[1] || null;
  const scoreGap = secondEnemy ? (topEnemy.score - secondEnemy.score) : 999;

  const enemyFrom = `${FILES[topEnemy.em.fromC]}${8 - topEnemy.em.fromR}`;
  const enemyTo = `${FILES[topEnemy.em.toC]}${8 - topEnemy.em.toR}`;

  const nextCastling = updateCastlingAfterMove(castling, topEnemy.em);
  const nextEp = getNextEpSquare(topEnemy.em);
  const ourReplies = generateLegalMoves(topEnemy.nb, myColor, nextCastling, nextEp);
  if (ourReplies.length === 0) return null;

  const validPremoveReplies = ourReplies.filter(
    (m) => isColor(boardOnEnemyTurn[m.fromR][m.fromC], myColor) && m.promo !== "n"
  );
  if (validPremoveReplies.length === 0) return null;

  const scoredReplies = validPremoveReplies.map((m) => {
    const afterOur = makeMove(topEnemy.nb, m);
    const ourSee = seeExchangeScore(afterOur, m.toR, m.toC, m.piece, m.captured, myColor);
    const { worstLoss } = getHangingDetails(afterOur, myColor);
    const gained = m.captured ? (PIECE_VALUES[m.captured] || 100) : 0;

    const seePenalty = ourSee < -40 ? ourSee * 3.0 : ourSee;
    const hangingPen = worstLoss > gained + 25 ? -(worstLoss - gained) * 2.4 : 0;

    const isRealRecapture =
      m.toR === topEnemy.em.toR &&
      m.toC === topEnemy.em.toC &&
      m.captured &&
      topEnemy.seeScore >= -50 &&
      ourSee >= -20;

    const recapBonus = isRealRecapture ? 110 : 0;
    const s = evaluateBoard(afterOur, myColor, style) + seePenalty + hangingPen + recapBonus;
    return { m, score: s, ourSee, worstLoss, gained, isRealRecapture };
  });

  scoredReplies.sort((a, b) => b.score - a.score);
  const bestReplyObj = scoredReplies[0];
  if (!bestReplyObj || bestReplyObj.ourSee < -80) return null;

  const rm = bestReplyObj.m;
  const ourFrom = `${FILES[rm.fromC]}${8 - rm.fromR}`;
  const ourTo = `${FILES[rm.toC]}${8 - rm.toR}`;

  let safeAgainstTopBranches = true;
  if (!bestReplyObj.isRealRecapture && reasonableEnemyMoves.length > 1) {
    for (let i = 1; i < reasonableEnemyMoves.length; i++) {
      const altEnemy = reasonableEnemyMoves[i];
      const altCast = updateCastlingAfterMove(castling, altEnemy.em);
      const altEp = getNextEpSquare(altEnemy.em);
      const altOurLegal = generateLegalMoves(altEnemy.nb, myColor, altCast, altEp);
      const matchingMove = altOurLegal.find(
        (am) => am.fromR === rm.fromR && am.fromC === rm.fromC && am.toR === rm.toR && am.toC === rm.toC
      );
      if (!matchingMove) {
        safeAgainstTopBranches = false;
        break;
      }
      const afterAltOur = makeMove(altEnemy.nb, matchingMove);
      const altSee = seeExchangeScore(afterAltOur, matchingMove.toR, matchingMove.toC, matchingMove.piece, matchingMove.captured, myColor);
      if (altSee < -50 || allowsEnemyMateInOne(afterAltOur, myColor, enemyColor, "-", null)) {
        safeAgainstTopBranches = false;
        break;
      }
    }
  }

  let confidence = 0;
  let predictionType = "pv_lookahead";
  let reasonText = `🔮 ПРЕМУВ НА 1-Ю ЛИНИЮ ВРАГА (${enemyFrom}→${enemyTo})`;

  if (enemyMoves.length === 1) {
    confidence = 99;
    predictionType = "forced_single";
    reasonText = `⚡ 100% ФОРСАЖ: У врага 1 легальный ход (${enemyFrom}→${enemyTo})`;
  } else if (bestReplyObj.isRealRecapture && scoreGap >= 60) {
    confidence = 95;
    predictionType = "recapture";
    reasonText = `⚔ ЧЕСТНЫЙ ПЕРЕБОЙ НА ${ourTo.toUpperCase()} (ПОСЛЕ ${enemyFrom}→${enemyTo})`;
  } else if (bestReplyObj.isRealRecapture) {
    confidence = 86;
    predictionType = "recapture";
    reasonText = `⚔ ВЕРОЯТНЫЙ РАЗМЕН НА ${ourTo.toUpperCase()} (${enemyFrom}→${enemyTo})`;
  } else if (scoreGap >= 190 && topEnemy.seeScore >= 0) {
    confidence = 89;
    predictionType = "forced_tactical";
    reasonText = `⚡ ВЫНУЖДЕННЫЙ ОТВЕТ ВРАГА (${enemyFrom}→${enemyTo})`;
  } else if (safeAgainstTopBranches && bestReplyObj.ourSee >= 0) {
    confidence = 78;
    predictionType = "safe_universal";
    reasonText = `🛡 БЕЗОПАСНЫЙ ПРЕМУВ ПРОТИВ ТОП-ЛИНИЙ (${ourFrom}→${ourTo})`;
  } else {
    return { canPremove: false };
  }

  return {
    canPremove: true,
    confidence,
    predictionType,
    reasonText,
    forMoveUci: lastOurMove ? lastOurMove.uci : null,
    predictedEnemyMove: { from: enemyFrom, to: enemyTo, uci: `${enemyFrom}${enemyTo}` },
    premove: {
      from: ourFrom,
      to: ourTo,
      promo: rm.promo || null,
      uci: `${ourFrom}${ourTo}${rm.promo || ""}`,
      piece: rm.piece
    }
  };
}

async function analyzeAdaptiveMaster(
  fen,
  elo,
  style = "tal",
  pass = "fast",
  clientLastEnemyMove = null,
  bulletTurbo = false
) {
  const { board, turn, castling, epSquare: fenEp, pieceCount, boardKey } = parseFEN(fen);
  const enemy = turn === "w" ? "b" : "w";

  let detectedOppMove = null;
  if (clientLastEnemyMove && clientLastEnemyMove.from && clientLastEnemyMove.to) {
    detectedOppMove = clientLastEnemyMove;
  } else if (lastAnalyzedState.board) {
    detectedOppMove = detectLastOpponentMove(lastAnalyzedState.board, board, enemy);
  }
  const activeEpSquare = fenEp || (detectedOppMove ? detectedOppMove.epTarget : null);

  let legal = generateLegalMoves(board, turn, castling, activeEpSquare);
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

  const dangerStatus = detectKingDangerState(board, turn, enemy, inCheckBefore, threatBefore);
  let isDangerPosition = dangerStatus.isDanger;
  let dangerReason = dangerStatus.reason;

  let cloudLines = null;
  if (pass === "fast") {
    cloudLines = cloudCache.get(fen) || null;
  } else if (elo >= 1800) {
    cloudLines = await fetchLichessCloud3000(fen, pieceCount);
  }

  let maxTargetDepth = pass === "fast" ? 2 : (legal.length <= 26 ? 3 : 2);
  if (pass === "deep" && !bulletTurbo && (isDangerPosition || !cloudLines) && legal.length <= 18) {
    maxTargetDepth = 4;
  }
  if (isPawnEndgame && legal.length <= 14) {
    maxTargetDepth = pass === "fast" ? 3 : (bulletTurbo ? 4 : 5);
  }

  const startTime = Date.now();
  const timeBudgetMs = pass === "fast"
    ? (bulletTurbo ? 28 : 45)
    : (isDangerPosition ? 340 : (bulletTurbo ? 110 : 210));

  if (maxTargetDepth >= 3) {
    for (let d = 1; d < maxTargetDepth - 1; d++) {
      if (Date.now() - startTime > timeBudgetMs * 0.45) break;
      searchPV(board, turn, d, -30000, 30000, style, castling, activeEpSquare, 0, isDangerPosition, 0);
    }
    const rootHash = `${boardToHash(board, turn, castling, activeEpSquare)}_${style}`;
    const rootTT = transpositionTable.get(rootHash);
    if (rootTT && rootTT.bestKey) {
      legal = generateLegalMoves(board, turn, castling, activeEpSquare, rootTT.bestKey, 0);
    }
  }

  const enemyMobilityBefore = generateMoves(board, enemy, "-", null).length;
  let mateThreatCount = 0;

  const scored = legal.map((m, idx) => {
    const nextB = makeMove(board, m);
    const nextCastling = updateCastlingAfterMove(castling, m);
    const nextEp = getNextEpSquare(m);

    const gainedNow = m.captured ? (PIECE_VALUES[m.captured] || 0) : 0;
    const { worstLoss: rawThreatAfter } = getHangingDetails(nextB, turn);
    const moveSeeScore = seeExchangeScore(nextB, m.toR, m.toC, m.piece, m.captured, turn);

    const givesCheck = isKingInCheck(nextB, enemy);
    const threatAfter = givesCheck ? Math.min(rawThreatAfter, Math.max(0, -moveSeeScore)) : rawThreatAfter;
    const isMateInOne = givesCheck && generateLegalMoves(nextB, enemy, nextCastling, nextEp).length === 0;

    const blundersMateInOne = !isMateInOne && allowsEnemyMateInOne(nextB, turn, enemy, nextCastling, nextEp);
    if (blundersMateInOne) {
      mateThreatCount++;
    }

    let blundersMateInTwo = false;
    if (!isMateInOne && !blundersMateInOne && (isDangerPosition || pass === "deep") && idx < 12) {
      blundersMateInTwo = allowsEnemyForcedMateInTwo(nextB, turn, enemy, nextCastling, nextEp);
      if (blundersMateInTwo) {
        mateThreatCount++;
      }
    }

    const fromSq = `${FILES[m.fromC]}${8 - m.fromR}`;
    const toSq = `${FILES[m.toC]}${8 - m.toR}`;
    const promoSuffix = m.promo ? m.promo : "";
    const uci = fromSq + toSq + promoSuffix;

    let searchScore = 0;
    let pvResult = { pv: [] };

    const elapsed = Date.now() - startTime;
    const effectiveChildDepth = (elapsed > timeBudgetMs && idx >= 6)
      ? Math.max(1, maxTargetDepth - 2)
      : maxTargetDepth - 1;

    if (isMateInOne) {
      searchScore = 29900;
    } else if (blundersMateInOne) {
      searchScore = -29000;
    } else if (blundersMateInTwo) {
      searchScore = -26500;
    } else {
      pvResult = searchPV(
        nextB,
        enemy,
        effectiveChildDepth,
        -30000,
        30000,
        style,
        nextCastling,
        nextEp,
        givesCheck ? 1 : 0,
        isDangerPosition,
        1
      );
      searchScore = -pvResult.score;
    }

    let cloudBonus = 0;
    let fromCloud = false;
    let cloudPV = null;
    if (cloudLines && !isMateInOne && !blundersMateInOne && !blundersMateInTwo) {
      const cIdx = cloudLines.findIndex(
        cl => cl.from === fromSq && cl.to === toSq && (cl.promo || null) === (m.promo || null)
      );
      if (cIdx === 0) {
        cloudBonus = elo >= 2400 ? 320 : 180;
        fromCloud = true;
        cloudPV = cloudLines[0].pvChain;
      } else if (cIdx === 1) {
        cloudBonus = 90;
      }
    }

    const isSoundTacticalSacrifice =
      !blundersMateInOne &&
      !blundersMateInTwo &&
      threatAfter > gainedNow + 120 &&
      searchScore >= 240;

    const gmSacrificeBoost = isSoundTacticalSacrifice
      ? Math.min(80, Math.round(profile.sacrificeBoost * 0.25))
      : 0;

    const seePenalty = (!isSoundTacticalSacrifice && moveSeeScore < -50)
      ? Math.round(moveSeeScore * 0.45)
      : 0;

    const addedThreat = Math.max(0, threatAfter - Math.max(threatBefore, gainedNow));
    const netTacticalPenalty = (!isSoundTacticalSacrifice && addedThreat > 25)
      ? -Math.round(addedThreat * 0.65)
      : 0;

    const movedPieceSafe =
      !blundersMateInOne &&
      !blundersMateInTwo &&
      moveSeeScore >= -25 &&
      (!isSquareAttacked(nextB, m.toR, m.toC, enemy) || (threatAfter <= gainedNow));

    const bookEntry = bookMoves.find(b => b.from === fromSq && b.to === toSq);
    const allowDubiousGambits = (style === "tal" || style === "mogging") && elo < 1900;
    const bookBonus = (bookEntry && movedPieceSafe)
      ? (bookEntry.bonus > 105 && !allowDubiousGambits ? 25 : bookEntry.bonus)
      : 0;

    const expEntry = learnedForPos[uci];
    const memoryBonus = (expEntry && movedPieceSafe) ? Math.min(60, expEntry.bonus) : 0;

    let kingPenalty = 0;
    const isCastling = m.piece === "k" && Math.abs(m.fromC - m.toC) === 2;
    if (m.piece === "k") {
      if (!isEndgame && !inCheckBefore && !isCastling) {
        kingPenalty = -220;
      } else if (isEndgame && movedPieceSafe) {
        const distCenterBefore = Math.abs(3.5 - m.fromR) + Math.abs(3.5 - m.fromC);
        const distCenterAfter = Math.abs(3.5 - m.toR) + Math.abs(3.5 - m.toC);
        if (distCenterAfter < distCenterBefore) {
          kingPenalty = 35;
        }
      }
    }
    const castlingBonus = isCastling ? 78 : 0;

    let rawKickBonus = 0;
    if (m.piece === "p" && movedPieceSafe) {
      const nextMoves = generateMoves(nextB, turn, "-", null).filter(
        nm => nm.fromR === m.toR && nm.fromC === m.toC && nm.captured
      );
      if (nextMoves.some(nm => PIECE_VALUES[nm.captured] >= 300)) {
        rawKickBonus = 38;
      }
    }

    let mobilitySqueezeBonus = 0;
    if (profile.squeeze >= 1.5 && movedPieceSafe) {
      const enemyMobilityAfter = generateMoves(nextB, enemy, "-", null).length;
      mobilitySqueezeBonus = Math.round((enemyMobilityBefore - enemyMobilityAfter) * profile.squeeze * 1.5);
    }

    const savedHangingBonus = (threatBefore >= 75 && threatAfter < 50 && !blundersMateInOne && !blundersMateInTwo) ? 95 : 0;

    const isFork = detectForkMotif(nextB, m.toR, m.toC, turn);
    const isPin = detectPinMotif(nextB, m.toR, m.toC, turn);

    const safeKickBonus = movedPieceSafe ? rawKickBonus : 0;
    const safeForkBonus = (movedPieceSafe && isFork) ? 55 : 0;
    const safePinBonus = (movedPieceSafe && isPin) ? 40 : 0;
    const safeCheckBonus = (movedPieceSafe && givesCheck) ? Math.min(25, profile.checkBonus) : 0;

    const finalScore = isMateInOne
      ? 50000
      : searchScore +
        bookBonus +
        memoryBonus +
        kingPenalty +
        castlingBonus +
        safeKickBonus +
        mobilitySqueezeBonus +
        gmSacrificeBoost +
        savedHangingBonus +
        safeForkBonus +
        safePinBonus +
        safeCheckBonus +
        cloudBonus +
        seePenalty +
        netTacticalPenalty;

    const movedPieceAttacked = isSquareAttacked(nextB, m.toR, m.toC, enemy);
    const putUnderAttack =
      blundersMateInOne ||
      blundersMateInTwo ||
      moveSeeScore < -50 ||
      (!isSoundTacticalSacrifice && movedPieceAttacked && (threatAfter > gainedNow + 25));

    const moveLabel = m.promo ? `${fromSq}→${toSq}=${m.promo.toUpperCase()}` : `${fromSq}→${toSq}`;
    const fullPV = isMateInOne
      ? `${moveLabel}# (МАТ В 1 ХОД!)`
      : (cloudPV || [moveLabel, ...pvResult.pv.slice(0, 3)].join(" ➔ "));

    return {
      rawMove: m,
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
      blundersMate: blundersMateInOne || blundersMateInTwo,
      isSacrifice: isSoundTacticalSacrifice,
      isTalSacrifice: isSoundTacticalSacrifice && profile.sacrificeBoost >= 80,
      isFork: movedPieceSafe && isFork,
      isPin: movedPieceSafe && isPin,
      savedHangingPiece: threatBefore >= 75 && threatAfter < 50 && !blundersMateInOne && !blundersMateInTwo,
      ignoredHangingPiece: !isSoundTacticalSacrifice && threatBefore >= 75 && threatAfter >= 75 && gainedNow < threatBefore,
      underDirectAttack: putUnderAttack,
      ruinedCastling: kingPenalty < 0,
      kicksEnemyPiece: safeKickBonus > 0,
      givesCheck,
      pureSearchScore: searchScore,
      trueScore: finalScore,
      evalPawns: isMateInOne
        ? "МАТ #1"
        : (blundersMateInOne ? "-МАТ #1" : (blundersMateInTwo ? "-МАТ #2" : (searchScore / 100).toFixed(2))),
      whitePerspectiveEval: isMateInOne
        ? (turn === "w" ? 10 : -10)
        : ((turn === "w" ? searchScore : -searchScore) / 100).toFixed(2)
    };
  });

  if (mateThreatCount >= 2 && !isDangerPosition) {
    isDangerPosition = true;
    dangerReason = "ОПАСНОСТЬ МАТОВОЙ ЛОВУШКИ";
  }

  scored.sort((a, b) => b.trueScore - a.trueScore);

  const topScore = scored[0].trueScore;
  const solidMoves = scored.filter(m =>
    !m.blundersMate &&
    !m.ignoredHangingPiece &&
    !m.underDirectAttack &&
    !m.ruinedCastling &&
    (topScore - m.trueScore <= 120)
  );
  const nonMateMoves = scored.filter(m => !m.blundersMate);
  const safePool = solidMoves.length > 0 ? solidMoves : (nonMateMoves.length > 0 ? [nonMateMoves[0]] : [scored[0]]);

  const maxAllowedCpLoss =
    elo >= 2000 ? 0 :
    elo >= 1700 ? 25 :
    elo >= 1400 ? 55 :
    elo >= 1000 ? 110 : 220;

  let bestMove = safePool[0];
  if (!bestMove.isMateInOne && !isDangerPosition && maxAllowedCpLoss > 0 && safePool.length > 1) {
    const bestPure = safePool[0].pureSearchScore;
    const humanCandidates = safePool.filter(
      m => (bestPure - m.pureSearchScore) <= maxAllowedCpLoss
    );
    if (humanCandidates.length > 1) {
      bestMove = humanCandidates[humanCandidates.length - 1];
    }
  }

  if (bestMove && bestMove.rawMove && !bestMove.isMateInOne && !isDangerPosition) {
    const boardAfterBest = makeMove(board, bestMove.rawMove);
    const nextCast = updateCastlingAfterMove(castling, bestMove.rawMove);
    const nextEpSq = getNextEpSquare(bestMove.rawMove);
    bestMove.nextPremove = computeSmartNextPremove(
      boardAfterBest,
      turn,
      enemy,
      nextCast,
      nextEpSq,
      bestMove,
      style
    );
  }

  const avgCandidates = safePool.filter(
    m => m.uci !== bestMove.uci && !m.blundersMate && !(m.from === bestMove.from && m.to === bestMove.to && m.promo === "n")
  );
  const averageMove =
    avgCandidates[0] ||
    scored.find(m => m.uci !== bestMove.uci && !m.blundersMate && !m.underDirectAttack && !m.ignoredHangingPiece && !(m.from === bestMove.from && m.to === bestMove.to && m.promo === "n")) ||
    bestMove;
  const worstMove = scored[scored.length - 1];

  const clampedPure = Math.max(-1200, Math.min(1200, scored[0].pureSearchScore));
  const currentPureWhiteScore = turn === "w" ? clampedPure : -clampedPure;

  const isSameBoardAsLast = Boolean(
    lastAnalyzedState.board &&
    boardToHash(lastAnalyzedState.board, turn) === boardToHash(board, turn)
  );

  const baselinePrevWhiteScore = isSameBoardAsLast
    ? lastAnalyzedState.prevTurnScoreForWhite
    : lastAnalyzedState.pureBestScoreForWhite;

  let opponentEvalDropPawns = isSameBoardAsLast ? (lastAnalyzedState.lastDropPawns || 0) : 0;

  if (detectedOppMove && lastAnalyzedState.board && baselinePrevWhiteScore !== undefined) {
    const rawDiff = turn === "w"
      ? (currentPureWhiteScore - baselinePrevWhiteScore)
      : (baselinePrevWhiteScore - currentPureWhiteScore);
    opponentEvalDropPawns = Math.max(0, rawDiff / 100).toFixed(2);
  }

  lastAnalyzedState = {
    board: board.map(r => r.slice()),
    turn,
    pureBestScoreForWhite: currentPureWhiteScore,
    prevTurnScoreForWhite: baselinePrevWhiteScore,
    lastDropPawns: opponentEvalDropPawns
  };

  return {
    pass,
    best: bestMove,
    average: averageMove,
    worst: worstMove,
    isDangerPosition,
    dangerReason,
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