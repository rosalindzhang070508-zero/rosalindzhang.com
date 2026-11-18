(() => {
  const page = document.body.dataset.route || "home";
  const map = document.getElementById("routeMap");
  const live = document.getElementById("routeLive");
  const toggles = [...document.querySelectorAll("[data-route-map-toggle]")];
  const close = map?.querySelector("[data-route-map-close]");
  const visitedKey = "rosalind-route-visited";

  const readVisited = () => {
    try { return new Set(JSON.parse(localStorage.getItem(visitedKey) || "[]")); }
    catch { return new Set(); }
  };
  const visited = readVisited();
  visited.add(page);
  try { localStorage.setItem(visitedKey, JSON.stringify([...visited])); } catch {}

  document.querySelectorAll("[data-route]").forEach((item) => {
    const route = item.dataset.route;
    item.dataset.routeActive = String(route === page);
    if (visited.has(route)) item.classList.add("is-visited");
  });

  const openMap = () => {
    if (!map) return;
    map.showModal();
    live && (live.textContent = "Route map opened.");
    map.querySelector("a, button")?.focus();
  };
  const closeMap = () => {
    if (!map?.open) return;
    map.close();
    live && (live.textContent = "Route map closed.");
  };
  toggles.forEach((toggle) => toggle.addEventListener("click", openMap));
  close?.addEventListener("click", closeMap);
  map?.addEventListener("click", (event) => {
    if (event.target === map) closeMap();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "m" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const tag = document.activeElement?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        event.preventDefault();
        map?.open ? closeMap() : openMap();
      }
    }
    if (event.key === "Escape") closeMap();
  });

  document.querySelectorAll("a[data-route-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank") return;
      const href = link.getAttribute("href");
      if (!href || !href.endsWith(".html")) return;
      event.preventDefault();
      document.body.classList.add("route-leaving");
      window.setTimeout(() => { window.location.href = href; }, 130);
    });
  });

  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible"));
  }, { threshold: 0.12 }) : null;
  document.querySelectorAll("[data-reveal]").forEach((element) => observer ? observer.observe(element) : element.classList.add("is-visible"));
})();
