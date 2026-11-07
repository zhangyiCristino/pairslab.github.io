(() => {
  const root = document.querySelector("[data-lab-companion]");
  if (!root) return;
  const find = (selector) => root.querySelector(selector);
  const all = (selector) => [...root.querySelectorAll(selector)];
  const panel = find("[data-companion-panel]");
  const body = find("[data-companion-body]");
  const launcher = find("[data-companion-open]");
  const pet = find("[data-companion-pet]");
  const speech = find("[data-companion-speech]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const choices = all("[data-companion-character]");
  const characters = new Map(choices.map((button) => [button.dataset.companionCharacter, button.dataset]));
  const directionLinks = all("[data-companion-direction]");
  const directionIds = directionLinks.map((link) => link.dataset.companionDirection);
  const prefsKey = "pairs-lab:companion:prefs:v1";
  const progressKey = "pairs-lab:companion:explored:v1";
  let canPersist = true;

  const read = (key, fallback) => {
    let raw;
    try { raw = localStorage.getItem(key); }
    catch { canPersist = false; return fallback; }
    try { return raw === null ? fallback : JSON.parse(raw); }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { canPersist = false; }
    find("[data-companion-save-note]").textContent = canPersist
      ? "Progress is saved in this browser."
      : "Progress is kept for this visit only.";
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const validPrefs = (value) => {
    const data = value && typeof value === "object" ? value : {};
    const position = data.position;
    return {
      character: characters.has(data.character) ? data.character : choices[0].dataset.companionCharacter,
      collapsed: data.collapsed === true,
      welcomed: data.welcomed === true,
      position: position && Number.isFinite(position.x) && Number.isFinite(position.y)
        ? { x: clamp(position.x, 0, 1), y: clamp(position.y, 0, 1) } : null,
    };
  };
  const validProgress = (value) => new Set(Array.isArray(value) ? value.filter((id) => directionIds.includes(id)) : []);
  let prefs = validPrefs(read(prefsKey, {}));
  let explored = validProgress(read(progressKey, []));
  let moodTimer;
  let speechTimer;
  let lastInteraction = Date.now();
  let idleCycle = 0;
  let dragging = null;
  let suppressClick = false;
  let menuTrigger = find("[data-companion-menu]");
  const savePrefs = () => write(prefsKey, prefs);

  const bounds = () => {
    const headerBottom = document.querySelector("[data-header]")?.getBoundingClientRect().bottom || 70;
    const top = Math.min(Math.max(12, headerBottom + 8), Math.max(12, innerHeight - root.offsetHeight - 12));
    return { left: 12, top, right: Math.max(12, innerWidth - root.offsetWidth - 12), bottom: Math.max(top, innerHeight - root.offsetHeight - 12) };
  };
  const placeOverlay = (element) => {
    if (element.hidden) return;
    const rect = root.getBoundingClientRect();
    const topLimit = Math.max(12, (document.querySelector("[data-header]")?.getBoundingClientRect().bottom || 70) + 8);
    if (element === panel) element.style.maxHeight = `${Math.max(160, innerHeight - topLimit - 12)}px`;
    let size = element.getBoundingClientRect();
    if (element === panel && (rect.left >= size.width + 24 || innerWidth - rect.right >= size.width + 24)) {
      element.style.left = `${rect.left >= size.width + 24 ? rect.left - size.width - 10 : rect.right + 10}px`;
      element.style.top = `${clamp(rect.bottom - size.height, topLimit, Math.max(topLimit, innerHeight - size.height - 12))}px`;
      return;
    }
    if (element === panel) {
      const available = Math.max(rect.top - topLimit - 10, innerHeight - rect.bottom - 22);
      element.style.maxHeight = `${Math.max(160, available)}px`;
      size = element.getBoundingClientRect();
    }
    const above = rect.top - size.height - 10;
    const below = rect.bottom + 10;
    const desiredTop = above >= topLimit ? above : below;
    element.style.left = `${clamp(rect.right - size.width, 12, Math.max(12, innerWidth - size.width - 12))}px`;
    element.style.top = `${clamp(desiredTop, topLimit, Math.max(topLimit, innerHeight - size.height - 12))}px`;
  };
  const place = (x, y) => {
    const b = bounds();
    root.style.left = `${clamp(x, b.left, b.right)}px`;
    root.style.top = `${clamp(y, b.top, b.bottom)}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    placeOverlay(panel);
    placeOverlay(speech);
  };
  const restorePosition = () => {
    const b = bounds();
    place(prefs.position ? b.left + prefs.position.x * (b.right - b.left) : b.right,
      prefs.position ? b.top + prefs.position.y * (b.bottom - b.top) : b.bottom);
  };
  const rememberPosition = () => {
    const rect = root.getBoundingClientRect();
    const b = bounds();
    prefs.position = { x: (rect.left - b.left) / Math.max(1, b.right - b.left), y: (rect.top - b.top) / Math.max(1, b.bottom - b.top) };
    savePrefs();
  };
  const setMood = (mood, duration = 0) => {
    clearTimeout(moodTimer);
    root.dataset.mood = mood;
    if (duration) moodTimer = setTimeout(() => { root.dataset.mood = "idle"; }, duration);
  };
  const say = (message) => {
    clearTimeout(speechTimer);
    if (prefs.collapsed || !panel.hidden) return;
    speech.textContent = message;
    speech.hidden = false;
    placeOverlay(speech);
    speechTimer = setTimeout(() => { speech.hidden = true; }, 4200);
  };
  const burst = (element, symbol = "♥") => {
    if (reducedMotion.matches || document.hidden) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    for (let index = 0; index < (symbol === "🍊" ? 1 : 4); index += 1) {
      const particle = document.createElement("span");
      particle.className = `companion-particle${symbol === "🍊" ? " is-orange" : ""}`;
      particle.textContent = symbol;
      particle.setAttribute("aria-hidden", "true");
      particle.style.left = `${rect.left + rect.width / 2 + (index - 1.5) * 9}px`;
      particle.style.top = `${rect.top + rect.height * 0.4}px`;
      particle.style.setProperty("--drift", `${(index - 1.5) * 18}px`);
      particle.style.animationDelay = `${index * 65}ms`;
      document.body.append(particle);
      setTimeout(() => particle.remove(), 1500);
    }
  };
  const interact = (mood, message, duration = 2200) => {
    lastInteraction = Date.now();
    setMood(mood, duration);
    if (message) say(message);
  };
  const setMenu = (open, returnFocus = false) => {
    panel.hidden = !open;
    all("[data-companion-menu]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
    if (open) {
      speech.hidden = true;
      lastInteraction = Date.now();
      placeOverlay(panel);
      find("[data-companion-close]").focus({ preventScroll: true });
    } else if (returnFocus && !prefs.collapsed) menuTrigger.focus({ preventScroll: true });
  };
  const setCollapsed = (collapsed, persist = true, focus = true) => {
    prefs.collapsed = collapsed;
    setMenu(false);
    speech.hidden = true;
    body.hidden = collapsed;
    launcher.hidden = !collapsed;
    root.dataset.collapsed = String(collapsed);
    if (collapsed) setMood("idle");
    restorePosition();
    if (persist) savePrefs();
    if (focus) (collapsed ? launcher : pet).focus({ preventScroll: true });
  };
  const selectCharacter = (id, persist = true) => {
    if (!characters.has(id)) return;
    prefs.character = id;
    const character = characters.get(id);
    root.dataset.character = id;
    all("[data-companion-art]").forEach((art) => { art.style.backgroundImage = `url("${character.sprite}")`; });
    find("[data-companion-name]").textContent = character.name;
    find("[data-companion-title]").textContent = character.name;
    pet.setAttribute("aria-label", `Pet ${character.englishName}`);
    launcher.setAttribute("aria-label", `Open ${character.englishName}, your lab companion`);
    choices.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.companionCharacter === id)));
    all("[data-companion-like-row]").forEach((row) => { row.hidden = row.dataset.companionLikeRow !== id; });
    find('[data-companion-action="feed"]').hidden = id !== "lulu";
    setMood("idle");
    placeOverlay(panel);
    if (persist) savePrefs();
  };
  const updateProgress = () => {
    const unlocked = explored.size === directionIds.length;
    root.dataset.explorer = String(unlocked);
    find("[data-companion-progress]").value = explored.size;
    find("[data-companion-progress-label]").textContent = `${explored.size} / ${directionIds.length}`;
    find("[data-companion-quest-title]").textContent = unlocked ? "Lab Explorer unlocked!" : "Lab explorer";
    find("[data-companion-quest-description]").textContent = unlocked
      ? "You explored all four directions. Your badge and celebration pose are ready!"
      : "Visit all four research directions to earn your explorer badge.";
    all("[data-companion-badge]").forEach((badge) => { badge.hidden = !unlocked; });
    find('[data-companion-action="celebrate"]').hidden = !unlocked;
    directionLinks.forEach((link, index) => {
      const seen = explored.has(link.dataset.companionDirection);
      link.classList.toggle("is-explored", seen);
      link.querySelector("[data-companion-check]").textContent = seen ? "✓" : String(index + 1).padStart(2, "0");
      link.querySelector("[data-companion-direction-status]").textContent = seen ? " — explored" : " — not yet explored";
    });
    find("[data-companion-save-note]").textContent = canPersist ? "Progress is saved in this browser." : "Progress is kept for this visit only.";
    placeOverlay(panel);
  };
  const markExplored = (id) => {
    if (!directionIds.includes(id) || explored.has(id)) return;
    const wasUnlocked = explored.size === directionIds.length;
    explored = new Set([...explored, ...validProgress(read(progressKey, [])), id]);
    write(progressKey, [...explored]);
    updateProgress();
    if (!wasUnlocked && explored.size === directionIds.length && !prefs.collapsed) {
      interact("celebrate", "Lab Explorer unlocked! Four directions, one curious mind.", 3200);
      burst(pet, "⭐");
    }
  };

  choices.forEach((button) => button.addEventListener("click", () => {
    selectCharacter(button.dataset.companionCharacter);
    interact("wave", null, 1800);
  }));
  all("[data-companion-menu]").forEach((button) => button.addEventListener("click", () => {
    menuTrigger = button;
    setMenu(panel.hidden);
  }));
  find("[data-companion-close]").addEventListener("click", () => setMenu(false, true));
  find("[data-companion-minimize]").addEventListener("click", () => setCollapsed(true));
  launcher.addEventListener("click", () => {
    if (suppressClick) return;
    setCollapsed(false);
    interact("wave", "Welcome back!", 1800);
  });
  pet.addEventListener("click", () => {
    if (suppressClick) return;
    interact("happy", prefs.character === "lulu" ? "That made my day! Got an orange?" : "Head pats! You're my favorite researcher.");
    burst(pet);
  });
  all("[data-companion-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.companionAction;
    if (action === "celebrate" && explored.size !== directionIds.length) return;
    if (action === "feed" && prefs.character !== "lulu") return;
    if (action === "pet") { interact("happy", null); burst(pet); }
    else if (action === "wave") interact("wave", null, 2000);
    else if (action === "sleep") interact("sleep", null, 0);
    else if (action === "feed") { interact("feed", null, 2600); burst(pet, "🍊"); }
    else if (action === "celebrate") { interact("celebrate", null, 3000); burst(pet, "⭐"); }
  }));
  document.addEventListener("pairs:mascot-like", (event) => {
    if (!event.detail.liked) return;
    burst(event.target);
    if (!prefs.collapsed && event.detail.id === prefs.character) interact("happy", "A heart for me? Thank you!");
  });
  document.addEventListener("pointerdown", (event) => { if (!panel.hidden && !root.contains(event.target)) setMenu(false); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); setMenu(false, true); }
  });
  panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));

  const finishDrag = (event) => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const moved = dragging.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragging = null;
    root.classList.remove("is-dragging");
    if (moved) {
      rememberPosition();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
  };
  [pet, launcher, find("[data-companion-drag]")].forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const rect = root.getBoundingClientRect();
      dragging = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== dragging.pointerId) return;
      const dx = event.clientX - dragging.x;
      const dy = event.clientY - dragging.y;
      if (!dragging.moved && Math.hypot(dx, dy) < 6) return;
      dragging.moved = true;
      setMenu(false);
      speech.hidden = true;
      root.classList.add("is-dragging");
      place(dragging.left + dx, dragging.top + dy);
      if (event.cancelable) event.preventDefault();
    });
    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
  });
  const resetPosition = () => { prefs.position = null; savePrefs(); restorePosition(); };
  find("[data-companion-reset-position]").addEventListener("click", resetPosition);
  find("[data-companion-drag]").addEventListener("keydown", (event) => {
    const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (event.key === "Home") { event.preventDefault(); resetPosition(); return; }
    if (!offsets[event.key]) return;
    event.preventDefault();
    const [dx, dy] = offsets[event.key];
    const step = event.shiftKey ? 32 : 12;
    const rect = root.getBoundingClientRect();
    place(rect.left + dx * step, rect.top + dy * step);
    rememberPosition();
  });

  // Count actual time with a visible direction heading, not a visit to the overview.
  const visibleDirections = new Set();
  const dwellTimers = new Map();
  const headings = directionIds.map((id) => document.querySelector(`#${id} .research-editorial-program-heading`)).filter(Boolean);
  const queueDirection = (heading) => {
    const id = heading.closest(".research-editorial-program").id;
    if (document.hidden || explored.has(id) || dwellTimers.has(id)) return;
    const timer = setTimeout(() => {
      dwellTimers.delete(id);
      const rect = heading.getBoundingClientRect();
      if (!document.hidden && visibleDirections.has(heading) && !heading.closest("[hidden]") && rect.bottom > 80 && rect.top < innerHeight) markExplored(id);
    }, 1400);
    dwellTimers.set(id, timer);
  };
  if (headings.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
        const id = target.closest(".research-editorial-program").id;
        if (isIntersecting && intersectionRatio >= 0.5) { visibleDirections.add(target); queueDirection(target); }
        else { visibleDirections.delete(target); clearTimeout(dwellTimers.get(id)); dwellTimers.delete(id); }
      });
    }, { threshold: [0, 0.5], rootMargin: "-80px 0px 0px 0px" });
    headings.forEach((heading) => observer.observe(heading));
  }
  document.addEventListener("visibilitychange", () => {
    root.classList.toggle("is-paused", document.hidden);
    if (document.hidden) { dwellTimers.forEach(clearTimeout); dwellTimers.clear(); }
    else visibleDirections.forEach(queueDirection);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === prefsKey || event.key === null) {
      prefs = validPrefs(read(prefsKey, {}));
      selectCharacter(prefs.character, false);
      setCollapsed(prefs.collapsed, false, false);
    }
    if (event.key === progressKey || event.key === null) { explored = validProgress(read(progressKey, [])); updateProgress(); }
  });
  let resizeFrame;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(restorePosition);
  });
  reducedMotion.addEventListener("change", () => setMood("idle"));
  setInterval(() => {
    if (document.hidden || prefs.collapsed || dragging || reducedMotion.matches || !panel.hidden) return;
    if (Date.now() - lastInteraction > 45000) { setMood("sleep"); return; }
    if (root.dataset.mood !== "idle") return;
    idleCycle += 1;
    setMood(idleCycle % 5 === 0 ? "wave" : "blink", idleCycle % 5 === 0 ? 1500 : 180);
  }, 6000);

  root.hidden = false;
  selectCharacter(prefs.character, false);
  setCollapsed(prefs.collapsed, false, false);
  updateProgress();
  if (!prefs.welcomed) {
    prefs.welcomed = true;
    savePrefs();
    if (!prefs.collapsed) {
      setTimeout(() => {
        if (!reducedMotion.matches && root.dataset.mood === "idle") setMood("wave", 1800);
        say("Hi! Tap me, or open my menu to play and explore.");
      }, 1200);
    }
  }
})();
