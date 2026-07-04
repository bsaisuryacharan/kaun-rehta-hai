const state = {
  records: [],
  filtered: [],
};

const els = {
  rollMeta: document.querySelector("#rollMeta"),
  results: document.querySelector("#results"),
  matchCount: document.querySelector("#matchCount"),
  houseCount: document.querySelector("#houseCount"),
  filterDialog: document.querySelector("#filterDialog"),
  filterBtn: document.querySelector("#filterBtn"),
  closeFiltersBtn: document.querySelector("#closeFiltersBtn"),
  applyFiltersBtn: document.querySelector("#applyFiltersBtn"),
  clearPopupBtn: document.querySelector("#clearPopupBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  houseSearch: document.querySelector("#houseSearch"),
  nameSearch: document.querySelector("#nameSearch"),
  voterIdSearch: document.querySelector("#voterIdSearch"),
  relativeSearch: document.querySelector("#relativeSearch"),
  genderFilter: document.querySelector("#genderFilter"),
  minAge: document.querySelector("#minAge"),
  maxAge: document.querySelector("#maxAge"),
};

const searchableInputs = [
  els.houseSearch,
  els.nameSearch,
  els.voterIdSearch,
  els.relativeSearch,
  els.genderFilter,
  els.minAge,
  els.maxAge,
];

function clean(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function text(value) {
  return String(value ?? "").trim();
}

function includesLoose(source, query) {
  const q = clean(query);
  if (!q) return true;
  return clean(source).includes(q);
}

function normalizeHouse(value) {
  return text(value)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\b(?:h\s*\.?\s*no|house\s*no|house\s*number)\b\.?/g, "")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^[,.:;-]+|[,.:;-]+$/g, "");
}

function sameHouseMatch(source, query) {
  const q = normalizeHouse(query);
  if (!q) return true;
  const normalized = normalizeHouse(source);

  if (q.includes("-") || q.includes("/")) {
    return normalized === q
      || normalized.startsWith(`${q}/`)
      || normalized.startsWith(`${q},`)
      || normalized.startsWith(`${q}plot`)
      || normalized.includes(`/${q}/`)
      || normalized.includes(`,${q},`);
  }

  return normalized.includes(q);
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
}

function groupByHouse(records) {
  const groups = new Map();
  for (const voter of records) {
    const house = text(voter["House Number"]) || "House number not listed";
    const key = clean(house) || house;
    if (!groups.has(key)) {
      groups.set(key, { house, voters: [] });
    }
    groups.get(key).voters.push(voter);
  }
  return [...groups.values()].sort((a, b) => a.house.localeCompare(b.house, undefined, { numeric: true }));
}

function readFilters() {
  return {
    house: els.houseSearch.value,
    name: els.nameSearch.value,
    voterId: els.voterIdSearch.value,
    relative: els.relativeSearch.value,
    gender: els.genderFilter.value,
    minAge: Number(els.minAge.value || 0),
    maxAge: Number(els.maxAge.value || 0),
  };
}

function matches(voter, filters) {
  const age = Number(voter.Age || 0);
  return sameHouseMatch(voter["House Number"], filters.house)
    && includesLoose(voter.Name, filters.name)
    && includesLoose(voter["Voter ID"], filters.voterId)
    && includesLoose(voter["Relative Name"], filters.relative)
    && (!filters.gender || voter.Gender === filters.gender)
    && (!filters.minAge || age >= filters.minAge)
    && (!filters.maxAge || age <= filters.maxAge);
}

function render() {
  const filters = readFilters();
  state.filtered = state.records.filter((voter) => matches(voter, filters));
  const groups = groupByHouse(state.filtered);

  els.matchCount.textContent = state.filtered.length.toLocaleString("en-IN");
  els.houseCount.textContent = groups.length.toLocaleString("en-IN");

  if (!state.records.length) {
    els.results.innerHTML = `<div class="empty">No voter data loaded.</div>`;
    return;
  }

  if (!state.filtered.length) {
    els.results.innerHTML = `<div class="empty">No matching voters found. Try a shorter house number or clear one filter.</div>`;
    return;
  }

  els.results.innerHTML = groups.map((group) => `
      <article class="house-card">
        <header class="house-head">
          <div class="house-number">${escapeHtml(group.house)}</div>
          <div class="resident-count">${group.voters.length.toLocaleString("en-IN")} resident${group.voters.length === 1 ? "" : "s"}</div>
        </header>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Voter ID</th>
                <th>Relation</th>
                <th>Relative Name</th>
                <th>Age</th>
                <th>Gender</th>
              </tr>
            </thead>
            <tbody>
              ${group.voters.map((voter) => `
                <tr>
                  <td>${escapeHtml(voter.Name)}</td>
                  <td class="mono">${escapeHtml(voter["Voter ID"])}</td>
                  <td class="muted">${escapeHtml(voter.Relation)}</td>
                  <td>${escapeHtml(voter["Relative Name"])}</td>
                  <td>${escapeHtml(voter.Age)}</td>
                  <td>${escapeHtml(voter.Gender)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `).join("");
}

function clearFilters() {
  for (const input of searchableInputs) input.value = "";
  els.houseSearch.focus();
  render();
}

function openFilters() {
  els.filterDialog.hidden = false;
  els.nameSearch.focus();
}

function closeFilters() {
  els.filterDialog.hidden = true;
  els.filterBtn.focus();
}

function clearPopupFilters() {
  for (const input of searchableInputs.filter((item) => item !== els.houseSearch)) {
    input.value = "";
  }
  render();
}

async function init() {
  const payload = window.VOTER_DATA || await fetch("data.json").then((response) => response.json());
  state.records = payload.records || [];
  const meta = payload.meta || {};
  const place = [meta["Assembly Constituency"], meta["Polling Station"]].filter(Boolean).join(" • ");
  const published = meta["Date of Publication"] ? `Published ${meta["Date of Publication"]}` : "";
  els.rollMeta.textContent = [place, `${state.records.length.toLocaleString("en-IN")} voters`, published].filter(Boolean).join(" • ");
  render();
}

for (const input of searchableInputs) {
  input.addEventListener("input", render);
}
els.clearBtn.addEventListener("click", clearFilters);
els.filterBtn.addEventListener("click", openFilters);
els.closeFiltersBtn.addEventListener("click", closeFilters);
els.applyFiltersBtn.addEventListener("click", closeFilters);
els.clearPopupBtn.addEventListener("click", clearPopupFilters);
els.filterDialog.addEventListener("click", (event) => {
  if (event.target === els.filterDialog) closeFilters();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.filterDialog.hidden) closeFilters();
});

init().catch((error) => {
  console.error(error);
  els.rollMeta.textContent = "Could not load voter data.";
  els.results.innerHTML = `<div class="empty">Could not load voter data. Open this through a local or hosted web server.</div>`;
});
