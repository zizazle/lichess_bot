window.ChessOpenings = {
  database: [
    // --- НАДЕЖНЫЕ КЛАССИЧЕСКИЕ ДЕБЮТЫ (ПРИОРИТЕТ ДЛЯ 2000+ ELO И АВТО-ПРЕМУВОВ) ---
    {
      id: "italian",
      name: "Итальянская партия",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5",
      plan: "Контролируем центр, прицеливаемся к f7 и готовим продвижение c3 + d4."
    },
    {
      id: "spanish",
      name: "Испанская партия (Руи Лопес)",
      moves: "e2e4 e7e5 g1f3 b8c6 f1b5",
      plan: "Давим на коня c6, быстро рокируемся и готовим захват центра."
    },
    {
      id: "scotch",
      name: "Шотландская партия",
      moves: "e2e4 e7e5 g1f3 b8c6 d2d4",
      plan: "Сразу вскрываем центр и открываем линии для слонов и ферзя."
    },
    {
      id: "petrov",
      name: "Русская партия (Защита Петрова)",
      moves: "e2e4 e7e5 g1f3 g8f6",
      plan: "Контратака на пешку e4 и крепкая симметричная борьба за центр."
    },
    {
      id: "vienna",
      name: "Венская партия",
      moves: "e2e4 e7e5 b1c3",
      plan: "Укрепляем e4 и готовим активный подрыв на королевском фланге."
    },
    {
      id: "sicilian",
      name: "Сицилианская защита",
      moves: "e2e4 c7c5",
      plan: "Острая борьба: черные контролируют поле d4 и готовят контригру по линии «c»."
    },
    {
      id: "sicilian_najdorf",
      name: "Сицилианская: Вариант Найдорфа",
      moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6",
      plan: "Отнимаем поле b5 и готовим встречный удар e7-e5 или b7-b5."
    },
    {
      id: "sicilian_dragon",
      name: "Сицилианская: Вариант Дракона",
      moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6",
      plan: "Слон черных с g7 простреливает большую диагональ, игра идет на встречных курсах."
    },
    {
      id: "sicilian_alapin",
      name: "Сицилианская: Вариант Алапина",
      moves: "e2e4 c7c5 c2c3",
      plan: "Белые строят мощный пешечный центр d2-d4, черные контратакуют через d5 или Nf6."
    },
    {
      id: "caro_kann",
      name: "Защита Каро-Канн",
      moves: "e2e4 c7c6 d2d4 d7d5",
      plan: "Надежный пешечный треугольник черных и свободный выход белопольного слона c8."
    },
    {
      id: "french",
      name: "Французская защита",
      moves: "e2e4 e7e6 d2d4 d7d5",
      plan: "Крепкая цепь черных с обязательным подрывом центра ходом c7-c5."
    },
    {
      id: "scandinavian",
      name: "Скандинавская защита",
      moves: "e2e4 d7d5 e4d5",
      plan: "Немедленный размен центральной пешки e4 и быстрое развитие фигур."
    },
    {
      id: "queens_gambit",
      name: "Ферзевый гамбит",
      moves: "d2d4 d7d5 c2c4",
      plan: "Подрыв пешки d5, захват центра и давление по вертикали «c»."
    },
    {
      id: "london",
      name: "Лондонская система",
      moves: "d2d4 d7d5 g1f3 g8f6 c1f4",
      plan: "Крепкая пирамида пешек d4-c3-e3, слон на f4 и посадка коня на форпост e5."
    },
    {
      id: "kings_indian",
      name: "Староиндийская защита",
      moves: "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7",
      plan: "Фианкетто слона на g7, прорыв e7-e5 и атака на королевском фланге."
    },
    {
      id: "grunfeld",
      name: "Защита Грюнфельда",
      moves: "d2d4 g8f6 c2c4 g7g6 b1c3 d7d5",
      plan: "Прямой фигурный подрыв белого центра слоном с g7 и ходом c7-c5."
    },
    {
      id: "nimzo_indian",
      name: "Защита Нимцовича",
      moves: "d2d4 g8f6 c2c4 e7e6 b1c3 f8b4",
      plan: "Связка коня c3 и борьба за ключевое центральное поле e4."
    },
    {
      id: "dutch",
      name: "Голландская защита",
      moves: "d2d4 f7f5",
      plan: "Жесткий зажим поля e4 и подготовка атаки на королевском фланге."
    },
    {
      id: "english",
      name: "Английское начало",
      moves: "c2c4",
      plan: "Гибкий контроль центра с фланга и давление на пункт d5."
    },
    {
      id: "evans",
      name: "🔥 Гамбит Эванса",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4",
      plan: "Жертвуем пешку b4 ради мгновенного захвата центра ходами c3 и d4."
    },
    {
      id: "fried_liver",
      name: "⚔ Атака Фегателло (Fried Liver)",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5",
      plan: "Прямой удар конем и слоном по пункту f7. Давим на короля в центре."
    },
    {
      id: "morra",
      name: "⚡ Гамбит Морра",
      moves: "e2e4 c7c5 d2d4 c5d4 c2c3",
      plan: "Жертва пешки в Сицилианской за быстрое развитие фигур и открытые линии «c» и «d»."
    },
    {
      id: "kings_gambit",
      name: "👑 Королевский гамбит",
      moves: "e2e4 e7e5 f2f4",
      plan: "Вскрываем вертикаль «f» для ладьи и захватываем центр пешкой d4."
    },
    {
      id: "danish",
      name: "⚔ Северный (Датский) гамбит",
      moves: "e2e4 e7e5 d2d4 e5d4 c2c3",
      plan: "Отдаем пешки ради двух слонов-снайперов на c4 и b2, простреливающих королевский фланг."
    },
    {
      id: "budapest",
      name: "⚡ Будапештский гамбит",
      moves: "d2d4 g8f6 c2c4 e7e5",
      plan: "Черные жертвуют центральную пешку ради темповой фигурной атаки."
    },
    {
      id: "albin",
      name: "⚡ Контргамбит Альбина",
      moves: "d2d4 d7d5 c2c4 e7e5",
      plan: "Подрыв центра белых с идеей задвинуть пешку на d4 и стеснить их развитие."
    },

    // --- ВИРУСНЫЕ И ОСТРЫЕ ЛОВУШЕЧНЫЕ ГАМБИТЫ (ПОМЕЧЕНЫ DUBIOUS: TRUE — ТОЛЬКО ПРИ РУЧНОМ ВЫБОРЕ) ---
    {
      id: "alien",
      dubious: true,
      name: "👽 Инопланетный гамбит (Alien Gambit)",
      moves: "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4g5 h7h6 g5f7",
      plan: "Дерзкая жертва коня на f7! Лишаем черного короля рокировки, выманиваем его в центр и атакуем всеми фигурами (Bc4, Qh5, Nf3)."
    },
    {
      id: "alien_prep",
      dubious: true,
      name: "👽 Подготовка Инопланетного гамбита",
      moves: "e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4g5",
      plan: "Провоцируем ход h7-h6, чтобы взорвать позицию жертвой коня Nxf7! Если черные играют e6 — выводим слона на c4 и ферзя на e2."
    },
    {
      id: "halloween",
      dubious: true,
      name: "🎃 Гамбит Хэллоуин (Halloween Gambit)",
      moves: "e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f3e5",
      plan: "Шокирующая жертва целого коня за пешку! Толкаем d2-d4 и e4-e5, прогоняя обоих коней черных на начальные поля."
    },
    {
      id: "scandi_icbm",
      dubious: true,
      name: "🚀 Гамбит Теннисона (ICBM Ракета)",
      moves: "e2e4 d7d5 g1f3 d5e4 f3g5",
      plan: "Атакуем пешку e4: после Nf6 d3 exd3 Bxd3 готовим ловушку Bg6 с выигрышем черного ферзя на d8!"
    },
    {
      id: "tennison_nf3",
      dubious: true,
      name: "🚀 Гамбит Теннисона (через 1. Nf3)",
      moves: "g1f3 d7d5 e2e4",
      plan: "Жертвуем пешку ради стремительного захвата полей g5 и c4 с прицелом на пункт f7."
    },
    {
      id: "nakhmanson",
      dubious: true,
      name: "💥 Гамбит Нахмансона",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4 e1g1 f6e4 b1c3",
      plan: "Тотальная тактическая мясорубка: отдаем еще и коня на c3 ради сокрушительного вскрытия линии «e» против короля черных!"
    },
    {
      id: "stafford",
      dubious: true,
      name: "⚡ Гамбит Стаффорда",
      moves: "e2e4 e7e5 g1f3 g8f6 f3e5 b8c6",
      plan: "Ловушка за черных: после Nxc6 dxc6 мгновенно выводим слона на c5, ферзя на d4 и коня на g4 с матовыми угрозами."
    },
    {
      id: "traxler",
      dubious: true,
      name: "🔥 Контратака Тракслера",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 f8c5",
      plan: "Игнорируем удар на f7 и сами жертвуем слона Bxf2+, затаскивая белого короля под матовую атаку ферзем и конем!"
    },
    {
      id: "englund",
      dubious: true,
      name: "💣 Гамбит Энглунда",
      moves: "d2d4 e7e5",
      plan: "Взрывной ответ против 1. d4: жертвуем пешку, чтобы перехватить инициативу ферзем на e7 и слоном на b4."
    },
    {
      id: "blackburne",
      dubious: true,
      name: "🪤 Гамбит Блэкберна-Шиллинга",
      moves: "e2e4 e7e5 g1f3 b8c6 f1c4 c6d4",
      plan: "Хитрая ловушка: если белые жадно бьют Nxe5, следует Qg5! с двойным ударом на g2 и коня."
    }
  ],

  // ИСПРАВЛЕНО ПО АУДИТУ (п. 2.2): Точное определение текущего дебюта без ложного показа мемных гамбитов на 1-м ходу
  detect(uciMoveList) {
    if (!Array.isArray(uciMoveList) || uciMoveList.length === 0) {
      return {
        name: "Начало партии",
        plan: "Занимай центр пешками e4 или d4, выводи легкие фигуры и готовь рокировку.",
        inBook: true
      };
    }

    const historyStr = uciMoveList.join(" ");
    let bestPrefixMatch = null;
    let minRemainingLen = Infinity;
    let bestPastMatch = null;
    let maxPastLen = 0;

    for (const item of this.database) {
      if (item.moves === historyStr || item.moves.startsWith(historyStr + " ")) {
        const remaining = item.moves.length - historyStr.length;
        if (remaining < minRemainingLen) {
          minRemainingLen = remaining;
          bestPrefixMatch = item;
        }
      } else if (historyStr.startsWith(item.moves + " ") && item.moves.length > maxPastLen) {
        maxPastLen = item.moves.length;
        bestPastMatch = item;
      }
    }

    if (bestPrefixMatch) {
      return {
        name: bestPrefixMatch.name,
        plan: bestPrefixMatch.plan,
        inBook: true
      };
    }
    if (bestPastMatch) {
      return {
        name: bestPastMatch.name,
        plan: bestPastMatch.plan,
        inBook: false
      };
    }

    return {
      name: "Миттельшпиль • Активная фаза",
      plan: "Ищи шахи, взятия и двойные удары. Ставь ладьи на открытые линии.",
      inBook: false
    };
  }
};