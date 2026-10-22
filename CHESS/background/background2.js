console.log("[ChessCoach background2.js] Загружены 11 профилей чемпионов и расширенная книга гамбитов!");

if (typeof GM_STYLES !== "undefined") {
  // 🧠 AlphaZero: тотальный контроль пространства, мощь двух слонов, зажим и глубокие позиционные жертвы
  GM_STYLES.alphazero = {
    tropism: 2.35,
    safety: 1.65,
    space: 2.25,
    bishopBonus: 55,
    sacrificeBoost: 245,
    squeeze: 2.35,
    checkBonus: 32,
    structure: 1.75
  };

  // 🎭 Пол Морфи: молниеносная мобилизация, вскрытие линий и охота на нерокированного короля
  GM_STYLES.morphy = {
    tropism: 3.30,
    safety: 1.25,
    space: 2.05,
    bishopBonus: 42,
    sacrificeBoost: 320,
    squeeze: 0.9,
    checkBonus: 65,
    structure: 1.05
  };

  // 🚀 Хикару Накамура: король пульки и блица — темповые тычки, шахи, ловушки и максимальная динамика
  GM_STYLES.hikaru = {
    tropism: 2.65,
    safety: 1.75,
    space: 1.85,
    bishopBonus: 30,
    sacrificeBoost: 210,
    squeeze: 1.65,
    checkBonus: 52,
    structure: 1.35
  };

  // 🏛 Михаил Ботвинник: железная стратегическая логика, монолитный пешечный центр и безошибочный расчет
  GM_STYLES.botvinnik = {
    tropism: 1.25,
    safety: 2.35,
    space: 1.60,
    bishopBonus: 28,
    sacrificeBoost: 60,
    squeeze: 2.20,
    checkBonus: 15,
    structure: 2.15
  };
}

if (typeof OPENING_BOOK !== "undefined") {
  Object.assign(OPENING_BOOK, {
    // Гамбит Урусова (1. e4 e5 2. Bc4 Nf6 3. d4!)
    "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w": [
      { from: "d2", to: "d4", name: "🔥 Гамбит Урусова (3. d4!) — взрывной штурм центра!", bonus: 112, aggressive: true },
      { from: "d2", to: "d3", name: "Спокойный дебют слона (3. d3)", bonus: 92 }
    ],
    // Гамбит Кохрена (1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nxf7?!)
    "rnbqkb1r/ppp2ppp/3p1n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w": [
      { from: "e5", to: "f7", name: "💣 Гамбит Кохрена (4. Nxf7?!) — дерзкая жертва коня ради атаки на короля!", bonus: 118, aggressive: true },
      { from: "e5", to: "f3", name: "Классический отход коня (4. Nf3)", bonus: 96 }
    ],
    // Опровержение Латышского гамбита
    "rnbqkbnr/pppp2pp/8/4pp2/4P3/5N2/PPPP1PPP/RNBQKB1R w": [
      { from: "f3", to: "e5", name: "⚡ Опровержение Латышского гамбита (3. Nxe5!)", bonus: 145, aggressive: true }
    ]
  });
}