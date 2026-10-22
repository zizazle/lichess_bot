window.ChessExplainer = (function () {
  const PIECE_NAMES = {
    p: "Пешка",
    n: "Конь",
    b: "Слон",
    r: "Ладья",
    q: "Ферзь",
    k: "Король"
  };

  const PIECE_GENITIVE = {
    p: "пешку",
    n: "коня",
    b: "слона",
    r: "ладью",
    q: "ферзя",
    k: "короля"
  };

  const FILES = "abcdefgh";

  function parseBoard(fen) {
    if (!fen) return null;
    const parts = fen.split(" ");
    const rows = parts[0].split("/");
    const turn = parts[1] || "w";
    const grid = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (const ch of rows[r]) {
        if (!isNaN(ch)) {
          for (let i = 0; i < parseInt(ch, 10); i++) row.push(null);
        } else {
          row.push(ch);
        }
      }
      grid.push(row);
    }
    return { grid, turn };
  }

  function sqToRC(sq) {
    if (!sq || sq.length < 2) return { r: 0, c: 0 };
    const c = FILES.indexOf(sq[0]);
    const r = 8 - parseInt(sq[1], 10);
    return { r, c };
  }

  function detectPositionalMotifs(m, fen) {
    const parsed = parseBoard(fen);
    if (!parsed || !m || !m.from || !m.to) return {};
    const { grid, turn } = parsed;
    const isW = turn === "w";
    const from = sqToRC(m.from);
    const to = sqToRC(m.to);
    const ownPawn = isW ? "P" : "p";
    const enemyPawn = isW ? "p" : "P";
    const ownRook = isW ? "R" : "r";
    const ownQueen = isW ? "Q" : "q";
    const ownBishop = isW ? "B" : "b";

    let ownPawnsOnDestFile = 0;
    let enemyPawnsOnDestFile = 0;
    for (let r = 0; r < 8; r++) {
      if (grid[r][to.c] === ownPawn) ownPawnsOnDestFile++;
      if (grid[r][to.c] === enemyPawn) enemyPawnsOnDestFile++;
    }
    const isOpenFile = (m.piece === "r" || m.piece === "q") && ownPawnsOnDestFile === 0 && enemyPawnsOnDestFile === 0;
    const isSemiOpenFile = (m.piece === "r" || m.piece === "q") && ownPawnsOnDestFile === 0 && enemyPawnsOnDestFile > 0;

    const seventhRank = isW ? 1 : 6;
    const isSeventhRankInvasion = (m.piece === "r" || m.piece === "q") && to.r === seventhRank;

    const pawnSupportRow = isW ? to.r + 1 : to.r - 1;
    const supportedByPawn =
      pawnSupportRow >= 0 &&
      pawnSupportRow <= 7 &&
      ((to.c > 0 && grid[pawnSupportRow][to.c - 1] === ownPawn) ||
        (to.c < 7 && grid[pawnSupportRow][to.c + 1] === ownPawn));
    const inEnemyTerritory = isW ? to.r <= 4 : to.r >= 3;
    const isOutpost = (m.piece === "n" || m.piece === "b") && supportedByPawn && inEnemyTerritory;

    const isFianchetto = m.piece === "b" && ["g2", "b2", "g7", "b7"].includes(m.to);

    const isProphylaxisEdge =
      m.piece === "p" &&
      !m.captured &&
      ((isW && (m.to === "a3" || m.to === "h3")) || (!isW && (m.to === "a6" || m.to === "h6")));

    const enemyCenterRow = isW ? to.r - 1 : to.r + 1;
    const challengesEnemyPawn =
      m.piece === "p" &&
      !m.captured &&
      enemyCenterRow >= 0 &&
      enemyCenterRow <= 7 &&
      ((to.c > 0 && grid[enemyCenterRow][to.c - 1] === enemyPawn) ||
        (to.c < 7 && grid[enemyCenterRow][to.c + 1] === enemyPawn));

    let isPassedPawn = false;
    if (m.piece === "p" && (isW ? to.r <= 4 : to.r >= 3)) {
      isPassedPawn = true;
      const startR = isW ? 0 : to.r + 1;
      const endR = isW ? to.r - 1 : 7;
      for (let r = startR; r <= endR; r++) {
        for (let dc = -1; dc <= 1; dc++) {
          const cc = to.c + dc;
          if (cc >= 0 && cc <= 7 && grid[r][cc] === enemyPawn) {
            isPassedPawn = false;
          }
        }
      }
    }

    let isBattery = false;
    if (m.piece === "q" || m.piece === "r") {
      for (let r = 0; r < 8; r++) {
        if (r !== from.r && (grid[r][to.c] === ownRook || grid[r][to.c] === ownQueen)) {
          isBattery = true;
        }
      }
    }
    if (m.piece === "q" || m.piece === "b") {
      for (let d = -7; d <= 7; d++) {
        if (d === 0) continue;
        const r1 = to.r + d, c1 = to.c + d;
        const r2 = to.r + d, c2 = to.c - d;
        if (r1 >= 0 && r1 <= 7 && c1 >= 0 && c1 <= 7 && (grid[r1][c1] === ownBishop || grid[r1][c1] === ownQueen)) isBattery = true;
        if (r2 >= 0 && r2 <= 7 && c2 >= 0 && c2 <= 7 && (grid[r2][c2] === ownBishop || grid[r2][c2] === ownQueen)) isBattery = true;
      }
    }

    const homeRow = isW ? 7 : 0;
    const isDevelopment = (m.piece === "n" || m.piece === "b") && from.r === homeRow && to.r !== homeRow;
    const isRetreat = isW ? to.r > from.r : to.r < from.r;
    const isCenterControl = ["d4", "d5", "e4", "e5"].includes(m.to);

    return {
      isOpenFile,
      isSemiOpenFile,
      isSeventhRankInvasion,
      isOutpost,
      isFianchetto,
      isProphylaxisEdge,
      challengesEnemyPawn,
      isPassedPawn,
      isBattery,
      isDevelopment,
      isRetreat,
      isCenterControl
    };
  }

  function explainMove(m, category, fen = "", style = "tal", roflMode = false) {
    if (!m) return "Ожидание вашего хода...";

    const pName = PIECE_NAMES[m.piece] || "Фигура";
    const capAcc = m.captured ? PIECE_GENITIVE[m.captured] || "фигуру" : "";
    const promoText = m.promo ? `=${m.promo.toUpperCase()}` : "";
    const tags = `${m.memoryBonus > 20 ? " ◈[MEM]" : ""}${m.fromCloud ? " ⚡[3000]" : ""}`;
    const header = `${pName} ${m.from} → ${m.to}${promoText}${tags}`;

    const motifs = detectPositionalMotifs(m, fen);

    // ==========================================
    // КАТЕГОРИЯ 1: ЛУЧШИЙ ХОД (BEST)
    // ==========================================
    if (category === "best") {
      if (m.isMateInOne) {
        return `👑💀 ${header}# — АХАХАХ, МАТ В 1 ХОД! Соперник зевнул прямое фаталити. Добивай его!`;
      }
      if (m.isCheckmate || m.trueScore > 15000) {
        return `👑 ${header} — Неизбежный форсированный мат в несколько ходов!`;
      }
      if (m.promo === "n") {
        return `⚔ ${header} — Тактическое превращение в Коня! Вместо ферзя ставим коня с вилкой или матовой угрозой.`;
      }
      if (m.promo === "q") {
        return `👑 ${header} — Проводим пешку в нового Ферзя и получаем решающий материальный перевес!`;
      }
      if (m.isEnPassant) {
        return `⚡ ${header} — Взятие на проходе (En Passant)! Снимаем с доски проскочившую пешку соперника.`;
      }

      if (style === "mogging" || roflMode) {
        if (m.isTalSacrifice || m.isSacrifice) {
          return `⚡ ${header} — Наглая жертва! Сносим прикрытие его короля и идем за матом.`;
        }
        if (m.isFork) {
          return `⚔ ${header} — Жесткая вилка на две фигуры! Одной придется попрощаться.`;
        }
        if (m.isPin) {
          return `◈ ${header} — Прибили связкой намертво. Фигура соперника парализована.`;
        }
        if (m.captured) {
          return `✦ ${header} — Забираем ${capAcc} на ${m.to} и давим дальше.`;
        }
        if (m.kicksEnemyPiece) {
          return `▲ ${header} — Пинаем чужую фигуру пешкой и забираем темп.`;
        }
      }

      if (m.bookName) {
        return `◈ ${header} — ${m.bookName}.`;
      }
      if (m.savedHangingPiece) {
        return `🛡 ${header} — Спасаем фигуру или пешку из-под прямого удара.`;
      }
      if (m.isTalSacrifice || m.isSacrifice) {
        return `⚡ ${header} — Мощная тактическая жертва для прорыва к королю.`;
      }
      if (m.isFork) {
        return `⚔ ${header} — Двойной удар (вилка) сразу по двум целям.`;
      }
      if (m.isPin) {
        return `◈ ${header} — Связываем фигуру соперника по линии короля или ферзя.`;
      }
      if (m.isCastling) {
        return `🛡 ${header} — Рокировка: прячем короля и вводим ладью в бой.`;
      }
      if (m.captured && m.givesCheck) {
        return `⚡ ${header} — Забираем ${capAcc} на ${m.to} с шахом!`;
      }
      if (m.captured) {
        return `✦ ${header} — Выигрываем ${capAcc} или проводим выгодный размен на ${m.to}.`;
      }
      if (m.kicksEnemyPiece) {
        return `▲ ${header} — Прогоняем фигуру врага с потерей темпа.`;
      }
      if (m.givesCheck) {
        return `⚡ ${header} — Атакующий шах королю с захватом инициативы.`;
      }
      if (motifs.isSeventhRankInvasion) {
        return `▲ ${header} — Врываемся в «обжорный ряд» за пешками врага.`;
      }
      if (motifs.isOpenFile || motifs.isSemiOpenFile) {
        return `◈ ${header} — Захватываем вертикаль «${m.to[0]}» тяжелой фигурой.`;
      }
      if (motifs.isBattery) {
        return `❖ ${header} — Строим пробивную батарею по одной линии.`;
      }
      if (motifs.isOutpost) {
        return `✦ ${header} — Сажаем фигуру на мощный защищенный форпост ${m.to}.`;
      }
      if (motifs.isFianchetto) {
        return `◈ ${header} — Выводим слона на большую диагональ.`;
      }
      if (motifs.challengesEnemyPawn) {
        return `▲ ${header} — Подрываем пешечный центр соперника.`;
      }
      if (motifs.isPassedPawn) {
        return `▲ ${header} — Ведем проходную пешку вперед в ферзи.`;
      }
      if (motifs.isDevelopment) {
        return `✦ ${header} — Быстро вводим фигуру в игру ближе к центру.`;
      }
      if (m.piece === "p" && motifs.isCenterControl) {
        return `✦ ${header} — Захватываем центр доски и открываем линии.`;
      }
      return `✦ ${header} — Сильный ход: улучшаем позицию и усиливаем нажим.`;
    }

    // ==========================================
    // КАТЕГОРИЯ 2: ЗАПАСНОЙ ВАРИАНТ (AVG)
    // ==========================================
    if (category === "avg") {
      if (m.promo === "q") {
        return `❖ ${header} — Превращение в Ферзя с переходом в спокойный выигранный эндшпиль.`;
      }
      if (m.isEnPassant) {
        return `❖ ${header} — Взятие пешки на проходе с разгрузкой центра.`;
      }
      if (m.bookName) {
        return `❖ ${header} — Спокойное продолжение (${m.bookName}).`;
      }
      if (m.captured) {
        return `❖ ${header} — Рабочий размен на ${m.to}, но 1-я линия сильнее.`;
      }
      return `❖ ${header} — Надежный запасной ход без риска.`;
    }

    // ==========================================
    // КАТЕГОРИЯ 3: ЗЕВОК / ОШИБКА (WORST)
    // ==========================================
    if (category === "worst") {
      if (m.underDirectAttack) {
        return `✖ ${header} — Грубый зевок! Подставляет фигуру или пешку под бой на ${m.to}.`;
      }
      if (m.ignoredHangingPiece) {
        return `✖ ${header} — Оставляет вашу атакованную фигуру без защиты.`;
      }
      if (m.ruinedCastling) {
        return `✖ ${header} — Лишает короля рокировки в опасном центре.`;
      }
      return `✖ ${header} — Слабый ход: теряет время и отдает инициативу.`;
    }
  }

  function roastOpponentMove(oppMove, evalDropPawns, fen, weHaveMateInOne = false) {
    if (!oppMove || !oppMove.from || !oppMove.to) return null;

    const pName = PIECE_NAMES[oppMove.piece] || "Фигура";
    const moveStr = `${pName} ${oppMove.from} → ${oppMove.to}`;
    const drop = parseFloat(evalDropPawns) || 0;
    const toRC = sqToRC(oppMove.to);

    if (weHaveMateInOne) {
      return {
        emoji: "😱",
        badgeText: "ЗЕВНУЛ МАТ В 1 ХОД! 😂💀",
        text: `😱💀 ${moveStr} — АХАХАХ! Чел реально зевнул МАТ В 1 ХОД! Оформляй ему билет в лобби!`
      };
    }

    if (drop >= 2.0) {
      const blunders = [
        `💀 ${moveStr} (-${drop.toFixed(1)}) — Жесткий зевок! Соперник подарил перевес на ровном месте.`,
        `😂 ${moveStr} (-${drop.toFixed(1)}) — Классический подгон от соперника, наказываем!`,
        `🤡 ${moveStr} (-${drop.toFixed(1)}) — Развалил свою позицию одним ходом.`
      ];
      return {
        emoji: "💀",
        badgeText: `BLUNDER • -${drop.toFixed(1)}`,
        text: blunders[(toRC.r + toRC.c) % blunders.length]
      };
    }

    if (drop >= 0.75) {
      return {
        emoji: "😂",
        badgeText: `MISTAKE • -${drop.toFixed(1)}`,
        text: `😂 ${moveStr} (-${drop.toFixed(1)}) — Неточный ход, перехватываем инициативу!`
      };
    }

    if (oppMove.piece === "p" && (oppMove.to[0] === "a" || oppMove.to[0] === "h")) {
      return {
        emoji: "◈",
        badgeText: "ПАССИВ НА КРАЮ",
        text: `◈ ${moveStr} — Тратит время на краю доски, забираем центр.`
      };
    }

    return null;
  }

  return {
    explainMove,
    roastOpponentMove
  };
})();