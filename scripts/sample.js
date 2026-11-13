/**
 * ЭТАЛОННЫЙ ДЕМО-СКРИПТ CHESSCOACH SDK v2.0 (scripts/sample.js)
 * При включении во вкладке «📜 СКРИПТЫ» открывает второе окно настроек на сайте
 * с тумблером «Ожидаемый результат», выбором цвета, биндом клавиши и 60 FPS подсветкой хода.
 */
(function () {
  if (!window.CC) return;

  let bannerEnabled = false;
  let pulseBoardEnabled = true;
  let accentColor = "#00f5d4";
  let pulsePhase = 0;

  window.CC.registerScript({
    id: "sample_expected_result",
    name: "✨ Sample Script: Ожидаемый результат (SDK v2.0)",
    version: "2.0.0",
    author: "ChessCoach Community",
    description: "Открывает на сайте второе окно настроек с тумблером «Ожидаемый результат», выбором цвета и 60 FPS эффектом на доске.",

    onEnable(api) {
      // 1. Создаем независимое перетаскиваемое окно настроек скрипта
      const win = api.createWindow({
        id: "cc-sample-script-window",
        title: "✨ SAMPLE.JS // МЕНЮ СКРИПТА",
        x: 28,
        y: 90,
        width: 345
      });

      // 2. Создаем вкладки внутри окна скрипта
      const tabs = api.ui.createTabs(win.body, ["⚡ Главная", "🎨 Визуал 60 FPS"]);

      // Вкладка 1: Тумблер «Ожидаемый результат» и горячая клавиша
      api.ui.addNote(tabs["⚡ Главная"], {
        text: "Перетащите это окно за шапку в любое удобное место. При выключении скрипта окно и эффекты удаляются автоматически."
      });

      const updateBanner = () => {
        if (bannerEnabled) {
          api.audio.playTone(987.77, 130, "triangle");
          api.osd.showBanner({
            id: "cc-sample-result-banner",
            text: "✨ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ ✨",
            subtext: "Скрипт scripts/sample.js успешно отработал через ChessCoach SDK v2.0!",
            accentColor: accentColor,
            position: "top-center"
          });
        } else {
          api.osd.hideBanner("cc-sample-result-banner");
        }
      };

      const toggleEl = api.ui.addToggle(tabs["⚡ Главная"], {
        label: "🔥 Вывести «Ожидаемый результат»",
        value: bannerEnabled,
        onChange(val) {
          bannerEnabled = val;
          updateBanner();
        }
      });

      api.ui.addKeybind(tabs["⚡ Главная"], {
        label: "⌨️ Бинд переключения баннера",
        defaultKey: "KeyB",
        onTrigger() {
          bannerEnabled = !bannerEnabled;
          toggleEl.checked = bannerEnabled;
          updateBanner();
        }
      });

      // Вкладка 2: Настройки цвета и 60 FPS Canvas-эффекта на доске
      api.ui.addColorPicker(tabs["🎨 Визуал 60 FPS"], {
        label: "🎨 Неоновый цвет эффекта",
        value: accentColor,
        onChange(newColor) {
          accentColor = newColor;
          if (bannerEnabled) updateBanner();
        }
      });

      api.ui.addToggle(tabs["🎨 Визуал 60 FPS"], {
        label: "🌌 60 FPS Пульс последнего хода на доске",
        value: pulseBoardEnabled,
        onChange(val) {
          pulseBoardEnabled = val;
        }
      });
    },

    // 3. Плавная 60 FPS отрисовка на встроенном Canvas доски (800x800)
    onFrame(api, ctx, dt, state) {
      if (!pulseBoardEnabled || !state.lastMoveTo) return;

      pulsePhase += dt * 4.2;
      const pt = api.board.sqToXY(state.lastMoveTo);
      const radius = 28 + Math.sin(pulsePhase) * 10;

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    },

    onDisable(api) {
      // Все окна, баннеры, таймеры и 60 FPS слои очищаются ядром автоматически
      bannerEnabled = false;
    }
  });
})();