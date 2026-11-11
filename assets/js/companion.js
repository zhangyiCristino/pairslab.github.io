(() => {
  const roots = [...document.querySelectorAll("[data-lab-companion]")];
  if (!roots.length) return;
  const controllers = new Map();
  let playground;
  const ids = roots.map((root) => root.dataset.labCompanion);
  const names = Object.fromEntries(roots.map((root) => [root.dataset.labCompanion, root.dataset.name]));
  const stateKey = "pairs-lab:companions:care:v2";
  const progressKey = "pairs-lab:companion:explored:v1";
  const prefsPrefix = "pairs-lab:companion:placement:v2:";
  const modes = { everyday: "Everyday", basketball: "Basketball", csgo: "CSGO" };
  const kinds = ["feed", "like", "pet", "wave", "sleep", "shoot", "dribble", "target", "grenade", "highfive", "pass", "coop", "celebrate"];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const spriteLoads = new Map();
  const loadSprite = (src) => {
    if (!src) return Promise.resolve(false);
    if (!spriteLoads.has(src)) {
      const image = new Image(); image.src = src;
      spriteLoads.set(src, image.decode().then(() => true, () => {
        spriteLoads.delete(src); // A temporary network failure must be retryable.
        return false;
      }));
    }
    return spriteLoads.get(src);
  };
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(n, hi));
  const number = (n, fallback, max = 100) => Number.isFinite(n) ? clamp(n, 0, max) : fallback;
  const count = (n) => Math.floor(number(n, 0, 1e9));
  const directionIds = [...new Set(document.querySelectorAll("[data-companion-direction]"))].map((link) => link.dataset.companionDirection);
  const validProgress = (value) => new Set(Array.isArray(value) ? value.filter((id) => directionIds.includes(id)) : []);
  let canPersist = true;
  const storageNote = () => roots.forEach((root) => {
    root.querySelector("[data-companion-save-note]").textContent = canPersist
      ? "Saved in this browser."
      : "Storage unavailable · this visit only.";
  });
  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      try { return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
    } catch { canPersist = false; return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { canPersist = false; }
    storageNote();
  };
  const validState = (input) => {
    const value = input && typeof input === "object" ? input : {};
    const now = Date.now();
    const pets = Object.fromEntries(ids.map((id) => {
      const pet = value.pets?.[id] || {};
      return [id, {
        fullness: number(pet.fullness, 68), happiness: number(pet.happiness, 76), energy: number(pet.energy, 82),
        feeds: count(pet.feeds), interactions: count(pet.interactions),
        likes: pet.likes === undefined ? (read("pairs-lab:mascot-like:v1:" + id, 0) === 1 ? 1 : 0) : count(pet.likes),
        lastLikeAt: number(pet.lastLikeAt, 0, now),
        baskets: count(pet.baskets), shots: count(pet.shots), targets: count(pet.targets),
        updatedAt: number(pet.updatedAt, now, now),
        lastActionAt: number(pet.lastActionAt, 0, now),
      }];
    }));
    const log = (Array.isArray(value.log) ? value.log : []).filter((event) =>
      event && ids.includes(event.pet) && kinds.includes(event.kind) && Number.isFinite(event.at) && event.at > 0 && event.at <= now + 60000
    ).slice(0, 24).map(({ pet, kind, at, scored }) => ({ pet, kind, at, scored: scored === true }));
    return { version: 2, pets, together: count(value.together), lastTeamAt: number(value.lastTeamAt, 0, now), trophyAt: number(value.trophyAt, 0, now), log };
  };
  const settle = (state) => {
    const now = Date.now();
    for (const pet of Object.values(state.pets)) {
      // Gentle decay, capped at one day away. No illness or loss of a pet.
      const hours = clamp((now - pet.updatedAt) / 3600000, 0, 24);
      pet.fullness = clamp(pet.fullness - hours * 2);
      pet.happiness = clamp(pet.happiness - hours);
      pet.energy = clamp(pet.energy - hours);
      pet.updatedAt = now;
    }
    return state;
  };
  let state = settle(validState(read(stateKey, {})));
  let explored = validProgress(read(progressKey, []));

  const validPrefs = (input) => {
    const p = input && typeof input === "object" ? input : {};
    return {
      mode: Object.hasOwn(modes, p.mode) ? p.mode : "everyday",
      collapsed: p.collapsed === true,
      position: p.position && Number.isFinite(p.position.x) && Number.isFinite(p.position.y)
        ? { x: clamp(p.position.x, 0, 1), y: clamp(p.position.y, 0, 1) } : null,
    };
  };
  const milestones = (current = state) => {
    const total = (field) => ids.reduce((sum, id) => sum + current.pets[id][field], 0);
    return [
      { key: "explore", icon: "⌘", name: "Curious mind", detail: explored.size + "/4 research directions", done: explored.size === 4 },
      { key: "care", icon: "◒", name: "A little care", detail: Math.min(5, total("feeds")) + "/5 feeds · feed both buddies", done: total("feeds") >= 5 && ids.every((id) => current.pets[id].feeds > 0) },
      { key: "play", icon: "↔", name: "Better together", detail: Math.min(3, current.together) + "/3 team-ups · " + Math.min(1, total("baskets")) + "/1 basket · " + Math.min(5, total("targets")) + "/5 targets", done: current.together >= 3 && total("baskets") >= 1 && total("targets") >= 5 },
      { key: "love", icon: "♡", name: "Spread some love", detail: Math.min(5, total("likes")) + "/5 likes · like both buddies", done: total("likes") >= 5 && ids.every((id) => current.pets[id].likes > 0) },
    ];
  };
  const renderLikes = () => document.querySelectorAll("[data-mascot-like]").forEach((button) => {
    const id = button.dataset.mascotLike;
    if (!state.pets[id]) return;
    const likes = state.pets[id].likes;
    button.removeAttribute("aria-pressed");
    button.classList.toggle("is-liked", likes > 0);
    button.setAttribute("aria-label", "Like " + names[id] + ". " + likes + " likes in this browser");
    button.querySelector("[data-mascot-like-label]").textContent = "Like";
    let counter = button.querySelector("[data-mascot-like-count]");
    if (!counter) { counter = document.createElement("span"); counter.dataset.mascotLikeCount = ""; counter.className = "mascot-like-count"; button.append(counter); }
    counter.textContent = likes;
    const controls = button.closest("[data-mascot-like-controls]");
    controls.hidden = false;
    controls.querySelector("[data-mascot-like-note]").textContent = canPersist ? "Hearts collected in this browser." : "Hearts collected for this visit.";
  });
  const renderAll = () => { controllers.forEach((pet) => pet.render()); renderLikes(); renderJourney(); storageNote(); };
  const transact = (update) => {
    const commit = () => {
      state = settle(validState(canPersist ? read(stateKey, state) : state));
      const result = update(state);
      write(stateKey, state);
      renderAll();
      return result;
    };
    // Serialize care actions across tabs, so simultaneous actions keep both counts.
    return canPersist && navigator.locks?.request
      ? navigator.locks.request("pairs-lab-companion-care", commit)
      : Promise.resolve(commit());
  };
  const eventText = (event) => {
    const name = names[event.pet];
    const food = roots.find((root) => root.dataset.labCompanion === event.pet).dataset.food;
    return {
      feed: name + (food === "rice" ? " enjoyed rice" : " enjoyed an orange"),
      like: "A heart for " + name, dribble: name + " practiced dribbling", grenade: name + " threw a training grenade",
      pet: "Head pats for " + name, wave: name + " waved hello", sleep: name + " took a nap",
      shoot: name + (event.scored ? " made a basket" : " practiced a free throw"),
      target: name + " hit a training target", highfive: "Naiwa & Lulu shared a high five",
      pass: "Naiwa & Lulu passed the ball", coop: "Naiwa & Lulu trained together",
      celebrate: name + " celebrated Lab Explorer",
    }[event.kind];
  };
  const perform = (controller, kind, extra = {}) => transact((current) => {
    const pet = current.pets[controller.id];
    const now = Date.now();
    const paired = ["highfive", "pass", "coop"].includes(kind);
    if (now - (kind === "like" ? pet.lastLikeAt : pet.lastActionAt) < (["target", "like"].includes(kind) ? 220 : 1000)) return { ok: false, message: "One moment — let me finish!" };
    if (paired && now - current.lastTeamAt < (kind === "pass" ? 900 : 2800)) return { ok: false, message: "Your buddies are still playing together." };
    if (kind === "feed" && pet.fullness >= 99) return { ok: false, message: "I'm full! Let's play or rest for a while." };
    if (kind === "sleep" && pet.energy >= 99) return { ok: false, message: "All rested and ready to play!" };
    if (["shoot", "dribble", "target", "grenade", "pass", "coop"].includes(kind)) {
      const players = paired ? ids : [controller.id];
      const tired = players.find((id) => current.pets[id].energy < 6 || current.pets[id].fullness < 8);
      if (tired) return { ok: false, message: current.pets[tired].energy < 6
        ? names[tired] + " needs a rest. Tap ☾ below " + names[tired] + " to restore energy."
        : names[tired] + " is hungry. Tap the food button below " + names[tired] + " to feed them." };
    }
    if (kind === "like") pet.lastLikeAt = now;
    else pet.lastActionAt = now;
    const add = (p, field, amount) => { p[field] = clamp(p[field] + amount); };
    if (kind === "like") { pet.likes += 1; add(pet, "happiness", 2); }
    else if (kind === "feed") { add(pet, "fullness", controller.foodRestore); add(pet, "happiness", 5); pet.feeds += 1; }
    else if (paired) {
      ids.forEach((id) => {
        const player = current.pets[id];
        add(player, "happiness", 8); add(player, "energy", kind === "highfive" ? -1 : -3); add(player, "fullness", -2);
        player.interactions += 1; player.lastActionAt = now;
      });
      current.together += 1; current.lastTeamAt = now;
    } else {
      pet.interactions += 1;
      if (kind === "sleep") { add(pet, "energy", 25); add(pet, "happiness", 2); }
      else if (kind === "shoot") {
        pet.shots += 1; if (extra.scored) pet.baskets += 1;
        add(pet, "happiness", extra.scored ? 7 : 2); add(pet, "energy", -5); add(pet, "fullness", -4);
      } else if (kind === "dribble" || kind === "grenade") {
        add(pet, "happiness", 3); add(pet, "energy", -2); add(pet, "fullness", -2);
      } else if (kind === "target") {
        pet.targets += 1; add(pet, "happiness", 2); add(pet, "energy", -1); add(pet, "fullness", -.5);
      } else add(pet, "happiness", kind === "pet" ? 6 : 3);
    }
    const event = { pet: controller.id, kind, at: now, scored: extra.scored === true };
    current.log = [event, ...current.log].slice(0, 24);
    const messages = {
      feed: controller.foodIcon + " Delicious! Fullness restored.",
      like: "+1 heart for " + controller.name + ". Thank you!", dribble: "Keep the ball moving!", grenade: "Here goes!",
      sleep: "A cozy nap. +25 energy.", shoot: extra.scored ? "Swish! A basket for " + controller.name + "." : "So close! Try the green zone or steady aim.",
      target: "Target hit!", highfive: "High five! Both buddies feel happier.",
      pass: "Nice pass! Teamwork makes the basket.", coop: "Practice partners! Both buddies level up their teamwork.",
      pet: "You're my favorite researcher!", wave: "Hello, fellow researcher!", celebrate: "Four directions, two curious lab buddies!",
    };
    return { ok: true, message: messages[kind] };
  });

  const burst = (element, symbol = "♥") => {
    if (reducedMotion.matches || document.hidden) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    for (let i = 0; i < 3; i += 1) {
      const particle = document.createElement("span");
      particle.className = "companion-particle";
      particle.textContent = symbol;
      particle.setAttribute("aria-hidden", "true");
      particle.style.left = rect.left + rect.width / 2 + (i - 1) * 9 + "px";
      particle.style.top = rect.top + rect.height * .4 + "px";
      particle.style.setProperty("--drift", (i - 1) * 20 + "px");
      particle.style.animationDelay = i * 65 + "ms";
      document.body.append(particle);
      setTimeout(() => particle.remove(), 1500);
    }
  };
  const sendBetween = (from, to, symbol) => {
    if (reducedMotion.matches || document.hidden) return;
    const a = from.pet.getBoundingClientRect(), b = to.pet.getBoundingClientRect();
    const particle = document.createElement("span");
    particle.className = "companion-duo-particle";
    particle.textContent = symbol;
    particle.setAttribute("aria-hidden", "true");
    document.body.append(particle);
    const x1 = a.x + a.width / 2, y1 = a.y + a.height / 2, x2 = b.x + b.width / 2, y2 = b.y + b.height / 2;
    particle.animate([
      { left: x1 + "px", top: y1 + "px", transform: "scale(.7) rotate(0deg)", opacity: 0 },
      { left: (x1 + x2) / 2 + "px", top: Math.max(90, Math.min(y1, y2) - 85) + "px", transform: "scale(1.1) rotate(120deg)", opacity: 1, offset: .5 },
      { left: x2 + "px", top: y2 + "px", transform: "scale(.7) rotate(240deg)", opacity: 0 },
    ], { duration: 1200, easing: "ease-in-out", fill: "both" });
    setTimeout(() => particle.remove(), 1300);
  };

  const pause = (ms, signal) => new Promise((resolve) => {
    if (signal?.aborted) { resolve(false); return; }
    const done = (ok) => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); resolve(ok); };
    const cancel = () => done(false), timer = setTimeout(() => done(true), ms);
    signal?.addEventListener("abort", cancel, { once: true });
  });
  const animate = async (element, frames, options, signal) => {
    if (signal?.aborted) return false;
    const animation = element.animate(frames, { fill: "forwards", ...options });
    const cancel = () => animation.cancel();
    signal?.addEventListener("abort", cancel, { once: true });
    try { await animation.finished; return !signal?.aborted; }
    catch { return false; }
    finally { signal?.removeEventListener("abort", cancel); }
  };
  // Sample a parabola at constant time steps, rather than joining three straight segments.
  const arc = (from, to, lift, rotation = 360) => Array.from({ length: 49 }, (_, index) => {
    const t = index / 48, x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t - 4 * lift * t * (1 - t);
    return { transform: `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${rotation * t}deg)`, offset: t };
  });
  const makeBall = () => {
    const ball = document.createElement("span");
    ball.className = "companion-page-ball"; ball.setAttribute("aria-hidden", "true");
    ball.innerHTML = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="#e38a32" stroke="#753d22" stroke-width="1.4"/><path d="M2 16h28M16 2v28M6 5c13 6 13 16 0 22M26 5c-13 6-13 16 0 22" fill="none" stroke="#753d22" stroke-width="1.2"/><path d="M8 7a12 12 0 0 1 13-2" fill="none" stroke="#ffd796" stroke-width="2" stroke-linecap="round"/></svg>';
    document.body.append(ball); return ball;
  };
  const impactAt = async (point, signal) => {
    if (signal?.aborted) return;
    const impact = document.createElement("span");
    impact.className = "companion-impact is-small";
    impact.setAttribute("aria-hidden", "true"); impact.style.left = point.x + "px"; impact.style.top = point.y + "px";
    document.body.append(impact);
    await animate(impact, [{ opacity: .9, transform: "scale(.25)" }, { opacity: 0, transform: "scale(1.35)" }], { duration: 180, easing: "ease-out" }, signal);
    impact.remove();
  };
  const trainingEffect = async (buddy, target, signal) => {
    if (reducedMotion.matches || document.hidden) return true;
    const a = buddy.pet.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!b.width || !b.height || signal.aborted) return false;
    const from = { x: a.x + a.width * (buddy.root.dataset.aim === "left" ? .28 : .72), y: a.y + a.height * .42 };
    const to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const projectile = document.createElement("span");
    projectile.className = "companion-projectile is-tracer"; projectile.dataset.owner = buddy.id;
    projectile.setAttribute("aria-hidden", "true"); document.body.append(projectile);
    try {
      const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
      if (!await animate(projectile, [
        { transform: `translate(${from.x}px,${from.y}px) rotate(${angle}deg)` },
        { transform: `translate(${to.x}px,${to.y}px) rotate(${angle}deg)` },
      ], { duration: 160, easing: "linear" }, signal)) return false;
      projectile.remove(); target.classList.add("is-hit");
      await impactAt(to, signal);
      await pause(180, signal);
      return !signal.aborted;
    } finally { projectile.remove(); target.classList.remove("is-hit"); }
  };
  const explosionAt = async (point, owner, signal) => {
    if (signal.aborted || document.hidden) return false;
    const blast = document.createElement("span");
    blast.className = "companion-explosion"; blast.dataset.owner = owner;
    blast.setAttribute("aria-hidden", "true");
    blast.style.left = point.x + "px"; blast.style.top = point.y + "px";
    blast.innerHTML = '<i class="companion-blast-ring"></i><i class="companion-blast-core"></i>';
    const smoke = Array.from({ length: 4 }, () => { const puff = document.createElement("i"); puff.className = "companion-blast-smoke"; blast.append(puff); return puff; });
    const sparks = Array.from({ length: 8 }, () => { const spark = document.createElement("i"); spark.className = "companion-blast-spark"; blast.append(spark); return spark; });
    document.body.append(blast);
    try {
      if (reducedMotion.matches) { blast.classList.add("is-quiet"); return await pause(450, signal); }
      const jobs = [
        animate(blast.querySelector(".companion-blast-ring"), [{ opacity: .8, transform: "scale(.18)" }, { opacity: 0, transform: "scale(1.15)" }], { duration: 650, easing: "ease-out" }, signal),
        animate(blast.querySelector(".companion-blast-core"), [{ opacity: .95, transform: "scale(.16)" }, { opacity: .9, transform: "scale(.88)", offset: .22 }, { opacity: 0, transform: "scale(1.05)" }], { duration: 460, easing: "ease-out" }, signal),
        ...smoke.map((puff, index) => {
          const x = [-28, 24, -13, 16][index], y = [-20, -30, -43, -8][index];
          return animate(puff, [{ opacity: 0, transform: "translate(0,0) scale(.25)" }, { opacity: .38, offset: .24 }, { opacity: 0, transform: `translate(${x}px,${y}px) scale(1.35)` }], { duration: 780, delay: index * 20, easing: "ease-out" }, signal);
        }),
        ...sparks.map((spark, index) => {
          const angle = index * Math.PI / 4, x = Math.cos(angle) * 54, y = Math.sin(angle) * 36;
          const rotation = angle * 180 / Math.PI;
          return animate(spark, [{ opacity: 1, transform: `rotate(${rotation}deg) translateX(4px) scaleX(.5)` }, { opacity: 0, transform: `translate(${x}px,${y}px) rotate(${rotation}deg) scaleX(.15)` }], { duration: 440 + (index % 3) * 65, easing: "ease-out" }, signal);
        }),
      ];
      await Promise.all(jobs);
      return !signal.aborted;
    } finally { blast.remove(); }
  };
  const throwEffect = async (buddy, signal) => {
    if (document.hidden) return true;
    if (!reducedMotion.matches && !await pause(208, signal)) return false;
    const rect = buddy.pet.getBoundingClientRect(), left = buddy.root.dataset.aim === "left";
    const from = { x: rect.x + rect.width * (left ? .46 : .54), y: rect.y + rect.height * .42 };
    const to = { x: clamp(from.x + (left ? -1 : 1) * Math.min(250, innerWidth * .42), 80, innerWidth - 80), y: Math.min(rect.bottom - 10, innerHeight - 100) };
    if (reducedMotion.matches) return explosionAt(to, buddy.id, signal);
    const grenade = document.createElement("span");
    grenade.className = "companion-projectile is-grenade"; grenade.dataset.owner = buddy.id;
    grenade.setAttribute("aria-hidden", "true"); document.body.append(grenade);
    try {
      if (!await animate(grenade, arc(from, to, 75, left ? -150 : 150), { duration: 650, easing: "linear" }, signal)) return false;
      if (!await pause(100, signal)) return false;
      grenade.remove();
      return await explosionAt(to, buddy.id, signal);
    } finally { grenade.remove(); }
  };

  const createController = (root) => {
    const find = (selector) => root.querySelector(selector);
    const all = (selector) => [...root.querySelectorAll(selector)];
    const id = root.dataset.labCompanion;
    const panel = find("[data-companion-panel]"), pet = find("[data-companion-pet]");
    const launcher = find("[data-companion-open]"), speech = find("[data-companion-speech]");
    // Escape the pet's stacking context so game controls cannot cover messages.
    speech.dataset.owner = id; document.body.append(speech);
    const prefsKey = prefsPrefix + id;
    let prefs = validPrefs(read(prefsKey, {
      collapsed: false,
      position: null,
    }));
    let busy = false, dragging = null, suppressClick = false, motionLocked = false;
    let moodTimer, speechTimer, pairTimer, borrowedMode = null;
    let poseAnimations = [];
    let lastInteraction = Date.now(), idleCycle = 0;
    let menuTrigger = find("[data-companion-menu]");
    const savePrefs = () => write(prefsKey, prefs);
    const bounds = () => {
      const header = document.querySelector("[data-header]")?.getBoundingClientRect().bottom || 70;
      const top = Math.min(Math.max(12, header + 8), Math.max(12, innerHeight - root.offsetHeight - 12));
      return { left: 12, top, right: Math.max(12, innerWidth - root.offsetWidth - 12), bottom: Math.max(top, innerHeight - root.offsetHeight - 12) };
    };
    const placeOverlay = (element) => {
      if (element.hidden) return;
      const rect = root.getBoundingClientRect();
      const topLimit = Math.max(12, (document.querySelector("[data-header]")?.getBoundingClientRect().bottom || 70) + 8);
      if (element === panel) element.style.maxHeight = Math.max(120, innerHeight - topLimit - 12) + "px";
      let size = element.getBoundingClientRect();
      if (element === panel && (rect.left >= size.width + 24 || innerWidth - rect.right >= size.width + 24)) {
        element.style.left = (rect.left >= size.width + 24 ? rect.left - size.width - 10 : rect.right + 10) + "px";
        element.style.top = clamp(rect.bottom - size.height, topLimit, Math.max(topLimit, innerHeight - size.height - 12)) + "px";
        return;
      }
      if (element === panel) {
        const available = Math.max(rect.top - topLimit - 10, innerHeight - rect.bottom - 22);
        element.style.maxHeight = Math.max(120, available) + "px";
        size = element.getBoundingClientRect();
      }
      const above = rect.top - size.height - 10;
      element.style.left = clamp(rect.right - size.width, 12, Math.max(12, innerWidth - size.width - 12)) + "px";
      let y = clamp(above >= topLimit ? above : rect.bottom + 10, topLimit, Math.max(topLimit, innerHeight - size.height - 12));
      if (element === speech) {
        const hud = document.querySelector('[data-companion-playground]:not([hidden]) .companion-game-hud')?.getBoundingClientRect();
        const x = parseFloat(element.style.left);
        if (hud && x < hud.right + 8 && x + size.width > hud.left - 8 && y < hud.bottom + 8 && y + size.height > hud.top - 8) y = Math.max(topLimit, hud.top - size.height - 12);
      }
      element.style.top = y + "px";
    };
    const place = (x, y) => {
      const b = bounds();
      root.style.left = clamp(x, b.left, b.right) + "px";
      root.style.top = clamp(y, b.top, b.bottom) + "px";
      root.style.right = "auto"; root.style.bottom = "auto";
      placeOverlay(panel); placeOverlay(speech);
    };
    const restorePosition = () => {
      const b = bounds();
      place(prefs.position ? b.left + prefs.position.x * (b.right - b.left) : (root.dataset.side === "left" ? b.left : b.right),
        prefs.position ? b.top + prefs.position.y * (b.bottom - b.top) : b.bottom);
    };
    const rememberPosition = () => {
      const rect = root.getBoundingClientRect(), b = bounds();
      prefs.position = { x: (rect.left - b.left) / Math.max(1, b.right - b.left), y: (rect.top - b.top) / Math.max(1, b.bottom - b.top) };
      savePrefs();
    };
    const applySkin = (mood = root.dataset.mood) => {
      const mode = borrowedMode || prefs.mode;
      const court = mode === "basketball" && ["dribble", "ready", "gather", "pass-ready", "pass", "receive", "catch"].includes(mood) ? root.dataset.courtSprite : null;
      const sequence = mood === "shoot" && mode === "basketball" ? root.dataset.shotSprite : mood === "grenade" && mode === "csgo" ? root.dataset.grenadeSprite : null;
      const isAction = ["shoot", "dribble", "pass", "catch", "target", "grenade"].includes(mood) && mode !== "everyday";
      const sprite = court || sequence || (mode === "everyday" ? root.dataset.sprite : isAction ? root.dataset.actionsSprite : root.dataset.modesSprite);
      root.dataset.mode = mode;
      root.dataset.skin = court ? "court" : sequence ? "sequence" : mode === "everyday" ? "base" : isAction ? "action" : "mode";
      find(".companion-sprite").style.backgroundImage = 'url("' + sprite + '")';
      const mini = find(".companion-mini-sprite");
      mini.style.backgroundImage = 'url("' + (prefs.mode === "everyday" ? root.dataset.sprite : root.dataset.modesSprite) + '")';
      mini.style.backgroundPosition = "0 " + (prefs.mode === "csgo" ? "100%" : "0");
    };
    const setMood = (mood, duration = 0) => {
      clearTimeout(moodTimer); poseAnimations.forEach((animation) => animation.cancel()); poseAnimations = [];
      root.dataset.mood = mood; applySkin(mood);
      if (root.dataset.skin === "court" && mood === "dribble" && !reducedMotion.matches) {
        const sprite = find(".companion-sprite");
        poseAnimations.push(sprite.animate([
          { backgroundPosition: "33.333333% 0", offset: 0, easing: "steps(1,end)" },
          { backgroundPosition: "66.666667% 0", offset: .23, easing: "steps(1,end)" },
          { backgroundPosition: "33.333333% 0", offset: .73, easing: "steps(1,end)" },
          { backgroundPosition: "33.333333% 0", offset: 1 },
        ], { duration: 450, iterations: 3, fill: "forwards" }));
      }
      if (root.dataset.skin === "sequence" && !reducedMotion.matches) {
        const sprite = find(".companion-sprite");
        const poses = mood === "grenade" ? [[2, 0], [3, .32], [6, .72]] : [[0, 0], [1, .13], [2, .25], [3, .36], [4, .48], [5, .66], [6, .82], [7, .94]];
        const motionDuration = mood === "grenade" ? 650 : 1200;
        poseAnimations.push(sprite.animate(poses.map(([frame, offset]) => ({
          backgroundPosition: (frame % 4) * 100 / 3 + "% " + (frame < 4 ? "0%" : "100%"), offset, easing: "steps(1, end)",
        })), { duration: motionDuration, easing: "linear", fill: "forwards" }));
        poseAnimations.push(sprite.animate(mood === "shoot" ? [
          { transform: "translateY(0) scale(1)" },
          { transform: "translateY(5px) scale(1.035,.96)", offset: .18 },
          { transform: "translateY(-24px) scale(.985,1.015)", offset: .37 },
          { transform: "translateY(-21px) scale(1)", offset: .5 },
          { transform: "translateY(3px) scale(1.035,.97)", offset: .72 },
          { transform: "translateY(0) scale(1)" },
        ] : [
          { transform: "rotate(-3deg)" },
          { transform: "rotate(3deg)", offset: .32 },
          { transform: "rotate(0deg)" },
        ], { duration: motionDuration, easing: "cubic-bezier(.35,0,.25,1)", fill: "forwards" }));
      }
      if (duration) moodTimer = setTimeout(() => setMood("idle"), duration);
    };
    // A teammate borrows an outfit for one interaction, never a saved preference.
    const endPair = () => {
      clearTimeout(pairTimer); borrowedMode = null;
      root.classList.remove("is-paired"); setMood("idle");
    };
    const pairOutfit = (mode, mood, duration = 2400) => {
      clearTimeout(pairTimer); borrowedMode = mode; lastInteraction = Date.now();
      root.classList.add("is-paired"); setMood(mood);
      if (duration) pairTimer = setTimeout(endPair, duration);
    };
    const feedback = (message, important = false) => {
      clearTimeout(speechTimer);
      playground?.notice(message, important);
      if (prefs.collapsed) return;
      speech.textContent = message; speech.hidden = false; placeOverlay(speech);
      speechTimer = setTimeout(() => { speech.hidden = true; }, important ? 6000 : 3600);
    };
    const syncAim = () => {};
    const setMenu = (open, returnFocus = false) => {
      if (open && playground?.actor) playground.stop();
      if (open) controllers.forEach((other) => { if (other.id !== id) other.menu(false); });
      panel.hidden = !open; root.dataset.panelOpen = String(open);
      all("[data-companion-menu]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
      if (open) {
        speech.hidden = true; lastInteraction = Date.now(); render(); placeOverlay(panel);
        find("[data-companion-close]").focus({ preventScroll: true });
      } else if (returnFocus && !prefs.collapsed) menuTrigger.focus({ preventScroll: true });
      syncAim();
    };
    const setCollapsed = (collapsed, persist = true, focus = true) => {
      prefs.collapsed = collapsed; setMenu(false); speech.hidden = true;
      find("[data-companion-body]").hidden = collapsed; launcher.hidden = !collapsed;
      root.dataset.collapsed = String(collapsed);
      if (collapsed) { if (playground?.passing) playground.cancelPass(); setMood("idle"); if (playground?.actor === id) playground.stop(); }
      restorePosition();
      if (persist) savePrefs();
      if (focus) (collapsed ? launcher : pet).focus({ preventScroll: true });
    };
    const setMode = (mode, persist = true) => {
      if (!Object.hasOwn(modes, mode)) return;
      if (playground?.actor === id && playground.mode !== mode) playground.stop();
      endPair();
      prefs.mode = mode; root.dataset.mode = mode; setMood("idle");
      // Action sheets load only when that action is requested.
      all("[data-companion-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.companionMode === mode)));
      find("[data-companion-mode-label]").textContent = modes[mode];
      placeOverlay(panel);
      if (persist) savePrefs();
      restorePosition();
    };
    const render = () => {
      const stats = state.pets[id];
      ["fullness", "happiness", "energy"].forEach((key) => {
        find('[data-companion-stat="' + key + '"]').textContent = Math.round(stats[key]);
        find('[data-companion-meter="' + key + '"]').value = stats[key];
      });
      ["feeds", "interactions", "likes"].forEach((key) => { find('[data-pet-record="' + key + '"]').textContent = stats[key]; });
      find("[data-companion-mini-fullness]").style.width = stats.fullness + "%";
      find(".companion-name").title = root.dataset.name + " · Fullness " + Math.round(stats.fullness) + "/100";
      placeOverlay(panel);
    };
    const controller = {
      id, name: root.dataset.name, root, pet, like: () => action("like"), play: (kind, extra) => action(kind, extra), foodIcon: root.dataset.foodIcon, foodRestore: Number(root.dataset.foodRestore),
      render, menu: setMenu, collapse: setCollapsed, mode: setMode, mood: setMood, feedback, restorePosition, syncAim, pairOutfit, endPair, lockMotion: (locked) => { motionLocked = locked; },
      positionSpeech: () => placeOverlay(speech),
      get prefs() { return prefs; },
      loadPrefs() { if (playground?.passing) playground.cancelPass(); prefs = validPrefs(read(prefsKey, prefs)); setMode(prefs.mode, false); setCollapsed(prefs.collapsed, false, false); },
      init() {
        all("[data-companion-art]").forEach((art) => { art.style.backgroundImage = 'url("' + root.dataset.sprite + '")'; });
        root.hidden = false; setMode(prefs.mode, false); setCollapsed(prefs.collapsed, false, false); render();
      },
      idle() {
        if (document.hidden || prefs.collapsed || dragging || motionLocked || reducedMotion.matches || !panel.hidden) return;
        if (Date.now() - lastInteraction > 45000) { setMood("sleep"); return; }
        if (root.dataset.mood === "idle") { idleCycle += 1; setMood(idleCycle % 5 === 0 ? "wave" : "blink", idleCycle % 5 === 0 ? 1500 : 180); }
      },
    };
    const action = async (kind, extra = {}) => {
      if (busy || motionLocked) return false;
      if (kind === "celebrate" && explored.size !== directionIds.length) return false;
      busy = true; lastInteraction = Date.now();
      try {
        const mode = prefs.mode;
        if (["shoot", "grenade", "dribble", "target"].includes(kind)) {
          const key = kind === "shoot" ? "shotSprite" : kind === "dribble" ? "courtSprite" : kind === "target" ? "actionsSprite" : "grenadeSprite";
          if (!await loadSprite(root.dataset[key])) {
            feedback("The animation could not load. Please try again.", true);
            return false;
          }
          if (mode !== prefs.mode) return false;
        }
        const result = await perform(controller, kind, extra);
        feedback(result.message, !result.ok);
        if (!result.ok) return false;
        if (!["highfive", "pass", "coop"].includes(kind) && borrowedMode) endPair();
        const mood = { feed: "feed", like: "happy", pet: "happy", wave: "wave", sleep: "sleep", shoot: "shoot", dribble: "dribble", target: "target", grenade: "grenade", highfive: "wave", pass: "pass", coop: "target", celebrate: "celebrate" }[kind];
        setMood(mood, kind === "sleep" || kind === "dribble" ? 0 : kind === "target" ? 360 : kind === "grenade" ? 950 : 2400);
        if (kind === "feed") feedAnimation(controller);
        if (["pet", "celebrate"].includes(kind)) burst(pet, kind === "celebrate" ? "⭐" : "♥");
        return true;
      } finally { busy = false; }
    };
    all("[data-companion-menu]").forEach((button) => button.addEventListener("click", () => { menuTrigger = button; setMenu(panel.hidden); }));
    find("[data-companion-close]").addEventListener("click", () => setMenu(false, true));
    find("[data-companion-minimize]").addEventListener("click", () => setCollapsed(true));
    launcher.addEventListener("click", () => { if (!suppressClick) { setCollapsed(false); setMood("wave", 1600); } });
    pet.addEventListener("click", () => { if (!suppressClick) action("pet"); });
    all("[data-companion-action]").forEach((button) => button.addEventListener("click", () => {
      const kind = button.dataset.companionAction;
      action(kind);
    }));
    all("[data-companion-mode]").forEach((button) => button.addEventListener("click", () => {
      lastInteraction = Date.now();
      const mode = button.dataset.companionMode;
      setMode(mode);
      if (mode !== "everyday") playground.start(id, mode);
    }));
    all("[data-companion-fire]").forEach((button) => button.addEventListener("click", () => {
      playground.fire(id, button.dataset.companionFire === "grenade");
    }));
    find("[data-companion-pass-back]").addEventListener("click", () => playground.pass(id));
    const playTogether = async (forcedKind) => {
      const friend = [...controllers.values()].find((other) => other.id !== id);
      if (!friend) return;
      const kind = forcedKind || (prefs.mode === "basketball" ? "pass" : "highfive");
      if (kind === "pass") return playground.pass();
      const mode = "everyday";
      if (!await action(kind)) return;
      if (friend.prefs.collapsed) friend.collapse(false, true, false);
      const pairMode = kind === "pass" ? "basketball" : null;
      controller.pairOutfit(pairMode || prefs.mode, mode === "basketball" ? "pass" : "wave");
      friend.pairOutfit(pairMode || friend.prefs.mode, mode === "basketball" ? "catch" : "wave");
      friend.feedback(mode === "basketball" ? "Got it! Nice pass, " + controller.name + "." : "High five, " + controller.name + "!");
      sendBetween(controller, friend, mode === "basketball" ? "🏀" : "♥");
      return true;
    };
    controller.together = playTogether;
    const resetPosition = () => { prefs.position = null; savePrefs(); restorePosition(); };
    find("[data-companion-reset-position]").addEventListener("click", resetPosition);
    const finishDrag = (event) => {
      if (!dragging || event.pointerId !== dragging.pointerId) return;
      const moved = dragging.moved;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      dragging = null; root.classList.remove("is-dragging");
      if (moved) { rememberPosition(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
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
        const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
        if (!dragging.moved && Math.hypot(dx, dy) < 6) return;
        dragging.moved = true; if (playground?.passing) playground.cancelPass(); setMenu(false); speech.hidden = true;
        root.classList.add("is-dragging"); place(dragging.left + dx, dragging.top + dy);
        if (event.cancelable) event.preventDefault();
      });
      handle.addEventListener("pointerup", finishDrag); handle.addEventListener("pointercancel", finishDrag);
    });
    find("[data-companion-drag]").addEventListener("keydown", (event) => {
      const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (event.key === "Home") { event.preventDefault(); resetPosition(); return; }
      if (!offsets[event.key]) return;
      event.preventDefault();
      if (playground?.passing) playground.cancelPass();
      const [dx, dy] = offsets[event.key], step = event.shiftKey ? 32 : 12, rect = root.getBoundingClientRect();
      place(rect.left + dx * step, rect.top + dy * step); rememberPosition();
    });
    panel.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
    document.addEventListener("pointerdown", (event) => { if (!panel.hidden && !root.contains(event.target)) setMenu(false); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); setMenu(false, true); } });
    return controller;
  };

  const passport = document.querySelector("[data-companion-passport]");
  const dock = document.querySelector("[data-companion-dock]");
  const journeyFind = (selector) => passport.querySelector(selector);
  const renderJourney = () => {
    const discoveries = milestones(), earned = discoveries.filter((step) => step.done).length;
    const list = journeyFind("[data-companion-milestones]"); list.replaceChildren();
    discoveries.forEach((step) => {
      const li = document.createElement("li"), icon = document.createElement("span"), copy = document.createElement("span"), title = document.createElement("strong"), detail = document.createElement("small");
      li.classList.toggle("is-complete", step.done); li.dataset.milestone = step.key;
      icon.className = "companion-milestone-icon"; icon.textContent = step.done ? "✓" : step.icon;
      title.textContent = step.name; detail.textContent = step.detail;
      copy.append(title, detail); li.append(icon, copy); list.append(li);
    });
    journeyFind("#companion-passport-title").textContent = state.trophyAt ? "Companion Cup" : "PAIRS Lab Adventure";
    const cup = journeyFind("[data-companion-cup]");
    cup.dataset.earned = String(state.trophyAt > 0); cup.style.setProperty("--cup-progress", earned / 4);
    journeyFind("[data-companion-cup-status]").textContent = state.trophyAt ? "Earned " + new Date(state.trophyAt).toLocaleDateString() : earned + " / 4 discoveries collected";
    journeyFind("[data-companion-cup-description]").textContent = state.trophyAt ? "Curiosity, care and teamwork. This cup is yours." : "Follow your curiosity. Care for your buddies. Collect your PAIRS Lab Cup.";
    const claim = journeyFind("[data-companion-claim]");
    claim.disabled = earned < 4 || state.trophyAt > 0;
    claim.textContent = state.trophyAt ? "PAIRS Lab Cup · collected" : earned === 4 ? "Claim your PAIRS Lab Cup" : "4 discoveries unlock your cup";
    document.querySelector("[data-journey-count]").textContent = state.trophyAt ? "🏆" : earned + "/4";
    dock.classList.toggle("is-ready", earned === 4 && !state.trophyAt);
    journeyFind("[data-companion-progress-label]").textContent = explored.size + " / 4";
    passport.querySelectorAll("[data-companion-direction]").forEach((link, index) => {
      const seen = explored.has(link.dataset.companionDirection);
      link.classList.toggle("is-explored", seen);
      link.querySelector("[data-companion-check]").textContent = seen ? "✓" : String(index + 1).padStart(2, "0");
      link.querySelector("[data-companion-direction-status]").textContent = seen ? " — explored" : " — not yet explored";
    });
    roots.forEach((root) => {
      root.dataset.explorer = String(explored.size === 4);
      root.querySelectorAll("[data-companion-badge]").forEach((badge) => { badge.hidden = explored.size !== 4; });
    });
  };

  const feedAnimation = (buddy) => {
    if (reducedMotion.matches || document.hidden) return;
    const food = buddy.root.querySelector('[data-companion-action="feed"]').getBoundingClientRect();
    const pet = buddy.pet.getBoundingClientRect();
    const particle = document.createElement("span");
    particle.className = "companion-food-flight"; particle.textContent = buddy.foodIcon;
    particle.setAttribute("aria-hidden", "true"); document.body.append(particle);
    particle.animate([
      { left: food.x + "px", top: food.y + "px", transform: "scale(.8)", opacity: 1 },
      { left: pet.x + pet.width * .8 + "px", top: pet.y + pet.height * .3 + "px", transform: "scale(1.2)", opacity: 1, offset: .6 },
      { left: pet.x + pet.width * .48 + "px", top: pet.y + pet.height * .4 + "px", transform: "scale(.3)", opacity: 0 },
    ], { duration: 1000, easing: "ease-in-out", fill: "both" });
    setTimeout(() => particle.remove(), 1100);
  };

  const createPlayground = () => {
    const field = document.querySelector("[data-companion-playground]");
    const find = (selector) => field.querySelector(selector);
    const hoop = find("[data-playground-hoop]");
    const targets = new Map([...field.querySelectorAll("[data-playground-target]")].map((target) => [target.dataset.playgroundTarget, target]));
    const rounds = new Map(ids.map((id) => [id, { hits: 0, busy: false }]));
    const shooters = () => ids.filter((id) => { const pet = controllers.get(id); return pet.prefs.mode === "csgo" && !pet.prefs.collapsed; });
    const fireControls = (id, disabled) => {
      const root = controllers.get(id).root; root.dataset.fireBusy = String(disabled);
      root.querySelectorAll("[data-companion-fire]").forEach((button) => { button.disabled = disabled; });
    };
    let actor = null, mode = "everyday", frame, busy = false, steady = reducedMotion.matches, session = 0;
    let effects = new AbortController(), passSession = null;
    const status = (text, important = false) => {
      field.dataset.notice = String(important);
      find("[data-playground-status]").textContent = text;
      controllers.forEach((pet) => pet.positionSpeech());
    };
    const headerBottom = () => document.querySelector("[data-header]")?.getBoundingClientRect().bottom || 70;
    let aimPhase = 0, aimTime = performance.now();
    const aim = () => {
      const now = performance.now(), elapsed = Math.min(now - aimTime, 100);
      aimTime = now;
      if (reducedMotion.matches) return 50;
      aimPhase += elapsed / (steady ? 1800 : 900);
      return 50 + Math.sin(aimPhase) * 47;
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      find("[data-playground-steady]").setAttribute("aria-pressed", String(steady || reducedMotion.matches));
      if (!actor || mode !== "basketball" || document.hidden) return;
      const tick = () => {
        find("[data-playground-aim]").style.left = aim() + "%";
        if (!reducedMotion.matches) frame = requestAnimationFrame(tick);
      };
      tick();
    };
    const score = () => {
      if (!actor) return;
      const pet = state.pets[actor];
      find("[data-playground-score]").textContent = mode === "basketball" ? pet.baskets + " baskets / " + pet.shots + " shots" : shooters().map((id) => names[id] + " " + rounds.get(id).hits + "/5").join(" · ");
    };
    const layout = () => {
      if (!actor) return;
      hoop.style.left = clamp(innerWidth * .76 - 72, 22, Math.max(22, innerWidth - 166)) + "px";
      hoop.style.top = clamp(headerBottom() + 74, 90, Math.max(90, innerHeight - 340)) + "px";
      const top = headerBottom() + 60, bottom = Math.max(top + 30, innerHeight - 345);
      targets.forEach((target, id) => {
        const round = rounds.get(id), buddy = controllers.get(id);
        target.hidden = mode !== "csgo" || !shooters().includes(id) || round.hits >= 5;
        const horizontal = .23 + (round.hits % 3) * .04;
        const x = ids.indexOf(id) === 0 ? horizontal : 1 - horizontal;
        const y = [.22, .52, .68, .34, .6][round.hits % 5];
        target.style.left = clamp(innerWidth * x, 38, innerWidth - 38) + "px";
        target.style.top = top + (bottom - top) * y + "px";
        target.querySelector("[data-playground-target-number]").textContent = String(round.hits + 1).padStart(2, "0");
        target.setAttribute("aria-label", "Shoot with " + names[id] + ": target " + (round.hits + 1) + " of 5");
        if (!target.hidden) {
          const petRect = buddy.pet.getBoundingClientRect(), aimRect = target.getBoundingClientRect();
          buddy.root.dataset.aim = aimRect.x + aimRect.width / 2 < petRect.x + petRect.width / 2 ? "left" : "right";
        }
      });
      if (mode === "basketball" && !passSession) {
        const buddy = controllers.get(actor), petRect = buddy.pet.getBoundingClientRect(), aimRect = hoop.getBoundingClientRect();
        buddy.root.dataset.aim = aimRect.x + aimRect.width / 2 < petRect.x + petRect.width / 2 ? "left" : "right";
      }
    };
    const passPoint = (buddy, extended = false) => {
      const rect = buddy.pet.getBoundingClientRect(), isLulu = buddy.id === "lulu";
      const x = extended ? .82 : .51;
      return { x: rect.x + rect.width * (buddy.root.dataset.aim === "left" ? 1 - x : x), y: rect.y + rect.height * (extended ? (isLulu ? .56 : .48) : (isLulu ? .61 : .54)) };
    };
    const placePassBall = (ball, point) => {
      ball.getAnimations().forEach((animation) => animation.cancel());
      ball.style.transform = `translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
    };
    const passControls = () => {
      const waiting = passSession && passSession.owner !== passSession.home;
      controllers.forEach((buddy) => {
        const button = buddy.root.querySelector("[data-companion-pass-back]");
        button.hidden = !waiting || passSession.owner !== buddy.id || busy;
        button.setAttribute("aria-label", "Pass the ball back to " + (passSession ? names[passSession.home] : "your buddy"));
      });
      find('[data-playground-action="pass"]').textContent = waiting ? "Pass back" : "Pass";
      ["shoot", "dribble"].forEach((action) => { find('[data-playground-action="' + action + '"]').disabled = Boolean(passSession); });
      if (passSession) field.dataset.passOwner = passSession.owner;
      else delete field.dataset.passOwner;
    };
    const cancelPass = () => {
      const exchange = passSession;
      if (!exchange) return;
      passSession = null;
      clearTimeout(exchange.returnTimer); exchange.effects.abort(); exchange.ball.remove();
      controllers.forEach((buddy) => {
        buddy.lockMotion(false); buddy.endPair();
        delete buddy.root.dataset.passing; delete buddy.root.dataset.aim;
        buddy.root.style.removeProperty("--pair-step"); buddy.restorePosition();
      });
      busy = false; field.dataset.busy = "false";
      passControls(); layout();
    };
    const passBall = async (requestedOwner = null, record = true) => {
      if (!actor || mode !== "basketball" || busy) return false;
      if (requestedOwner && passSession?.owner !== requestedOwner) return false;
      const token = session, started = performance.now();
      const from = controllers.get(passSession?.owner || actor);
      const to = [...controllers.values()].find((buddy) => buddy.id !== from.id);
      busy = true; field.dataset.busy = "true"; passControls();
      try {
        const loaded = await Promise.all([from, to].map((buddy) => loadSprite(buddy.root.dataset.courtSprite)));
        if (token !== session) return false;
        if (loaded.some((ok) => !ok)) { from.feedback("The passing animation is still loading. Please try again.", true); return false; }
        if (record) {
          const result = await perform(from, "pass");
          if (!result.ok) { from.feedback(result.message, true); return false; }
          if (token !== session) return false;
        }
        if (!passSession) {
          passSession = { home: actor, owner: actor, ball: makeBall(), effects: new AbortController(), returnTimer: null };
          passSession.ball.dataset.purpose = "pass";
          [from, to].forEach((buddy) => {
            if (buddy.prefs.collapsed) buddy.collapse(false, true, false);
            buddy.lockMotion(true); buddy.root.dataset.passing = "true";
            buddy.pairOutfit("basketball", "ready", 0); buddy.restorePosition();
          });
        }
        const exchange = passSession, signal = exchange.effects.signal;
        clearTimeout(exchange.returnTimer);
        const a = from.pet.getBoundingClientRect(), b = to.pet.getBoundingClientRect();
        from.root.dataset.aim = a.x < b.x ? "right" : "left";
        to.root.dataset.aim = a.x < b.x ? "left" : "right";
        const step = Math.min(10, Math.abs(a.x - b.x) * .04);
        from.root.style.setProperty("--pair-step", (a.x < b.x ? step : -step) + "px");
        to.root.style.setProperty("--pair-step", (a.x < b.x ? -step : step) + "px");
        from.mood("pass-ready"); to.mood("receive");
        from.feedback(record ? "To you, " + to.name + "!" : "Back to you, " + to.name + "!");
        to.feedback("I'm ready!");
        status(from.name + " → " + to.name + " · chest pass");
        placePassBall(exchange.ball, passPoint(from));
        if (!reducedMotion.matches && !await pause(260, signal)) return false;
        from.mood("pass");
        const release = passPoint(from, true), receive = passPoint(to, true);
        if (!reducedMotion.matches) {
          const duration = clamp(Math.hypot(receive.x - release.x, receive.y - release.y) * .9, 600, 1100);
          if (!await animate(exchange.ball, arc(release, receive, clamp(Math.abs(receive.x - release.x) * .06, 15, 52), 270), { duration, easing: "linear" }, signal)) return false;
        }
        if (signal.aborted || token !== session) return false;
        to.mood("catch"); from.mood("ready");
        const held = passPoint(to);
        if (!reducedMotion.matches && !await animate(exchange.ball, arc(receive, held, 3, 25), { duration: 220, easing: "ease-out" }, signal)) return false;
        placePassBall(exchange.ball, held); exchange.owner = to.id;
        if (!await pause(Math.max(100, 1040 - (performance.now() - started)), signal)) return false;
        if (token !== session || passSession !== exchange) return false;
        if (exchange.owner === exchange.home) {
          to.feedback("Got it! Great teamwork."); from.feedback("Right back to you!");
          cancelPass(); status("Pass and return complete. Nice teamwork!");
        } else {
          to.feedback("Got it! Tap Pass back — your turn."); from.feedback("Nice catch, " + to.name + "!");
          status(to.name + " has the ball. Tap Pass back to return it to " + from.name + ".");
          exchange.returnTimer = setTimeout(() => { if (passSession === exchange) passBall(exchange.owner, false); }, 5500);
        }
        return true;
      } finally {
        if (token === session) { busy = false; field.dataset.busy = "false"; passControls(); }
      }
    };
    const stop = (focus = false) => {
      cancelPass();
      const previous = actor;
      actor = null; session += 1; busy = false; cancelAnimationFrame(frame);
      effects.abort(); effects = new AbortController();
      controllers.forEach((buddy, id) => {
        if (id === previous || rounds.get(id).busy) buddy.mood("idle");
        buddy.lockMotion(false);
        delete buddy.root.dataset.aim;
        rounds.get(id).busy = false; fireControls(id, false);
      });
      field.hidden = true; field.dataset.busy = "false"; dock.hidden = false;
      if (focus && previous) controllers.get(previous).pet.focus({ preventScroll: true });
    };
    const start = (id, nextMode) => {
      if (!controllers.has(id) || !["basketball","csgo"].includes(nextMode)) return;
      stop();
      const buddy = controllers.get(id);
      buddy.mode(nextMode);
      if (buddy.prefs.collapsed) buddy.collapse(false, true, false);
      controllers.forEach((pet) => pet.menu(false));
      actor = id; mode = nextMode; rounds.forEach((round) => { round.hits = 0; }); field.dataset.mode = mode; field.hidden = false; dock.hidden = false;
      field.querySelectorAll("[data-playground-basketball]").forEach((node) => { node.hidden = mode !== "basketball"; });
      field.querySelectorAll("[data-playground-csgo]").forEach((node) => { node.hidden = mode !== "csgo"; });
      hoop.hidden = mode !== "basketball";
      find("[data-playground-title]").textContent = mode === "basketball" ? buddy.name + " · Basketball" : "CSGO · target practice";
      status(mode === "basketball" ? "Shoot in the green zone, or use steady aim." : "Each buddy has their own Shoot and Throw buttons.");
      score(); layout(); sync();
      (mode === "basketball" ? find('[data-playground-action="shoot"]') : targets.get(id)).focus({ preventScroll: true });
    };
    const ballFlight = async (buddy, scored, dribble = false) => {
      if (reducedMotion.matches || document.hidden) return true;
      const signal = effects.signal;
      if (!dribble && !await pause(432, signal)) return false;
      const r = buddy.pet.getBoundingClientRect(), h = hoop.getBoundingClientRect();
      const ball = makeBall(); ball.dataset.purpose = dribble ? "dribble" : "shot";
      try {
        if (dribble) {
          const handX = buddy.id === "lulu" ? .76 : .83;
          const hand = { x: r.x + r.width * (buddy.root.dataset.aim === "left" ? 1 - handX : handX), y: r.y + r.height * (buddy.id === "lulu" ? .70 : .63) };
          const ground = { x: hand.x, y: r.bottom - 8 };
          const transform = (p, scale = "1") => `translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${scale})`;
          return await animate(ball, [
            { transform: transform(hand), easing: "cubic-bezier(.45,0,1,1)" },
            { transform: transform(ground, "1.08,.92"), offset: .52, easing: "cubic-bezier(0,0,.45,1)" },
            { transform: transform(hand) },
          ], { duration: 450, iterations: 3 }, signal);
        }
        const handX = buddy.id === "lulu" ? .66 : .35;
        const hand = { x: r.x + r.width * (buddy.root.dataset.aim === "left" ? 1 - handX : handX), y: r.y + r.height * .22 - 22 };
        const rim = { x: h.x + h.width * .5 + (scored ? 0 : 34), y: h.y + h.height * .69 };
        let lift = Math.max(65, (hand.y - rim.y) * .43 + 35);
        const ceiling = headerBottom() + 14;
        const apexY = () => {
          const t = clamp((4 * lift - rim.y + hand.y) / (8 * lift), 0, 1);
          return hand.y + (rim.y - hand.y) * t - 4 * lift * t * (1 - t);
        };
        while (lift > 20 && apexY() < ceiling) lift -= 6;
        if (!await animate(ball, arc(hand, rim, lift, 420), { duration: 1080, easing: "linear" }, signal)) return false;
        if (scored) {
          hoop.classList.add("is-scored");
          await animate(ball, [
            { transform: `translate(${rim.x}px,${rim.y}px) translate(-50%,-50%) rotate(420deg) scale(1)`, opacity: 1 },
            { transform: `translate(${rim.x + 3}px,${rim.y + 65}px) translate(-50%,-50%) rotate(490deg) scale(.82)`, opacity: 0 },
          ], { duration: 370, easing: "ease-in" }, signal);
        } else {
          const rebound = { x: rim.x + (hand.x < rim.x ? 66 : -66), y: rim.y + 110 };
          await animate(ball, arc(rim, rebound, 30, 180).map((frame, i) => ({ ...frame, opacity: 1 - Math.max(0, i / 48 - .6) * 2.5 })), { duration: 470, easing: "linear" }, signal);
        }
        return !signal.aborted;
      } finally { ball.remove(); hoop.classList.remove("is-scored"); }
    };
    const fire = async (id, grenade = false) => {
      const buddy = controllers.get(id), round = rounds.get(id), target = targets.get(id);
      if (!buddy || buddy.prefs.mode !== "csgo" || buddy.prefs.collapsed || round.busy) return;
      if (!actor || mode !== "csgo") start(id, "csgo");
      if (!grenade && round.hits >= 5) { buddy.feedback("Five targets cleared! Start a new round to shoot again.", true); return; }
      const token = session; round.busy = true; fireControls(id, true);
      try {
        if (!await buddy.play(grenade ? "grenade" : "target")) return;
        if (token !== session) return;
        const complete = grenade ? await throwEffect(buddy, effects.signal) : await trainingEffect(buddy, target, effects.signal);
        if (!complete || token !== session) return;
        if (!grenade) {
          round.hits += 1;
          status(names[id] + (round.hits === 5 ? " cleared all five targets." : " hit their target."));
          score(); layout();
        }
      } finally { if (token === session) { round.busy = false; fireControls(id, false); } }
    };
    targets.forEach((target, id) => target.addEventListener("click", () => fire(id)));
    field.querySelectorAll("[data-playground-action]").forEach((button) => button.addEventListener("click", async () => {
      if (!actor || busy) return;
      const action = button.dataset.playgroundAction;
      if (action === "next") {
        if ([...rounds.values()].some((round) => round.busy)) return;
        rounds.forEach((round) => { round.hits = 0; }); score(); layout(); status("Five targets for each buddy. Ready!");
        targets.get(actor).focus({ preventScroll: true }); return;
      }
      if (action === "pass") { await passBall(); return; }
      if (passSession) { status("Your buddy has the ball. Ask for a pass back first."); return; }
      const token = session, buddy = controllers.get(actor); busy = true; field.dataset.busy = "true";
      try {
        {
          const position = aim(), scored = position >= 40 && position <= 60;
          if (!await buddy.play(action, { scored })) return;
          if (token !== session) return;
          buddy.lockMotion(true);
          if (!await ballFlight(buddy, scored, action === "dribble") || token !== session) return;
          score();
          status(action === "dribble" ? "Keep the ball moving!" : scored ? "Swish! Another basket." : "Just wide. Try the green zone or steady aim.");
        }
      } finally {
        if (token === session) {
          buddy.lockMotion(false);
          if (action === "dribble") buddy.mood("idle");
          busy = false; field.dataset.busy = "false";
        }
      }
    }));
    find("[data-playground-exit]").addEventListener("click", () => stop(true));
    find("[data-playground-steady]").addEventListener("click", () => {
      steady = !steady; sync();
      status(steady ? "Steady aim: a slower sweep. Shoot in the green zone." : "Normal aim. Shoot in the green zone.");
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && actor) stop(true); });
    return { start, stop, sync, layout, fire, pass: passBall, cancelPass, notice: (text, important = true) => { if (actor && (important || field.dataset.notice === "true")) status(text, important); }, get passing() { return Boolean(passSession); }, get actor() { return actor; }, get mode() { return mode; } };
  };

  roots.forEach((root) => { const pet = createController(root); controllers.set(pet.id, pet); });
  controllers.forEach((pet) => pet.init());
  playground = createPlayground();
  dock.hidden = false;
  transact(() => {});

  document.querySelector("[data-companion-highfive]").addEventListener("click", () => {
    const first = controllers.get(ids[0]);
    if (first.prefs.collapsed) first.collapse(false, true, false);
    first.together("highfive");
  });
  document.querySelector("[data-journey-open]").addEventListener("click", () => {
    playground.stop(); controllers.forEach((buddy) => buddy.menu(false)); renderJourney(); passport.showModal();
  });
  journeyFind("[data-journey-close]").addEventListener("click", () => passport.close());
  passport.addEventListener("click", (event) => { if (event.target === passport) { const r = passport.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) passport.close(); } });
  journeyFind("[data-companion-claim]").addEventListener("click", async () => {
    const claimed = await transact((current) => {
      explored = new Set([...explored, ...validProgress(read(progressKey, []))]);
      if (current.trophyAt || !milestones(current).every((step) => step.done)) return false;
      current.trophyAt = Date.now(); return true;
    });
    if (claimed) controllers.forEach((buddy) => { buddy.mood("celebrate", 3500); burst(buddy.pet, "🏆"); });
  });

  document.querySelectorAll("[data-mascot-like]").forEach((button) => button.addEventListener("click", async () => {
    const buddy = controllers.get(button.dataset.mascotLike);
    if (!buddy || !await buddy.like()) return;
    write("pairs-lab:mascot-like:v1:" + buddy.id, 1);
    button.dispatchEvent(new CustomEvent("pairs:mascot-like", { bubbles: true, detail: { id: buddy.id, liked: true, canPersist } }));
  }));
  document.addEventListener("pairs:mascot-like", (event) => {
    if (!event.detail?.liked) return;
    const pet = controllers.get(event.detail.id);
    if (!pet) return;
    burst(event.target);
    pet.mood("happy", 2000); pet.feedback("A heart for me? Thank you!");
  });
  const markExplored = (id) => {
    if (!directionIds.includes(id) || explored.has(id)) return;
    const previouslyUnlocked = explored.size === directionIds.length;
    explored = new Set([...explored, ...validProgress(read(progressKey, [])), id]);
    write(progressKey, [...explored]); renderAll();
    if (!previouslyUnlocked && explored.size === directionIds.length) controllers.forEach((pet) => {
      pet.mood("celebrate", 3000); pet.feedback("Lab Explorer unlocked! Your celebration pose is ready."); burst(pet.pet, "⭐");
    });
  };
  // Only an actually visible direction heading earns exploration credit.
  const visibleDirections = new Set(), dwellTimers = new Map();
  const headings = directionIds.map((id) => document.querySelector("#" + id + " .research-editorial-program-heading")).filter(Boolean);
  const queueDirection = (heading) => {
    const id = heading.closest(".research-editorial-program").id;
    if (document.hidden || explored.has(id) || dwellTimers.has(id)) return;
    dwellTimers.set(id, setTimeout(() => {
      dwellTimers.delete(id);
      const rect = heading.getBoundingClientRect();
      if (!document.hidden && visibleDirections.has(heading) && !heading.closest("[hidden]") && rect.bottom > 80 && rect.top < innerHeight) markExplored(id);
    }, 1400));
  };
  if (headings.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
      const id = target.closest(".research-editorial-program").id;
      if (isIntersecting && intersectionRatio >= .5) { visibleDirections.add(target); queueDirection(target); }
      else { visibleDirections.delete(target); clearTimeout(dwellTimers.get(id)); dwellTimers.delete(id); }
    }), { threshold: [0, .5], rootMargin: "-80px 0px 0px 0px" });
    headings.forEach((heading) => observer.observe(heading));
  }
  document.addEventListener("visibilitychange", () => {
    roots.forEach((root) => root.classList.toggle("is-paused", document.hidden));
    playground?.sync();
    if (document.hidden) { dwellTimers.forEach(clearTimeout); dwellTimers.clear(); }
    else { visibleDirections.forEach(queueDirection); transact(() => {}); }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === stateKey || event.key === null) { state = settle(validState(read(stateKey, {}))); renderAll(); }
    if (event.key === progressKey || event.key === null) { explored = validProgress(read(progressKey, [])); renderAll(); }
    controllers.forEach((pet) => { if (event.key === prefsPrefix + pet.id || event.key === null) pet.loadPrefs(); });
  });
  let resizeFrame;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { if (playground?.passing) playground.cancelPass(); controllers.forEach((pet) => pet.restorePosition()); playground?.layout(); });
  });
  reducedMotion.addEventListener("change", () => { if (playground?.passing) playground.cancelPass(); controllers.forEach((pet) => pet.mood("idle")); playground?.sync(); });
  setInterval(() => controllers.forEach((pet) => pet.idle()), 6000);
  setInterval(() => { if (!document.hidden) transact(() => {}); }, 60000);
})();
