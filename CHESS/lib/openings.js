window.ChessOpenings = {
  database: [
    // --- ВИРУСНЫЕ И АГРЕССИВНЫЕ ГАМБИТЫ ---
    {
      id: "alien",
      name: "👽 Инопланетный гамбит (Alien Gambit)",
      moves: "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4g5 h7h6 g5f7 e8f7 g1f3",
      plan: "Дерзкая жертва коня на f7! Лишаем черного короля рокировки, выманиваем его в центр и атакуем всеми фигурами (Bc4, Ne5+, Qf3)."
    },
    {
      id: "alien",
      name: "👽 Подготовка Инопланетного гамбита",
      moves: "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4g5 e7e6 f1c4",
      plan: "Провоцируем ход h7-h6 для жертвы Nxf7! Если черные играют e6 — выводим слона на c4, коня на f3 и ферзя на e2."
    },
    {
      id: "halloween",
      name: "🎃 Гамбит Хэллоуин (Halloween Gambit)",
      moves: "e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f3e5 c6e5 d2d4 e5g6 e4e5",
      plan: "Шокирующая жертва целого коня за пешку! Толкаем d2-d4 и e4-e5, прогоняя обоих коней черных на начальные поля."
    },
    {
      id: "scandi_icbm",
      name: "🚀 Гамбит Теннисона (ICBM Ракета)",
      moves: "e2e4 d7d5 g1f3 d5e4 f3g5 g8f6 d2d3 e4d3 f1d3 h7h6 g5f7",
      plan: "Атакуем пешку e4: после Nf6 d3 exd3 Bxd3 провоцируем h6 и взрываем пункт f7 с выигрышем черного ферзя на d8!"
    },
    {
      id: "scandi_icbm",
      name: "🚀 Гамбит Теннисона (через 1. Nf3)",
      moves: "g1f3 d7d5 e2e4 d5e4 f3g5 g8f6 d2d3",
      plan: "Жертвуем пешку ради стремительного захвата полей g5 и c4 с прицелом на пункт f7."
    },
    {
      id: "italian",
      name: "💥 Гамбит Нахмансона",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4 e1g1 f6e4 b1c3 d4c3 f1e1",
      plan: "Тотальная тактическая мясорубка: отдаем коня на c3 ради сокрушительного вскрытия линии «e» против короля черных!"
    },
    {
      id: "stafford",
      name: "⚡ Гамбит Стаффорда",
      moves: "e2e4 e7e5 g1f3 g8f6 f3e5 b8c6 e5c6 d7c6 d2d3 f8c5",
      plan: "Ловушка за черных: после Nxc6 dxc6 мгновенно выводим слона на c5, коня на g4 и ферзя на h4 с матовыми угрозами."
    },
    {
      id: "stafford",
      name: "⚡ Гамбит Стаффорда (через e4-e5)",
      moves: "e2e4 e7e5 g1f3 g8f6 f3e5 b8c6 e5c6 d7c6 e4e5 f6e4",
      plan: "Контратакуем в центре конем на e4 и выводим слона на c5 с давлением на f2."
    },
    {
      id: "traxler",
      name: "🔥 Контратака Тракслера",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 f8c5 g5f7 c5f2",
      plan: "Игнорируем удар на f7 и сами жертвуем слона Bxf2+, затаскивая белого короля под матовую атаку ферзем и конем!"
    },
    {
      id: "italian",
      name: "⚔ Атака Фегателло (Fried Liver)",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 f6d5 g5f7",
      plan: "Прямой удар конем и слоном по пункту f7. Давим на короля в центре."
    },
    {
      id: "italian",
      name: "⚔ Защита двух коней (Вариант Полерио)",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 c6a5 c4b5 c7c6",
      plan: "Острая тактическая борьба с подрывом пешки d5 и активной фигурной игрой."
    },
    {
      id: "queens",
      name: "💣 Гамбит Энглунда",
      moves: "d2d4 e7e5 d4e5 b8c6 g1f3 d8e7",
      plan: "Взрывной ответ против 1. d4: жертвуем пешку, чтобы перехватить инициативу ферзем на e7 и слоном на b4."
    },
    {
      id: "italian",
      name: "🪤 Гамбит Блэкберна-Шиллинга",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 c6d4 f3e5 d8g5",
      plan: "Хитрая ловушка: если белые жадно бьют Nxe5, следует Qg5! с двойным ударом на g2 и коня."
    },
    {
      id: "italian",
      name: "🔥 Гамбит Эванса",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4",
      plan: "Жертвуем пешку b4 ради мгновенного захвата центра ходами c3 и d4."
    },
    {
      id: "kings",
      name: "⚔ Северный (Датский) гамбит",
      moves: "e2e4 e7e5 d2d4 e5d4 c2c3 d4c3 f1c4 c3b2 c1b2",
      plan: "Отдаем пешки ради двух слонов-снайперов на c4 и b2, простреливающих королевский фланг."
    },
    {
      id: "kings",
      name: "👑 Королевский гамбит",
      moves: "e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 f1c4",
      plan: "Вскрываем вертикаль «f» для ладьи и захватываем центр пешкой d4."
    },
    {
      id: "sicilian",
      name: "⚡ Гамбит Морра",
      moves: "e2e4 c7c5 d2d4 c5d4 c2c3 d4c3 b1c3 b8c6 g1f3",
      plan: "Жертва пешки в Сицилианской за быстрое развитие фигур и открытые линии «c» и «d»."
    },
    {
      id: "queens",
      name: "⚡ Будапештский гамбит",
      moves: "d2d4 g8f6 c2c4 e7e5 d4e5 f6g4",
      plan: "Черные жертвуют центральную пешку ради темповой фигурной атаки."
    },
    {
      id: "queens",
      name: "⚡ Контргамбит Альбина",
      moves: "d2d4 d7d5 c2c4 e7e5 d4e5 d5d4",
      plan: "Подрыв центра белых с идеей задвинуть пешку на d4 и стеснить их развитие."
    },

    // --- КЛАССИЧЕСКИЕ ДЕБЮТЫ ---
    {
      id: "italian",
      name: "Итальянская партия (Giuoco Piano)",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4",
      plan: "Контролируем центр, прицеливаемся к f7 и проводим прорыв c3 + d4."
    },
    {
      id: "ruy_lopez",
      name: "Испанская партия (Руи Лопес)",
      moves: "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1",
      plan: "Давим на коня c6, быстро рокируемся и готовим захват центра."
    },
    {
      id: "scotch",
      name: "Шотландская партия",
      moves: "e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6 f1d3",
      plan: "Сразу вскрываем центр и открываем линии для слонов и ферзя."
    },
    {
      id: "kings",
      name: "Венская партия",
      moves: "e2e4 e7e5 b1c3 g8f6 f2f4 d7d5 f4e5",
      plan: "Укрепляем e4 и готовим накат пешкой f2-f4."
    },
    {
      id: "stafford",
      name: "Русская партия (Петров)",
      moves: "e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4",
      plan: "Контратака на пешку e4 и крепкая симметричная борьба за центр."
    },
    {
      id: "sicilian",
      name: "Сицилианская защита (Открытая)",
      moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3",
      plan: "Острая борьба: черные контролируют d4 и готовят контригру на ферзевом фланге."
    },
    {
      id: "sicilian",
      name: "Сицилианская: Вариант Найдорфа",
      moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e3 e7e5",
      plan: "Отнимаем поле b5 и готовим встречный удар e7-e5 или b7-b5."
    },
    {
      id: "sicilian",
      name: "Сицилианская: Вариант Дракона",
      moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e3 f8g7",
      plan: "Слон черных с g7 простреливает всю диагональ, игра идет на встречных курсах."
    },
    {
      id: "sicilian",
      name: "Сицилианская: Вариант Алапина",
      moves: "e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4 c5d4 c3d4",
      plan: "Белые хотят построить мощный центр d2-d4, черные контратакуют через d5 или Nf6."
    },
    {
      id: "french",
      name: "Французская защита",
      moves: "e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 e4e5 f6d7 f2f4 c7c5",
      plan: "Крепкая цепь черных с обязательным подрывом центра ходом c7-c5."
    },
    {
      id: "caro",
      name: "Защита Каро-Канн (Классическая)",
      moves: "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6",
      plan: "Надежный пешечный треугольник черных и свободный выход слона c8."
    },
    {
      id: "caro",
      name: "Защита Каро-Канн (Закрытый вариант)",
      moves: "e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 c6c5",
      plan: "Выводим слона на f5 до хода e6 и подрываем цепь белых ходом c6-c5."
    },
    {
      id: "scandi_icbm",
      name: "Скандинавская защита",
      moves: "e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3",
      plan: "Немедленный размен центральной пешки e4 и быстрое развитие фигур."
    },
    {
      id: "queens",
      name: "Ферзевый гамбит",
      moves: "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8",
      plan: "Подрыв пешки d5, захват центра и давление по вертикали «c»."
    },
    {
      id: "london",
      name: "Лондонская система",
      moves: "d2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3 c7c5 c2c3 b8c6 b1d2",
      plan: "Крепкая пирамида пешек d4-c3-e3, слон на f4 и посадка коня на e5."
    },
    {
      id: "london",
      name: "Лондонская система (против g6)",
      moves: "d2d4 g8f6 g1f3 g7g6 c1f4 f8g7 e2e3 d7d6 h2h3 e8g8",
      plan: "Укрепляем слона f4 ходом h2-h3 и контролируем центр."
    },
    {
      id: "queens",
      name: "Староиндийская защита",
      moves: "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5",
      plan: "Фианкетто слона на g7, прорыв e7-e5 и атака на королевском фланге."
    },
    {
      id: "queens",
      name: "Защита Грюнфельда",
      moves: "d2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3",
      plan: "Прямой фигурный подрыв белого центра слоном с g7 и ходом c7-c5."
    },
    {
      id: "queens",
      name: "Защита Нимцовича",
      moves: "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5",
      plan: "Связка коня c3 и борьба за ключевое центральное поле e4."
    },
    {
      id: "queens",
      name: "Голландская защита",
      moves: "d2d4 f7f5 g2g3 g8f6 f1g2 e7e6 g1f3 f8e7 e1g1 e8g8",
      plan: "Жесткий зажим поля e4 и подготовка атаки на королевском фланге."
    },
    {
      id: "queens",
      name: "Английское начало",
      moves: "c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5",
      plan: "Гибкий контроль центра с фланга и давление на пункт d5."
    }
  ],

  detect(uciMoveList) {
    if (!Array.isArray(uciMoveList) || uciMoveList.length === 0) {
      return {
        name: "Начало партии",
        plan: "Занимай центр пешками e4 или d4, выводи легкие фигуры и готовь рокировку.",
        inBook: true
      };
    }

    const historyStr = uciMoveList.join(" ");
    let bestMatch = null;
    let bestLen = 0;
    let exactPrefixFound = false;

    for (const item of this.database) {
      if (item.moves.startsWith(historyStr)) {
        exactPrefixFound = true;
        if (!bestMatch || item.moves.length > bestLen) {
          bestMatch = item;
          bestLen = item.moves.length;
        }
      } else if (historyStr.startsWith(item.moves) && item.moves.length >= bestLen) {
        bestMatch = item;
        bestLen = item.moves.length;
      }
    }

    if (bestMatch) {
      return {
        name: bestMatch.name,
        plan: bestMatch.plan,
        inBook: exactPrefixFound
      };
    }

    return {
      name: "Миттельшпиль • Вне книги",
      plan: "Ищи шахи, взятия и двойные удары. Ставь ладьи на открытые линии.",
      inBook: false
    };
  },

  /**
   * Вычисляет кандидатов для дебютного премува и проверяет, не свернул ли соперник с теории.
   * Возвращает { inBook, deviated, openingName, plan, candidates: [{ oppUci, ourUci, ourFrom, ourTo, name }] }
   */
  getBookPremoveData(uciMoveList, myColor, repertoireFilter = "auto") {
    const list = Array.isArray(uciMoveList) ? uciMoveList : [];
    const ply = list.length;

    // Дебютные премувы действуют в пределах первых 14 полуходов (7 полных ходов)
    if (ply > 14) {
      return { inBook: false, deviated: false, openingName: null, candidates: [] };
    }

    const pool = repertoireFilter && repertoireFilter !== "auto"
      ? this.database.filter((item) => item.id === repertoireFilter)
      : this.database;

    const activePool = pool.length > 0 ? pool : this.database;
    const historyStr = list.join(" ");

    // Проверка, находимся ли мы прямо сейчас в пределах дебютной ветки
    const matchingLines = activePool.filter((item) => {
      if (ply === 0) return true;
      return item.moves === historyStr || item.moves.startsWith(historyStr + " ");
    });

    if (matchingLines.length === 0) {
      return {
        inBook: false,
        deviated: ply > 0,
        openingName: null,
        candidates: []
      };
    }

    const primaryLine = matchingLines[0];
    const candidatesMap = new Map();

    // Если сейчас ход соперника, собираем все теоретические ответы врага (oppUci) и наш следующий ход по книге (ourUci)
    const isMyTurnNow = (ply % 2 === 0 && myColor === "w") || (ply % 2 === 1 && myColor === "b");

    if (!isMyTurnNow) {
      for (const item of matchingLines) {
        const parts = item.moves.split(" ");
        const oppUci = parts[ply];
        const ourUci = parts[ply + 1];
        if (oppUci && ourUci && ourUci.length >= 4) {
          const key = `${oppUci}_${ourUci}`;
          if (!candidatesMap.has(key)) {
            candidatesMap.set(key, {
              oppUci,
              ourUci,
              ourFrom: ourUci.slice(0, 2),
              ourTo: ourUci.slice(2, 4),
              openingName: item.name
            });
          }
        }
      }
    } else {
      // Если сейчас наш ход — возвращаем прямой книжный ход для мгновенного исполнения
      for (const item of matchingLines) {
        const parts = item.moves.split(" ");
        const ourUci = parts[ply];
        if (ourUci && ourUci.length >= 4) {
          const key = `direct_${ourUci}`;
          if (!candidatesMap.has(key)) {
            candidatesMap.set(key, {
              oppUci: null,
              ourUci,
              ourFrom: ourUci.slice(0, 2),
              ourTo: ourUci.slice(2, 4),
              openingName: item.name
            });
          }
        }
      }
    }

    const candidates = Array.from(candidatesMap.values());
    return {
      inBook: candidates.length > 0,
      deviated: false,
      openingName: primaryLine.name,
      plan: primaryLine.plan,
      candidates
    };
  }
};