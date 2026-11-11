(() => {
  const body = document.body;
  const header = document.querySelector("[data-header]");
  const nav = document.querySelector("[data-nav]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const setHeaderState = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 20);
  };

  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  if (nav && navToggle) {
    const toggleLabel = navToggle.querySelector(".sr-only");

    const setNavState = (open) => {
      nav.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      if (toggleLabel) toggleLabel.textContent = open ? "Close navigation" : "Open navigation";
      body.classList.toggle("nav-open", open);
    };

    navToggle.addEventListener("click", () => {
      setNavState(navToggle.getAttribute("aria-expanded") !== "true");
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setNavState(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setNavState(false);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 920) setNavState(false);
    });
  }

  const heroSlider = document.querySelector("[data-hero-slider]");
  if (heroSlider) {
    const slides = Array.from(heroSlider.querySelectorAll("[data-hero-slide]"));
    const copies = Array.from(heroSlider.querySelectorAll("[data-hero-copy]"));
    const previous = heroSlider.querySelector("[data-hero-prev]");
    const next = heroSlider.querySelector("[data-hero-next]");
    let currentIndex = 0;
    let inView = true;
    let timer;

    const stopTimer = () => {
      window.clearTimeout(timer);
      timer = undefined;
    };

    const showSlide = (requestedIndex) => {
      currentIndex = (requestedIndex + slides.length) % slides.length;
      slides.forEach((slide, index) => slide.classList.toggle("is-active", index === currentIndex));
      copies.forEach((copy, index) => {
        const isActive = index === currentIndex;
        copy.classList.toggle("is-active", isActive);
        copy.setAttribute("aria-hidden", String(!isActive));
        copy.querySelectorAll("a").forEach((link) => {
          link.tabIndex = isActive ? 0 : -1;
        });
      });
      const video = slides[currentIndex].querySelector("[data-hero-video]");
      if (video?.dataset.poster && !video.poster) video.poster = video.dataset.poster;
      document.dispatchEvent(new Event("pairs:mediachange"));
    };

    const scheduleNext = () => {
      stopTimer();
      if (slides.length < 2 || reducedMotion.matches || document.hidden || !inView) return;
      timer = window.setTimeout(() => {
        showSlide(currentIndex + 1);
        scheduleNext();
      }, 6500);
    };

    const selectSlide = (index) => {
      showSlide(index);
      scheduleNext();
    };

    previous?.addEventListener("click", () => selectSlide(currentIndex - 1));
    next?.addEventListener("click", () => selectSlide(currentIndex + 1));
    document.addEventListener("visibilitychange", scheduleNext);
    reducedMotion.addEventListener?.("change", scheduleNext);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        scheduleNext();
      }).observe(heroSlider);
    }

    showSlide(0);
    scheduleNext();
  }

  const revealItems = Array.from(document.querySelectorAll(".reveal"));
  if (revealItems.length) {
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    } else {
      document.documentElement.classList.add("motion-ready");
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -48px", threshold: 0.1 },
      );
      revealItems.forEach((item) => revealObserver.observe(item));
    }
  }

  const peopleCarousels = Array.from(document.querySelectorAll("[data-people-carousel]"));
  peopleCarousels.forEach((peopleCarousel) => {
    const stage = peopleCarousel.querySelector("[data-people-stage]");
    const ring = peopleCarousel.querySelector("[data-people-ring]");
    const cards = Array.from(peopleCarousel.querySelectorAll("[data-people-card]"));
    const details = Array.from(peopleCarousel.querySelectorAll("[data-people-detail]"));
    const dots = Array.from(peopleCarousel.querySelectorAll("[data-people-dot]"));
    const filters = Array.from(peopleCarousel.closest(".people-original-panel")?.querySelectorAll("[data-people-filter]") || []);
    const previous = peopleCarousel.querySelector("[data-people-prev]");
    const next = peopleCarousel.querySelector("[data-people-next]");
    const search = peopleCarousel.closest(".people-original-panel")?.querySelector("[data-member-search]");
    let activeGroup = "all";
    let activeIndex = 0;
    let rotationIndex = 0;
    let touchStartX = null;

    const getVisibleIndexes = () => cards.reduce((indexes, card, index) => {
      if (activeGroup === "all" || card.dataset.group === activeGroup) indexes.push(index);
      return indexes;
    }, []);

    const wrapIndex = (index, length) => (index + length) % length;

    const renderPeopleCarousel = () => {
      const visibleIndexes = getVisibleIndexes();
      const visibleCount = visibleIndexes.length;
      if (!visibleCount) return;

      activeIndex = wrapIndex(activeIndex, visibleCount);
      const stageWidth = stage?.clientWidth || window.innerWidth;
      // The whole rack turns; each sleeve keeps its radial slot on a full circle.
      // Keeping the turn unwrapped also makes last-to-first a single step.
      const angleStep = 360 / visibleCount;
      const cameraDistance = 1000 + Math.max(0, 980 - stageWidth) * 0.85;
      ring?.style.setProperty("--album-turn", `${-rotationIndex * angleStep}deg`);
      ring?.style.setProperty("--album-camera", `${-cameraDistance}px`);

      cards.forEach((card, cardIndex) => {
        const visiblePosition = visibleIndexes.indexOf(cardIndex);
        const isVisible = visiblePosition !== -1;
        card.hidden = !isVisible;

        if (!isVisible) {
          details[cardIndex].hidden = true;
          dots[cardIndex].hidden = true;
          return;
        }

        const isActive = visiblePosition === activeIndex;
        card.style.setProperty("--album-slot", `${visiblePosition * angleStep}deg`);
        card.classList.toggle("is-active", isActive);
        card.setAttribute("aria-pressed", String(isActive));
        card.tabIndex = isActive ? 0 : -1;

        details[cardIndex].hidden = !isActive;
        dots[cardIndex].hidden = false;
        dots[cardIndex].classList.toggle("is-active", isActive);
        dots[cardIndex].setAttribute("aria-current", isActive ? "true" : "false");
      });

      const disableArrows = visibleCount < 2;
      if (previous) previous.disabled = disableArrows;
      if (next) next.disabled = disableArrows;
    };

    const selectRelative = (offset) => {
      const visibleCount = getVisibleIndexes().length;
      if (visibleCount < 2) return;
      activeIndex = wrapIndex(activeIndex + offset, visibleCount);
      rotationIndex += offset;
      renderPeopleCarousel();
    };

    const selectPosition = (position) => {
      const count = getVisibleIndexes().length;
      let offset = position - activeIndex;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;
      selectRelative(offset);
    };

    if (search) {
      const input = search.querySelector("[data-member-search-input]");
      const popup = search.querySelector("[data-member-search-popup]");
      const results = search.querySelector("[data-member-search-results]");
      const empty = search.querySelector("[data-member-search-empty]");
      const status = search.querySelector("[data-member-search-status]");
      const normalizeName = (value) => value.normalize("NFKD").toLowerCase()
        .replace(/[\u0300-\u036f]/g, "").replace(/[\s\p{P}]+/gu, "");
      const members = cards.map((card, index) => {
        const name = card.querySelector(".people-carousel-card-name").textContent.trim();
        const role = details[index].querySelector(".people-carousel-role, .people-carousel-director-title span")?.textContent.replace(/:$/, "").trim() || "";
        return { name, role, index, keys: [normalizeName(name), normalizeName(name.split(/\s+/).reverse().join(" "))] };
      });
      let matches = [];
      let highlighted = -1;

      const closeSearch = () => {
        popup.hidden = true;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        highlighted = -1;
      };

      const highlightResult = (index) => {
        highlighted = index;
        Array.from(results.children).forEach((option, optionIndex) => {
          option.classList.toggle("is-highlighted", optionIndex === index);
        });
        const option = results.children[index];
        if (option) {
          input.setAttribute("aria-activedescendant", option.id);
          option.scrollIntoView({ block: "nearest" });
        } else {
          input.removeAttribute("aria-activedescendant");
        }
      };

      const chooseMember = (member) => {
        const position = getVisibleIndexes().indexOf(member.index);
        if (position === -1) return;
        selectPosition(position);
        input.value = member.name;
        input.focus();
        closeSearch();
        status.textContent = `Showing ${member.name}${member.role ? `, ${member.role}` : ""}.`;
      };

      const openSearch = () => {
        const query = normalizeName(input.value);
        matches = members.filter((member) => member.keys.some((key) => key.includes(query)));
        results.replaceChildren();
        matches.forEach((member) => {
          const option = document.createElement("div");
          option.id = `member-search-option-${member.index}`;
          option.className = "people-member-search-option";
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", String(member.index === getVisibleIndexes()[activeIndex]));
          const name = document.createElement("span");
          name.textContent = member.name;
          option.append(name);
          if (member.role) {
            const role = document.createElement("small");
            role.textContent = member.role;
            option.append(role);
          }
          // Keep input focus for mouse selection; touch still scrolls the list normally.
          option.addEventListener("mousedown", (event) => event.preventDefault());
          option.addEventListener("click", () => chooseMember(member));
          results.append(option);
        });
        popup.hidden = false;
        popup.scrollTop = 0;
        empty.hidden = matches.length > 0;
        input.setAttribute("aria-expanded", "true");
        highlightResult(-1);
        status.textContent = `${matches.length} matching members.`;
      };

      input.addEventListener("focus", openSearch);
      input.addEventListener("click", () => { if (popup.hidden) openSearch(); });
      input.addEventListener("input", openSearch);
      input.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          closeSearch();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (popup.hidden) openSearch();
          if (!matches.length) return;
          const index = highlighted < 0
            ? (event.key === "ArrowDown" ? 0 : matches.length - 1)
            : wrapIndex(highlighted + (event.key === "ArrowDown" ? 1 : -1), matches.length);
          highlightResult(index);
        } else if (event.key === "Enter" && !popup.hidden && matches.length) {
          event.preventDefault();
          chooseMember(matches[Math.max(0, highlighted)]);
        } else if (event.key === "Tab") {
          closeSearch();
        }
      });
      search.addEventListener("focusout", (event) => {
        if (!search.contains(event.relatedTarget)) closeSearch();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!search.contains(event.target)) closeSearch();
      });
      search.hidden = false;
    }

    previous?.addEventListener("click", () => selectRelative(-1));
    next?.addEventListener("click", () => selectRelative(1));

    cards.forEach((card, cardIndex) => {
      card.addEventListener("click", () => {
        const visiblePosition = getVisibleIndexes().indexOf(cardIndex);
        if (visiblePosition === -1 || visiblePosition === activeIndex) return;
        selectPosition(visiblePosition);
      });
    });

    dots.forEach((dot, dotIndex) => {
      dot.addEventListener("click", () => {
        const visiblePosition = getVisibleIndexes().indexOf(dotIndex);
        if (visiblePosition === -1) return;
        selectPosition(visiblePosition);
      });
    });

    filters.forEach((filter) => {
      filter.addEventListener("click", () => {
        activeGroup = filter.dataset.peopleFilter || "all";
        activeIndex = 0;
        rotationIndex = 0;
        filters.forEach((item) => {
          const isActive = item === filter;
          item.classList.toggle("is-active", isActive);
          item.setAttribute("aria-selected", String(isActive));
        });
        renderPeopleCarousel();
      });
    });

    peopleCarousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectRelative(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        selectRelative(1);
      }
    });

    stage?.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    stage?.addEventListener("touchend", (event) => {
      if (touchStartX === null) return;
      const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
      const distance = touchEndX - touchStartX;
      touchStartX = null;
      if (Math.abs(distance) < 42) return;
      selectRelative(distance > 0 ? -1 : 1);
    }, { passive: true });

    let resizeFrame;
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(renderPeopleCarousel);
    });

    renderPeopleCarousel();
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      peopleCarousel.classList.add("is-ready");
    }));
  });

  const peopleDirectories = Array.from(document.querySelectorAll("[data-people-directory]"));
  peopleDirectories.forEach((directory) => {
    const viewButtons = Array.from(directory.querySelectorAll("[data-people-view]"));
    const viewPanels = Array.from(directory.querySelectorAll("[data-people-view-panel]"));

    const showDirectoryView = (view) => {
      if (!viewButtons.some((button) => button.dataset.peopleView === view)) return;

      viewButtons.forEach((button) => {
        const isActive = button.dataset.peopleView === view;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        button.tabIndex = isActive ? 0 : -1;
      });

      viewPanels.forEach((panel) => {
        panel.hidden = panel.dataset.peopleViewPanel !== view;
      });

      window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    };

    const selectDirectoryView = (button) => {
      const view = button.dataset.peopleView;
      showDirectoryView(view);
      window.history.replaceState(window.history.state, "", `#${view}`);
    };

    viewButtons.forEach((button) => {
      button.addEventListener("click", () => selectDirectoryView(button));
      button.addEventListener("keydown", (event) => {
        const index = viewButtons.indexOf(button);
        const nextIndex = {
          ArrowLeft: (index - 1 + viewButtons.length) % viewButtons.length,
          ArrowRight: (index + 1) % viewButtons.length,
          Home: 0,
          End: viewButtons.length - 1,
        }[event.key];
        if (nextIndex === undefined) return;
        event.preventDefault();
        const nextButton = viewButtons[nextIndex];
        selectDirectoryView(nextButton);
        nextButton.focus();
      });
    });

    const showLinkedView = () => showDirectoryView(window.location.hash.slice(1) || "people");
    showDirectoryView("people");
    showLinkedView();
    window.addEventListener("hashchange", showLinkedView);
  });

  const publicationList = document.querySelector("[data-publication-list]");
  if (publicationList) {
    const publications = Array.from(publicationList.querySelectorAll("[data-publication]"));
    const yearGroups = Array.from(publicationList.querySelectorAll("[data-year-group]"));
    const search = document.querySelector("[data-pub-search]");
    const year = document.querySelector("[data-pub-year]");
    const kind = document.querySelector("[data-pub-kind]");
    const topic = document.querySelector("[data-pub-topic]");
    const count = document.querySelector("[data-pub-count]");
    const reset = document.querySelector("[data-pub-reset]");
    const empty = document.querySelector("[data-pub-empty]");

    const normalize = (value) => value.trim().toLowerCase();

    const applyPublicationFilters = () => {
      const query = normalize(search?.value || "");
      const selectedYear = year?.value || "";
      const selectedKind = kind?.value || "";
      const selectedTopic = topic?.value || "";
      let visible = 0;

      publications.forEach((item) => {
        const matchesSearch = !query || item.dataset.search.includes(query);
        const matchesYear = !selectedYear || item.dataset.year === selectedYear;
        const matchesKind = !selectedKind || item.dataset.kind === selectedKind;
        const matchesTopic = !selectedTopic || item.dataset.topic === selectedTopic;
        const show = matchesSearch && matchesYear && matchesKind && matchesTopic;
        item.hidden = !show;
        if (show) visible += 1;
      });

      yearGroups.forEach((group) => {
        group.hidden = !group.querySelector("[data-publication]:not([hidden])");
      });

      if (count) count.textContent = String(visible);
      if (empty) empty.hidden = visible !== 0;
    };

    [search, year, kind, topic].forEach((control) => {
      control?.addEventListener(control === search ? "input" : "change", applyPublicationFilters);
    });

    reset?.addEventListener("click", () => {
      if (search) search.value = "";
      if (year) year.value = "";
      if (kind) kind.value = "";
      if (topic) topic.value = "";
      window.history.replaceState({}, "", window.location.pathname);
      applyPublicationFilters();
    });

    const initialTopic = new URLSearchParams(window.location.search).get("topic");
    if (initialTopic && topic) {
      const matchingOption = Array.from(topic.options).find((option) => option.value === initialTopic);
      if (matchingOption) topic.value = matchingOption.value;
    }

    applyPublicationFilters();
  }

  const newsArchive = document.querySelector("[data-news-archive]");
  if (newsArchive) {
    const items = Array.from(newsArchive.querySelectorAll("[data-news-item]"));
    const year = newsArchive.querySelector("[data-news-year]");
    const category = newsArchive.querySelector("[data-news-category]");
    const count = newsArchive.querySelector("[data-news-count]");
    const reset = newsArchive.querySelector("[data-news-reset]");
    const empty = newsArchive.querySelector("[data-news-empty]");

    const applyNewsFilters = () => {
      const selectedYear = year?.value || "";
      const selectedCategory = category?.value || "";
      let visible = 0;

      items.forEach((item) => {
        const matchesYear = !selectedYear || item.dataset.year === selectedYear;
        const matchesCategory = !selectedCategory || item.dataset.category === selectedCategory;
        const show = matchesYear && matchesCategory;
        item.hidden = !show;
        if (show) visible += 1;
      });

      if (count) count.textContent = String(visible);
      if (empty) empty.hidden = visible !== 0;
    };

    [year, category].forEach((control) => control?.addEventListener("change", applyNewsFilters));

    reset?.addEventListener("click", () => {
      if (year) year.value = "";
      if (category) category.value = "";
      applyNewsFilters();
    });

    applyNewsFilters();
  }

  const researchSectionNav = document.querySelector("[data-research-section-nav]");
  if (researchSectionNav) {
    const researchLinks = Array.from(researchSectionNav.querySelectorAll("[data-research-section-link]"));
    const researchSections = researchLinks
      .map((link) => document.getElementById(link.dataset.researchSectionLink))
      .filter(Boolean);

    const setActiveResearchSection = (id) => {
      researchLinks.forEach((link) => {
        const isActive = link.dataset.researchSectionLink === id;
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    const initialSection = window.location.hash.slice(1) || researchSections[0]?.id;
    if (initialSection) setActiveResearchSection(initialSection);

    researchLinks.forEach((link) => {
      link.addEventListener("click", () => setActiveResearchSection(link.dataset.researchSectionLink));
    });

    if ("IntersectionObserver" in window) {
      const researchSectionObserver = new IntersectionObserver(
        (entries) => {
          const activeEntry = entries.find((entry) => entry.isIntersecting);
          if (activeEntry) setActiveResearchSection(activeEntry.target.id);
        },
        { rootMargin: "-35% 0px -55%", threshold: 0 },
      );
      researchSections.forEach((section) => researchSectionObserver.observe(section));
    }
  }

})();
