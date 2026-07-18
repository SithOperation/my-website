(function () {
  "use strict";
  const state = { items: [], category: "all", query: "" };
  const grid = document.querySelector("#resource-grid");
  const filters = document.querySelector("#resource-filters");
  const count = document.querySelector("#resource-count");
  const detail = document.querySelector("#resource-detail");
  const status = document.querySelector("#resource-status");
  const search = document.querySelector("#resource-search");
  const titleCase = value => value.replaceAll("-", " ").replace(/\b\w/g, letter => letter.toUpperCase());
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  function resourceLink(label, path) { const link = element("a", "", label); link.href = `../${path}`; link.target = "_blank"; link.rel = "noopener noreferrer"; return link; }
  function renderFilters() {
    filters.replaceChildren();
    ["all", ...new Set(state.items.map(item => item.category))].forEach(category => {
      const button = element("button", "", titleCase(category)); button.type = "button"; button.setAttribute("aria-pressed", String(category === state.category));
      button.addEventListener("click", () => { state.category = category; renderFilters(); renderCards(); }); filters.append(button);
    });
  }
  function matches(item) { return (state.category === "all" || item.category === state.category) && item.search_text.includes(state.query); }
  function renderCards() {
    const items = state.items.filter(matches); grid.replaceChildren(); count.textContent = `${items.length} of ${state.items.length} resources`;
    items.forEach(item => {
      const card = element("article", "resource-card"); card.dataset.status = item.status;
      const meta = element("div", "resource-card__meta"); meta.append(element("span", "", titleCase(item.category)), element("span", "", item.status === "published" ? `v${item.version}` : "Planned"));
      const heading = element("h2", "", item.title); const description = element("p", "", item.short_description);
      const tags = element("p", "resource-card__tags", item.tags.slice(0, 3).map(tag => `#${tag}`).join("  "));
      const button = element("button", "", "View resource →"); button.type = "button"; button.addEventListener("click", () => showDetail(item));
      card.append(meta, heading, description, tags, button); grid.append(card);
    });
    status.hidden = items.length > 0; status.textContent = items.length ? "" : "No resources match this search.";
  }
  function showDetail(item) {
    detail.replaceChildren(); detail.hidden = false;
    const head = element("div", "resource-detail__head"); const names = element("div"); names.append(element("p", "section-kicker", `${titleCase(item.category)} / ${item.status}`), element("h2", "", item.title));
    const close = element("button", "detail-close", "Close"); close.type = "button"; close.addEventListener("click", () => { detail.hidden = true; detail.replaceChildren(); history.replaceState(null, "", location.pathname); }); head.append(names, close);
    const summary = element("p", "", item.short_description); const actions = element("div", "download-actions");
    if (item.status === "published") { actions.append(resourceLink("Printable PDF", item.assets.printable_pdf), resourceLink("Fillable PDF", item.assets.fillable_pdf), resourceLink("Original SVG", item.assets.diagram_svg)); }
    else actions.append(element("span", "resource-status", "Downloads will be added after prototype approval."));
    const columns = element("div", "detail-columns"); const usage = element("div"); usage.append(element("h3", "", "Purpose"), element("p", "", item.purpose), element("h3", "", "When to use it"), element("p", "", item.when_to_use), element("h3", "", "Instructions"));
    const instructionList = element("ol"); item.instructions.forEach(text => instructionList.append(element("li", "", text))); usage.append(instructionList);
    const provenance = element("div"); provenance.append(element("h3", "", "Framework alignment"), element("p", "", item.framework_alignment.join("; ")), element("h3", "", "Version and review"), element("p", "", `Version ${item.version} · Last reviewed ${item.last_reviewed}`), element("h3", "", "Notice"), element("p", "", item.disclaimer));
    if (item.official_sources.length) { const sourceHeading = element("h3", "", "Official sources"); const sourceList = element("ul", "official-links"); item.official_sources.forEach(source => { const li = element("li"); const link = element("a", "", source.title); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; li.append(link); sourceList.append(li); }); provenance.append(sourceHeading, sourceList); }
    columns.append(usage, provenance); detail.append(head, summary, actions, columns); history.replaceState(null, "", `?resource=${encodeURIComponent(item.slug)}`); detail.scrollIntoView({ behavior: "smooth", block: "start" }); close.focus();
  }
  search.addEventListener("input", event => { state.query = event.target.value.trim().toLowerCase(); renderCards(); });
  fetch("../data/resource-library/resources.json", { headers: { Accept: "application/json" } }).then(response => { if (!response.ok) throw new Error(`Catalog unavailable (${response.status})`); return response.json(); }).then(data => {
    state.items = data.resources.map(item => ({ ...item, search_text: [item.title, item.short_description, item.category, ...item.tags, ...item.search_keywords].join(" ").toLowerCase() })); renderFilters(); renderCards();
    const selected = new URLSearchParams(location.search).get("resource"); const item = state.items.find(candidate => candidate.slug === selected); if (item) showDetail(item);
  }).catch(error => { console.error(error); status.hidden = false; status.textContent = "The resource catalog could not be loaded. Serve this site through a local HTTP server and try again."; });
}());
