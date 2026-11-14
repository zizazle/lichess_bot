(function () {
  "use strict";

  const PROFILES = Object.freeze([
    { id: "custom", label: "Свой профиль", nickname: "", elo: 1500, title: "", countryCode: "", avatarUrl: "" },
    { id: "anonymous", label: "Анонимный стример", nickname: "HiddenKnight", elo: 2400, title: "GM", countryCode: "", avatarUrl: "" },
    { id: "legend9999", label: "GM 9999 (максимум)", nickname: "Grandmaster9999", elo: 9999, title: "GM", countryCode: "", avatarUrl: "" },
    { id: "carlsen", label: "Магнус Карлсен", account: "magnuscarlsen", nickname: "MagnusCarlsen", elo: 2882, title: "GM", countryCode: "NO", avatarPath: "assets/profiles/magnus.jpg", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/3889224.121e2094.200x200o.361c2f8a59c2.jpg" },
    { id: "nakamura", label: "Хикару Накамура", account: "hikaru", nickname: "Hikaru", elo: 2802, title: "GM", countryCode: "US", avatarPath: "assets/profiles/hikaru.jpg", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/15448422.88c010c1.200x200o.3c5619f5441e.png" },
    { id: "caruana", label: "Фабиано Каруана", account: "fabianocaruana", nickname: "FabianoCaruana", elo: 2805, title: "GM", countryCode: "US", avatarPath: "assets/profiles/caruana.png", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/11177810.9dfc8d31.200x200o.9a9eccebc07c.png" },
    { id: "firouzja", label: "Алиреза Фирузджа", account: "firouzja2003", nickname: "Firouzja2003", elo: 2785, title: "GM", countryCode: "FR", avatarPath: "assets/profiles/firouzja.jpg", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/42022994.2c7a0722.200x200o.3088f5180d8d.jpg" },
    { id: "nepo", label: "Ян Непомнящий", account: "lachesisq", nickname: "lachesisQ", elo: 2795, title: "GM", countryCode: "RU", avatarPath: "assets/profiles/nepo.jpg", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/28417564.7097ffa7.200x200o.4f19f2979718.jpg" },
    { id: "gukesh", label: "Гукеш Доммараджу", account: "gukeshdommaraju", nickname: "GukeshDommaraju", elo: 2783, title: "GM", countryCode: "IN", avatarPath: "assets/profiles/gukesh.jpeg", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/40996222.a634fe54.200x200o.391c8e0a4b0b.jpeg" },
    { id: "polgar", label: "Юдит Полгар", account: "juditpolgar", nickname: "JuditPolgar", elo: 2735, title: "GM", countryCode: "HU", avatarPath: "assets/profiles/polgar.jpeg", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/3889226.ca24d690.200x200o.9730c4e49a94.jpeg" },
    { id: "juwenjun", label: "Цзюй Вэньцзюнь", account: "juwenjun", nickname: "JuWenjun", elo: 2568, title: "GM", countryCode: "CN", avatarPath: "assets/profiles/juwenjun.jpeg", avatarUrl: "https://images.chesscomfiles.com/uploads/v1/user/11187714.1e0f4f10.200x200o.f9364d873fb3.jpeg" }
  ]);

  const STYLES = Object.freeze([
    { id: "broadcast", label: "Broadcast Neon" },
    { id: "royal", label: "Royal Grandmaster" },
    { id: "chesscom", label: "Chess.com Original" }
  ]);

  const CONTAINER_SELECTOR = [
    ".board-layout-top", ".board-layout-bottom",
    ".player-top", ".player-bottom",
    ".player-tagline-top", ".player-tagline-bottom",
    ".game-player-top", ".game-player-bottom",
    ".player-component", ".player-tagline",
    "[data-cy='player-top']", "[data-cy='player-bottom']",
    "[data-test-element='player-top']", "[data-test-element='player-bottom']",
    "[data-test-element*='player-row']",
    ".player-row-container", ".player-row-component",
    "[class*='playerinfo-top']", "[class*='playerinfo-bottom']",
    "wc-game-player", "wc-player-card", "chess-player-card"
  ].join(",");

  const USERNAME_SELECTOR = [
    "[data-test-element='user-tagline-username']",
    "[data-test-element$='username']",
    "[data-cy*='username']",
    ".user-username-component", ".user-tagline-username",
    ".player-username", ".username", ".cc-user-username-white",
    "a[href*='/member/']"
  ].join(",");

  const RATING_SELECTOR = [
    "[data-test-element='user-rating']",
    "[data-cy='user-tagline-rating']",
    ".user-tagline-rating", ".player-rating", ".cc-user-rating-white"
  ].join(",");

  const TITLE_SELECTOR = [
    ".user-chess-title", ".user-tagline-title", ".player-title",
    "[data-test-element*='title']", "[class*='chess-title']"
  ].join(",");

  const AVATAR_SELECTOR = [
    "[data-test-element*='avatar'] img", "[data-cy*='avatar'] img",
    "img[class*='avatar']", "[class*='user-avatar']", "[class*='player-avatar']",
    ".avatar-component img", ".user-image img"
  ].join(",");

  const FLAG_SELECTOR = [
    "[data-test-element*='country']", "[data-cy*='country']",
    ".country-flags-component", ".country-flag", ".user-country-flag",
    "[class*='country-flag']", "[class*='country-flags']"
  ].join(",");

  const FLAIR_SELECTOR = [
    "img[class*='flair']", "[class*='user-flair']", "[data-test-element*='flair']"
  ].join(",");

  function clampElo(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(9999, parsed)) : 1500;
  }

  function sanitizeNickname(value, fallback = "Anonymous") {
    const normalized = String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
    return Array.from(normalized || fallback).slice(0, 32).join("");
  }

  function sanitizeTitle(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return ["GM", "IM", "FM", "CM", "WGM", "WIM", "WFM", "WCM"].includes(normalized) ? normalized : "";
  }

  function sanitizeCountryCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : "";
  }

  function sanitizeAvatarUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("data:image/")) return raw;
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" || url.protocol === "chrome-extension:") return url.href;
      if (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)) return url.href;
      return "";
    } catch (e) {
      return "";
    }
  }

  function countryCodeToEmoji(value) {
    const code = sanitizeCountryCode(value);
    return code ? String.fromCodePoint(...[...code].map(char => 127397 + char.charCodeAt(0))) : "♟";
  }

  function makeGeneratedAvatar(nickname) {
    const initials = Array.from(sanitizeNickname(nickname, "GM").replace(/[^\p{L}\p{N}]/gu, "")).slice(0, 2).join("").toUpperCase() || "GM";
    const escaped = initials.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5d9948"/><stop offset="1" stop-color="#2f5d31"/></linearGradient></defs><rect width="128" height="128" rx="64" fill="url(#g)"/><text x="64" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#fff">${escaped}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function makeFlagImage(countryCode) {
    const flag = countryCodeToEmoji(countryCode);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="44" viewBox="0 0 64 44"><rect width="64" height="44" rx="5" fill="#222"/><text x="32" y="33" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,sans-serif" font-size="34">${flag}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function normalizeConfig(raw) {
    const source = raw || {};
    const style = STYLES.some(entry => entry.id === source.style) ? source.style : "broadcast";
    return {
      enabled: Boolean(source.enabled),
      style,
      maskDetails: source.maskDetails !== false,
      maskPageTitle: source.maskPageTitle !== false,
      blockProfileHover: source.blockProfileHover !== false,
      my: {
        nickname: sanitizeNickname(source.my?.nickname, "HiddenKnight"),
        elo: clampElo(source.my?.elo),
        title: sanitizeTitle(source.my?.title),
        countryCode: sanitizeCountryCode(source.my?.countryCode),
        avatarUrl: sanitizeAvatarUrl(source.my?.avatarUrl)
      },
      opponent: {
        nickname: sanitizeNickname(source.opponent?.nickname, "SecretOpponent"),
        elo: clampElo(source.opponent?.elo),
        title: sanitizeTitle(source.opponent?.title),
        countryCode: sanitizeCountryCode(source.opponent?.countryCode),
        avatarUrl: sanitizeAvatarUrl(source.opponent?.avatarUrl)
      }
    };
  }

  function create({ getConfig = () => ({}), getBoardElement = () => null, onToggle = null, onStatus = null } = {}) {
    const records = new Map();
    const stylesByRoot = new Map();
    const generatedNodes = new Map();
    let observer = null;
    let intervalId = null;
    let syncTimer = null;
    let applying = false;
    let titleOriginal = document.title;
    let titleApplied = null;
    let cachedPlayers = null;
    let foundPlayers = 0;
    let revealed = false;

    function reportStatus(count) {
      if (foundPlayers === count) return;
      foundPlayers = count;
      if (typeof onStatus === "function") onStatus({ foundPlayers: count, active: count === 2 });
    }

    function collectRoots(root) {
      const roots = [root];
      for (let i = 0; i < roots.length; i++) {
        const current = roots[i];
        for (const node of [current, ...current.querySelectorAll("*")]) {
          if (node.shadowRoot && !roots.includes(node.shadowRoot)) roots.push(node.shadowRoot);
          if (node.tagName === "SLOT" && node.assignedElements) {
            for (const assigned of node.assignedElements({ flatten: true })) {
              if (!roots.includes(assigned)) roots.push(assigned);
            }
          }
        }
      }
      return roots;
    }

    function deepQueryAll(root, selector) {
      if (!root || !selector) return [];
      return Array.from(new Set(collectRoots(root).flatMap((entry, index) => [
        ...(index > 0 && entry.matches?.(selector) ? [entry] : []),
        ...entry.querySelectorAll(selector)
      ])));
    }

    function isVisible(node) {
      if (!node?.isConnected) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }

    function getSignature(node) {
      let value = "";
      for (let current = node; current; current = current.parentElement || current.getRootNode()?.host) {
        value += ` ${current.id || ""} ${current.className || ""} ${current.getAttribute?.("data-cy") || ""} ${current.getAttribute?.("data-test-element") || ""}`;
        if (value.length > 1000) break;
      }
      return value.toLowerCase();
    }

    function locatePlayers() {
      if (
        cachedPlayers?.top?.isConnected && cachedPlayers?.bottom?.isConnected &&
        isVisible(cachedPlayers.top) && isVisible(cachedPlayers.bottom)
      ) return cachedPlayers;
      cachedPlayers = null;

      let candidates = Array.from(document.querySelectorAll(CONTAINER_SELECTOR));
      if (candidates.length < 2) candidates = deepQueryAll(document, CONTAINER_SELECTOR);
      candidates = Array.from(new Set(candidates)).filter(isVisible);

      const board = getBoardElement?.() || Array.from(document.querySelectorAll("wc-chess-board,chess-board,.board"))
        .filter(isVisible)
        .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
      const boardRect = board?.getBoundingClientRect?.() || null;

      let top = candidates.find(node => /(?:^|[\s_-])top(?:$|[\s_-])|player-top/.test(getSignature(node))) || null;
      let bottom = candidates.find(node => /(?:^|[\s_-])bottom(?:$|[\s_-])|player-bottom/.test(getSignature(node))) || null;

      if ((!top || !bottom) && boardRect) {
        const rankedTop = candidates
          .filter(node => node !== bottom)
          .map(node => ({ node, distance: Math.abs(node.getBoundingClientRect().bottom - boardRect.top) }))
          .sort((a, b) => a.distance - b.distance);
        const rankedBottom = candidates
          .filter(node => node !== top)
          .map(node => ({ node, distance: Math.abs(node.getBoundingClientRect().top - boardRect.bottom) }))
          .sort((a, b) => a.distance - b.distance);
        top ||= rankedTop[0]?.node || null;
        bottom ||= rankedBottom.find(entry => entry.node !== top)?.node || null;
      }

      if (!top || !bottom) {
        const ordered = candidates.slice().sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        top ||= ordered[0] || null;
        bottom ||= ordered.find(node => node !== top) || null;
      }

      cachedPlayers = top && bottom ? { top, bottom } : null;
      return cachedPlayers;
    }

    function getRecord(node) {
      let record = records.get(node);
      if (!record) {
        record = {
          attributes: new Map(),
          styles: new Map(),
          classes: new Map(),
          touched: false
        };
        records.set(node, record);
      }
      record.touched = true;
      return record;
    }

    function setAttribute(node, name, value) {
      const record = getRecord(node);
      let entry = record.attributes.get(name);
      const current = node.getAttribute(name);
      if (!entry) {
        entry = { original: current, applied: null };
        record.attributes.set(name, entry);
      } else if (entry.applied !== null && current !== entry.applied) {
        entry.original = current;
      }
      if (current !== value) node.setAttribute(name, value);
      entry.applied = value;
    }

    function setStyles(node, styles) {
      const record = getRecord(node);
      for (const [property, value] of Object.entries(styles)) {
        let entry = record.styles.get(property);
        const isCustom = property.startsWith("--");
        const current = isCustom ? node.style.getPropertyValue(property) : node.style[property];
        if (!entry) {
          entry = { original: current, applied: null };
          record.styles.set(property, entry);
        } else if (entry.applied !== null && current !== entry.applied) {
          entry.original = current;
        }
        if (current !== value) {
          if (isCustom) node.style.setProperty(property, value);
          else node.style[property] = value;
        }
        entry.applied = isCustom ? node.style.getPropertyValue(property) : node.style[property];
      }
    }

    function addClass(node, className) {
      const record = getRecord(node);
      if (!record.classes.has(className)) record.classes.set(className, node.classList.contains(className));
      node.classList.add(className);
    }

    function ensureMaskStyle(node) {
      const root = node.getRootNode();
      if (stylesByRoot.get(root)?.isConnected) return;
      const style = document.createElement("style");
      style.setAttribute("data-cc-privacy-mask-style", "v1");
      style.textContent = `
        .cc-privacy-mask-value {
          font-size: 0 !important;
          text-decoration: none !important;
        }
        .cc-privacy-mask-value::after {
          content: attr(data-cc-mask-text);
          display: inline-block;
          font-size: var(--cc-mask-font-size, 14px) !important;
          line-height: var(--cc-mask-line-height, 1.2) !important;
          color: inherit;
          font-family: inherit;
          font-weight: inherit;
          letter-spacing: inherit;
          text-shadow: inherit;
          white-space: nowrap;
        }
        .cc-privacy-mask-avatar {
          content: var(--cc-mask-avatar-image) !important;
          background-image: var(--cc-mask-avatar-image) !important;
          background-size: cover !important;
          background-position: center !important;
          object-fit: cover !important;
          filter: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          border-radius: 50% !important;
        }
        .cc-privacy-mask-flag-image {
          content: var(--cc-mask-flag-image) !important;
          background-image: var(--cc-mask-flag-image) !important;
          background-size: contain !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          filter: none !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
      `;
      (root === document ? (document.head || document.documentElement) : root).appendChild(style);
      stylesByRoot.set(root, style);
    }

    function setMaskedText(node, text) {
      const computed = getComputedStyle(node);
      const preservedFontSize = node.style.getPropertyValue("--cc-mask-font-size") || computed.fontSize || "14px";
      const preservedLineHeight = node.style.getPropertyValue("--cc-mask-line-height") ||
        (computed.lineHeight === "normal" ? "1.2" : (computed.lineHeight || "1.2"));
      ensureMaskStyle(node);
      addClass(node, "cc-privacy-mask-value");
      setAttribute(node, "data-cc-mask-text", text);
      setStyles(node, {
        "--cc-mask-font-size": preservedFontSize,
        "--cc-mask-line-height": preservedLineHeight
      });
    }

    function upsertGeneratedNode(anchor, key, tagName = "span") {
      const parent = anchor?.parentElement;
      if (!parent) return null;
      let node = [...generatedNodes].find(([candidate, info]) => info.key === key && candidate.parentElement === parent)?.[0] || null;
      if (!node) {
        node = document.createElement(tagName);
        node.setAttribute("data-cc-mask-generated", key);
        parent.insertBefore(node, anchor);
        generatedNodes.set(node, { key, touched: true });
      } else {
        generatedNodes.get(node).touched = true;
      }
      return node;
    }

    function cleanupGeneratedNodes() {
      for (const [node, info] of [...generatedNodes]) {
        if (!info.touched || !node.isConnected) {
          node.remove();
          generatedNodes.delete(node);
        } else {
          info.touched = false;
        }
      }
    }

    function identityStyles(style, role, kind) {
      if (style === "chesscom") {
        if (kind === "title") return { color: "#ffffff", fontWeight: "700", letterSpacing: "0", textShadow: "none", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" };
        return kind === "rating"
          ? { color: "#a7a7a5", fontWeight: "600", letterSpacing: "0", textShadow: "none", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }
          : { color: "#d7d7d5", fontWeight: "600", letterSpacing: "0", textShadow: "none", fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" };
      }
      if (style === "royal") {
        return kind === "rating"
          ? { color: role === "my" ? "#dbc584" : "#9fcfba", fontWeight: "650", letterSpacing: "0.015em", textShadow: "0 1px 2px rgba(0,0,0,.65)", fontFamily: "Georgia, serif" }
          : { color: role === "my" ? "#ebdfb5" : "#c6ddd1", fontWeight: "700", letterSpacing: "0.01em", textShadow: "0 1px 2px rgba(0,0,0,.72)", fontFamily: "Georgia, serif" };
      }
      return kind === "rating"
        ? { color: role === "my" ? "#9cced3" : "#c8a9ce", fontWeight: "600", letterSpacing: "0.015em", textShadow: "0 1px 2px rgba(0,0,0,.7)", fontFamily: "Inter, system-ui, sans-serif" }
        : { color: role === "my" ? "#d6e8e9" : "#e2d5e5", fontWeight: "700", letterSpacing: "0.006em", textShadow: "0 1px 2px rgba(0,0,0,.75), 0 0 4px rgba(103,232,249,.14)", fontFamily: "Inter, system-ui, sans-serif" };
    }

    function leafCandidates(container, selector) {
      const all = deepQueryAll(container, selector);
      return all.filter(node => !all.some(other => other !== node && node.contains(other)));
    }

    function applyIdentity(container, identity, role, config) {
      const ratingNodes = leafCandidates(container, RATING_SELECTOR)
        .filter(node => /\d/.test(node.textContent || ""));
      const ratingSet = new Set(ratingNodes);
      const usernameNodes = leafCandidates(container, USERNAME_SELECTOR)
        .filter(node => !ratingSet.has(node) && !/^[\s(]*\d{1,4}[)\s]*$/.test(node.textContent || ""));
      const titleNodes = leafCandidates(container, TITLE_SELECTOR);
      const anchor = usernameNodes[0] || ratingNodes[0] || null;

      for (const node of usernameNodes) {
        setMaskedText(node, identity.nickname);
        setAttribute(node, "title", identity.nickname);
        setAttribute(node, "aria-label", identity.nickname);
        setStyles(node, { ...identityStyles(config.style, role, "name"), pointerEvents: config.blockProfileHover ? "none" : "auto" });
      }
      for (const node of ratingNodes) {
        const wrapped = /^\s*\(/.test(node.textContent || "");
        setMaskedText(node, wrapped ? `(${identity.elo})` : String(identity.elo));
        setStyles(node, identityStyles(config.style, role, "rating"));
      }
      for (const node of titleNodes) {
        setMaskedText(node, identity.title);
        setStyles(node, identityStyles(config.style, role, "title"));
      }

      if (identity.title && titleNodes.length === 0 && anchor) {
        const title = upsertGeneratedNode(anchor, `${role}-title`);
        if (title) {
          if (title.textContent !== identity.title) title.textContent = identity.title;
          if (title.className !== "cc-privacy-generated-title") title.className = "cc-privacy-generated-title";
          const titleStyle = "display:inline-flex;align-items:center;justify-content:center;margin-right:4px;padding:1px 4px;border-radius:3px;background:#81b64c;color:#fff;font:700 10px/1.25 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;vertical-align:middle;";
          if (title.style.cssText !== titleStyle) title.style.cssText = titleStyle;
        }
      }

      if (config.maskDetails) {
        const avatarSource = identity.avatarUrl || makeGeneratedAvatar(identity.nickname);
        const avatarMatches = deepQueryAll(container, AVATAR_SELECTOR)
          .filter(node => !node.hasAttribute("data-cc-mask-generated"))
          .filter(node => node.isConnected);
        const avatars = Array.from(new Set(avatarMatches.flatMap(node => {
          const nestedImages = node.tagName === "IMG" ? [] : [...node.querySelectorAll("img")];
          return nestedImages.length ? nestedImages : [node];
        })));
        if (avatars.length > 0) {
          for (const node of avatars) {
            ensureMaskStyle(node);
            addClass(node, "cc-privacy-mask-avatar");
            setAttribute(node, "alt", identity.nickname);
            setStyles(node, { "--cc-mask-avatar-image": `url("${avatarSource}")` });
          }
        } else if (anchor) {
          const avatar = upsertGeneratedNode(anchor, `${role}-avatar`, "img");
          if (avatar) {
            if (avatar.src !== avatarSource) avatar.src = avatarSource;
            if (avatar.alt !== identity.nickname) avatar.alt = identity.nickname;
            if (avatar.className !== "cc-privacy-generated-avatar") avatar.className = "cc-privacy-generated-avatar";
            const avatarStyle = "width:26px;height:26px;margin-right:6px;border-radius:50%;object-fit:cover;vertical-align:middle;box-shadow:0 1px 3px rgba(0,0,0,.45);";
            if (avatar.style.cssText !== avatarStyle) avatar.style.cssText = avatarStyle;
          }
        }

        const flagEmoji = countryCodeToEmoji(identity.countryCode);
        const flagMatches = deepQueryAll(container, FLAG_SELECTOR)
          .filter(node => !node.hasAttribute("data-cc-mask-generated"))
          .filter(node => node.isConnected);
        const flags = flagMatches.filter(node => !flagMatches.some(other => other !== node && node.contains(other)));
        if (flags.length > 0) {
          for (const node of flags) {
            if (node.tagName === "IMG") {
              ensureMaskStyle(node);
              addClass(node, "cc-privacy-mask-flag-image");
              setAttribute(node, "alt", identity.countryCode || "GM");
              setStyles(node, { "--cc-mask-flag-image": `url("${makeFlagImage(identity.countryCode)}")` });
            } else {
              setMaskedText(node, flagEmoji);
              setStyles(node, { "--cc-mask-font-size": "16px", "--cc-mask-line-height": "1", backgroundImage: "none", opacity: "1", visibility: "visible", filter: "none" });
              for (const child of node.children) setStyles(child, { display: "none" });
            }
          }
        } else if (anchor && identity.countryCode) {
          const flag = upsertGeneratedNode(anchor, `${role}-flag`);
          if (flag) {
            if (flag.textContent !== flagEmoji) flag.textContent = flagEmoji;
            if (flag.className !== "cc-privacy-generated-flag") flag.className = "cc-privacy-generated-flag";
            if (flag.title !== identity.countryCode) flag.title = identity.countryCode;
            const flagStyle = "display:inline-block;margin-right:5px;font-size:16px;line-height:1;vertical-align:middle;filter:none;";
            if (flag.style.cssText !== flagStyle) flag.style.cssText = flagStyle;
          }
        }

        for (const node of deepQueryAll(container, FLAIR_SELECTOR)) {
          setStyles(node, { opacity: "0", visibility: "hidden" });
        }
      }
    }

    function readRealUsername(container) {
      return leafCandidates(container, USERNAME_SELECTOR)
        .map(node => (node.textContent || "").trim())
        .find(value => value.length >= 2 && value.length <= 40) || "";
    }

    function restoreRecord(node, record) {
      if (!node.isConnected) {
        records.delete(node);
        return;
      }
      for (const [name, entry] of record.attributes) {
        if (node.getAttribute(name) !== entry.applied) continue;
        if (entry.original === null) node.removeAttribute(name);
        else node.setAttribute(name, entry.original);
      }
      for (const [property, entry] of record.styles) {
        const isCustom = property.startsWith("--");
        const current = isCustom ? node.style.getPropertyValue(property) : node.style[property];
        if (current !== entry.applied) continue;
        if (isCustom) {
          if (entry.original) node.style.setProperty(property, entry.original);
          else node.style.removeProperty(property);
        } else {
          node.style[property] = entry.original;
        }
      }
      for (const [className, wasPresent] of record.classes) {
        if (!wasPresent) node.classList.remove(className);
      }
      records.delete(node);
    }

    function restoreUntouched() {
      for (const [node, record] of records) {
        if (!record.touched) restoreRecord(node, record);
        else record.touched = false;
      }
    }

    function restoreAll() {
      applying = true;
      try {
        for (const [node, record] of [...records]) restoreRecord(node, record);
        for (const node of generatedNodes.keys()) node.remove();
        generatedNodes.clear();
        for (const style of stylesByRoot.values()) style.remove();
        stylesByRoot.clear();
        document.getElementById("cc-privacy-mask-bootstrap-style")?.remove();
        if (titleApplied !== null && document.title === titleApplied) document.title = titleOriginal;
        titleApplied = null;
      } finally {
        applying = false;
      }
    }

    function sync() {
      syncTimer = null;
      const config = normalizeConfig(getConfig());
      if (revealed) {
        restoreAll();
        reportStatus(0);
        return false;
      }
      if (!config.enabled) {
        restoreAll();
        stopObserver();
        reportStatus(0);
        return false;
      }

      const players = locatePlayers();
      if (!players) {
        reportStatus(0);
        for (const [node, record] of [...records]) {
          if (!node.isConnected) restoreRecord(node, record);
        }
        return false;
      }
      reportStatus(2);
      applying = true;
      try {
        for (const record of records.values()) record.touched = false;
        const authorizedName = (document.querySelector("#notifications-request[username]")?.getAttribute("username") || "").trim().toLowerCase();
        const topIsAuthorized = authorizedName && readRealUsername(players.top).toLowerCase() === authorizedName;
        const myContainer = topIsAuthorized ? players.top : players.bottom;
        const opponentContainer = topIsAuthorized ? players.bottom : players.top;
        applyIdentity(myContainer, config.my, "my", config);
        applyIdentity(opponentContainer, config.opponent, "opponent", config);
        restoreUntouched();
        cleanupGeneratedNodes();
        for (const [root, style] of [...stylesByRoot]) {
          if (root instanceof ShadowRoot && !root.host.isConnected) {
            style.remove();
            stylesByRoot.delete(root);
          }
        }
        document.getElementById("cc-privacy-mask-bootstrap-style")?.remove();

        if (config.maskPageTitle) {
          if (titleApplied === null || document.title !== titleApplied) titleOriginal = document.title;
          titleApplied = `${config.opponent.nickname} vs ${config.my.nickname} | Chess.com Broadcast`;
          if (document.title !== titleApplied) document.title = titleApplied;
        } else if (titleApplied !== null) {
          if (document.title === titleApplied) document.title = titleOriginal;
          titleApplied = null;
        }
      } finally {
        applying = false;
      }
      return true;
    }

    function scheduleSync(delay = 60) {
      if (syncTimer !== null) return;
      syncTimer = setTimeout(sync, delay);
    }

    function startObserver() {
      if (observer || !document.documentElement) return;
      observer = new MutationObserver(() => {
        if (!applying) scheduleSync();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      intervalId = setInterval(() => {
        const cacheIsValid = cachedPlayers?.top?.isConnected && cachedPlayers?.bottom?.isConnected &&
          isVisible(cachedPlayers.top) && isVisible(cachedPlayers.bottom);
        if (!cacheIsValid) {
          cachedPlayers = null;
          scheduleSync(0);
        }
      }, 1200);
    }

    function stopObserver() {
      if (observer) observer.disconnect();
      observer = null;
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      clearTimeout(syncTimer);
      syncTimer = null;
      cachedPlayers = null;
    }

    function update() {
      const config = normalizeConfig(getConfig());
      if (config.enabled) {
        startObserver();
        scheduleSync(0);
      } else {
        stopObserver();
        restoreAll();
      }
    }

    function handleHotkey(event) {
      if (!(event.ctrlKey && event.shiftKey && event.code === "KeyM")) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;
      event.preventDefault();
      if (typeof onToggle === "function") onToggle(!normalizeConfig(getConfig()).enabled);
    }

    function destroy() {
      stopObserver();
      restoreAll();
      window.removeEventListener("keydown", handleHotkey, true);
      reportStatus(0);
    }

    function setRevealed(value) {
      revealed = Boolean(value);
      if (revealed) restoreAll();
      else update();
    }

    window.addEventListener("keydown", handleHotkey, true);
    update();
    return { update, sync, restore: restoreAll, setRevealed, destroy, getStatus: () => ({ foundPlayers, active: foundPlayers === 2 }) };
  }

  function resolveProfile(profile) {
    if (!profile?.avatarPath) return profile;
    try {
      if (chrome.runtime?.getURL) return { ...profile, avatarUrl: chrome.runtime.getURL(profile.avatarPath) };
    } catch (e) {}
    return profile;
  }

  function getProfile(id) {
    return resolveProfile(PROFILES.find(profile => profile.id === id) || PROFILES[0]);
  }

  function randomProfile(excludedIds = []) {
    const excluded = new Set(excludedIds);
    const available = PROFILES.filter(profile => profile.id !== "custom" && !excluded.has(profile.id));
    return resolveProfile(available[Math.floor(Math.random() * available.length)] || PROFILES[1]);
  }

  window.ChessCoachPrivacyMask = {
    profiles: PROFILES,
    styles: STYLES,
    create,
    getProfile,
    randomProfile,
    clampElo,
    sanitizeNickname,
    sanitizeTitle,
    sanitizeCountryCode,
    sanitizeAvatarUrl,
    countryCodeToEmoji,
    makeGeneratedAvatar,
    normalizeConfig
  };
})();
