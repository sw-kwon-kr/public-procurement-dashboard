const ITEM_OPTIONS = [
  { code: "5512190301", name: "안내전광판" },
  { code: "5512190302", name: "기상전광판" },
  { code: "5512190303", name: "교통정보전광판" },
];

const state = {
  rows: [],
  selectedItem: ITEM_OPTIONS[0].name,
  metric: "amount",
  chartView: "tiles",
  selectedCompany: null,
  dateFrom: "",
  dateTo: "",
  search: "",
  procurementFilter: "all",
  contractMethod: "all",
};

const els = {
  itemSelect: document.querySelector("#itemSelect"),
  fileName: document.querySelector("#fileName"),
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  companySearch: document.querySelector("#companySearch"),
  metricSelect: document.querySelector("#metricSelect"),
  procurementFilter: document.querySelector("#procurementFilter"),
  contractMethod: document.querySelector("#contractMethod"),
  summaryGrid: document.querySelector("#summaryGrid"),
  treemap: document.querySelector("#treemap"),
  companyList: document.querySelector("#companyList"),
  tileView: document.querySelector("#tileView"),
  listView: document.querySelector("#listView"),
  chartTitle: document.querySelector("#chartTitle"),
  chartSubTitle: document.querySelector("#chartSubTitle"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSubTitle: document.querySelector("#detailSubTitle"),
  detailRows: document.querySelector("#detailRows"),
  companyStats: document.querySelector("#companyStats"),
  resetSelection: document.querySelector("#resetSelection"),
  themeSelect: document.querySelector("#themeSelect"),
};

function applyTheme(value, persist = true) {
  const theme = value === "dark" ? "dark" : "light";
  if (document.documentElement) document.documentElement.dataset.theme = theme;
  els.themeSelect.value = theme;
  if (persist) {
    try { window.localStorage.setItem("procurement-theme", theme); } catch {}
  }
}
applyTheme(document.documentElement?.dataset.theme, false);
els.themeSelect.addEventListener("change", () => applyTheme(els.themeSelect.value));
window.addEventListener("storage", event => {
  if (event.key === "procurement-theme" || event.key === null) applyTheme(event.newValue, false);
});

function toNumber(value) {
  const numeric = String(value ?? "0").replace(/,/g, "").replace(/[^0-9.-]/g, "");
  return Number(numeric || 0);
}

function toDateInput(value) {
  const s = String(value ?? "").replace(/[^0-9]/g, "");
  if (s.length !== 8) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function formatWon(value) {
  if (value >= 100000000) return `${(value / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString("ko-KR")}만`;
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatFullWon(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function isTruthyFlag(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return ["Y", "YES", "TRUE", "1", "우수", "우수제품", "해당"].includes(normalized);
}

function isExcellentProcurement(row) {
  return isTruthyFlag(row["우수제품여부"]);
}

function isMasContract(row) {
  return isTruthyFlag(row["MAS여부"]);
}

function isFinalContract(row) {
  const value = String(row["최종계약(납품요구)여부"] ?? "").trim().toUpperCase();
  return !value || value === "Y" || value === "YES" || value === "TRUE" || value === "1";
}

function isInnovationProduct(row) {
  return row._innovation === true || row["자료구분"] === "혁신제품";
}

function matchesProcurementType(row) {
  switch (state.procurementFilter) {
    case "excellent": return isExcellentProcurement(row);
    case "mas": return isMasContract(row);
    case "innovation": return isInnovationProduct(row);
    case "general": return !isExcellentProcurement(row) && !isMasContract(row) && !isInnovationProduct(row);
    default: return true;
  }
}

function formatDate(value) {
  const date = toDateInput(value);
  return date || "-";
}

function uniqueContractRows(rows) {
  return ProcurementData.merge(rows).rows;
}

function filteredRows() {
  return state.rows.filter(row => {
    const date = toDateInput(row["계약(납품요구)일자"]);
    const item = ITEM_OPTIONS.find(option => option.name === state.selectedItem);
    const matchesItem = row["세부품명"] === state.selectedItem || row["세부품명번호"] === item?.code;
    const afterStart = !state.dateFrom || date >= state.dateFrom;
    const beforeEnd = !state.dateTo || date <= state.dateTo;
    const matchesSearch = !state.search || row["업체명"].toLowerCase().includes(state.search.toLowerCase());
    const matchesMethod = state.contractMethod === "all" || String(row["계약방법"] || "").trim() === state.contractMethod;
    return isFinalContract(row) && matchesItem && afterStart && beforeEnd && matchesSearch && matchesProcurementType(row) && matchesMethod;
  });
}

function aggregate(rows) {
  const map = new Map();
  rows.forEach(row => {
    const company = row["업체명"];
    const companyKey = ProcurementData.companyKey(row);
    const current = map.get(companyKey) ?? { company, companyKey, count: 0, amount: 0, rows: [] };
    current.count += 1;
    current.amount += toNumber(row["공급금액"]);
    current.rows.push(row);
    map.set(companyKey, current);
  });
  const key = state.metric === "amount" ? "amount" : "count";
  return [...map.values()].sort((a, b) => b[key] - a[key] || b.amount - a.amount);
}


function setInitialDates() {
  const dates = state.rows.map(row => toDateInput(row["계약(납품요구)일자"])).filter(Boolean).sort();
  if (!dates.length) return;
  state.dateFrom = dates[0];
  state.dateTo = dates[dates.length - 1];
  els.dateFrom.value = state.dateFrom;
  els.dateTo.value = state.dateTo;
}

function renderSummary(rows, grouped) {
  const totalAmount = rows.reduce((sum, row) => sum + toNumber(row["공급금액"]), 0);
  const top = grouped[0];
  const cards = [
    ["총 계약금액", formatFullWon(totalAmount)],
    ["계약건수", `${rows.length.toLocaleString("ko-KR")}건`],
    ["계약업체", `${grouped.length.toLocaleString("ko-KR")}개`],
    [state.metric === "amount" ? "1위 계약금액 업체" : "1위 계약건수 업체", top ? top.company : "-"],
  ];
  els.summaryGrid.innerHTML = cards.map(([label, value]) => `<article class="summaryCard"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function layoutTreemap(items, x, y, w, h) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const half = total / 2;
  let running = 0;
  let split = 1;
  for (let i = 0; i < items.length - 1; i += 1) {
    const next = running + items[i].value;
    if (i > 0 && Math.abs(half - running) <= Math.abs(half - next)) break;
    running = next;
    split = i + 1;
  }
  split = Math.max(1, Math.min(split, items.length - 1));
  const first = items.slice(0, split);
  const second = items.slice(split);
  const firstValue = first.reduce((acc, item) => acc + item.value, 0);
  const ratio = total ? firstValue / total : 0.5;
  if (w >= h) {
    const w1 = w * ratio;
    return [...layoutTreemap(first, x, y, w1, h), ...layoutTreemap(second, x + w1, y, w - w1, h)];
  }
  const h1 = h * ratio;
  return [...layoutTreemap(first, x, y, w, h1), ...layoutTreemap(second, x, y + h1, w, h - h1)];
}

function colorFor(index, total) {
  const palette = ["#2563eb", "#0f766e", "#7c3aed", "#b45309", "#1d4ed8", "#be123c", "#047857", "#475569"];
  const color = palette[index % palette.length];
  const fade = Math.min(0.18, index / Math.max(total, 1) * 0.18);
  return mix(color, "#64748b", fade);
}

function mix(hexA, hexB, weight) {
  const a = hexA.match(/\w\w/g).map(x => parseInt(x, 16));
  const b = hexB.match(/\w\w/g).map(x => parseInt(x, 16));
  return `rgb(${a.map((v, i) => Math.round(v * (1 - weight) + b[i] * weight)).join(",")})`;
}

function renderTreemap(grouped) {
  const key = state.metric === "amount" ? "amount" : "count";
  const total = grouped.reduce((sum, item) => sum + item[key], 0);
  const width = els.treemap.clientWidth || 900;
  const height = els.treemap.clientHeight || 560;
  const topItems = grouped.slice(0, 80).map(item => ({ ...item, value: Math.max(item[key], 1) }));
  const boxes = layoutTreemap(topItems, 0, 0, width, height);
  if (!boxes.length) {
    els.treemap.innerHTML = `<div class="notice">조건에 맞는 계약 자료가 없습니다.</div>`;
    return;
  }
  els.treemap.innerHTML = boxes.map((box, index) => {
    const area = box.w * box.h;
    const tiny = area < 5200;
    const displayValue = state.metric === "amount" ? formatWon(box.amount) : `${box.count.toLocaleString("ko-KR")}건`;
    const share = total ? `${(box[key] / total * 100).toFixed(1)}%` : "0%";
    const fontSize = Math.max(11, Math.min(25, Math.sqrt(area) / 8));
    return `<button class="tile ${tiny ? "tileTiny" : ""} ${state.selectedCompany === box.companyKey ? "selected" : ""}"
      style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;background:${colorFor(index, boxes.length)};font-size:${fontSize}px"
      title="${escapeAttr(box.company)} ${displayValue}" data-company="${escapeAttr(box.companyKey)}">
      <span class="tileCompany">${box.company}</span>
      <span class="tileValue">${displayValue}</span>
      <span class="tileMeta">${box.count.toLocaleString("ko-KR")}건 · ${share}</span>
    </button>`;
  }).join("");
}

function renderCompanyList(grouped) {
  const key = state.metric === "amount" ? "amount" : "count";
  const maximum = Math.max(0, ...grouped.map(item => item[key]));
  if (!grouped.length) {
    els.companyList.innerHTML = '<li class="listEmpty">조건에 맞는 계약 자료가 없습니다.</li>';
    return;
  }
  els.companyList.innerHTML = grouped.map((item, index) => {
    const width = maximum ? Math.max(0, item[key] / maximum * 100) : 0;
    const selected = state.selectedCompany === item.companyKey;
    const primary = state.metric === "amount" ? formatFullWon(item.amount) : item.count.toLocaleString("ko-KR") + "건";
    const secondary = state.metric === "amount" ? item.count.toLocaleString("ko-KR") + "건" : formatFullWon(item.amount);
    return `<li><button type="button" class="barRow ${selected ? "selected" : ""}" data-company="${escapeAttr(item.companyKey)}" aria-pressed="${selected}">
      <span class="barRank">${index + 1}</span>
      <span class="barCompany">${escapeAttr(item.company)}</span>
      <span class="barTrack" aria-hidden="true"><span class="barFill" style="width:${width}%;background:${colorFor(index, grouped.length)}"></span></span>
      <span class="barValues"><strong>${primary}</strong><span>${secondary}</span></span>
    </button></li>`;
  }).join("");
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderDetails(grouped) {
  const selected = grouped.find(item => item.companyKey === state.selectedCompany);
  if (!selected) {
    els.detailTitle.textContent = "업체 상세";
    els.detailSubTitle.textContent = "업체를 선택하세요";
    els.companyStats.innerHTML = "";
    els.detailRows.innerHTML = `<tr><td colspan="9" class="empty">선택된 업체가 없습니다.</td></tr>`;
    return;
  }
  els.detailTitle.textContent = selected.company;
  const detailRows = uniqueContractRows(selected.rows);
  const duplicateCount = selected.rows.length - detailRows.length;
  els.detailSubTitle.textContent = `${state.selectedItem} · ${detailRows.length.toLocaleString("ko-KR")}건${duplicateCount ? ` · 중복 ${duplicateCount.toLocaleString("ko-KR")}건 제외` : ""}`;
  els.companyStats.innerHTML = [
    ["계약금액", formatFullWon(selected.amount)],
    ["계약건수", `${selected.count.toLocaleString("ko-KR")}건`],
    ["평균 계약금액", formatFullWon(selected.amount / Math.max(selected.count, 1))],
  ].map(([label, value]) => `<div class="companyStat"><span>${label}</span><strong>${value}</strong></div>`).join("");
  els.detailRows.innerHTML = detailRows
    .slice()
    .sort((a, b) => toDateInput(b["계약(납품요구)일자"]).localeCompare(toDateInput(a["계약(납품요구)일자"])) || toNumber(b["공급금액"]) - toNumber(a["공급금액"]))
    .map(row => {
      const itemIdentity = [row["물품식별번호"], row["품목명"]].filter(Boolean).join(" / ");
      const methodType = [row["조달방식"], row["계약구분"], row["계약방법"]].filter(Boolean).join(" / ");
      return `<tr>
        <td>${formatDate(row["계약(납품요구)일자"])}</td>
        <td>${row["조달방식"] || "-"}</td>
        <td>${row["세부품명"] || "-"}</td>
        <td>${itemIdentity || "-"}</td>
        <td>${methodType || "-"}</td>
        <td>${row["업체명"] || "-"}</td>
        <td>${row["수요기관"] || "-"}</td>
        <td>${row["계약(납품요구)명"] || "-"}</td>
        <td class="amountCell">${formatFullWon(toNumber(row["공급금액"]))}</td>
      </tr>`;
    }).join("");
}
function render() {
  const rows = uniqueContractRows(filteredRows());
  const grouped = aggregate(rows);
  const metricLabel = state.metric === "amount" ? "계약금액" : "계약건수";
  els.chartTitle.textContent = `${state.selectedItem} 업체별 ${metricLabel}`;
  const filterLabels = { all: "전체", excellent: "우수조달", mas: "MAS", innovation: "혁신제품", general: "일반" };
  const activeFilter = filterLabels[state.procurementFilter] || "";
  const displayLabel = state.chartView === "list" ? metricLabel + (state.metric === "amount" ? " 높은 순" : " 많은 순") : metricLabel + " 기준 면적 표시";
  const methodLabel = state.contractMethod === "all" ? "" : state.contractMethod + " · ";
  els.chartSubTitle.textContent = `${state.dateFrom || "전체"} ~ ${state.dateTo || "전체"} · ${activeFilter ? `${activeFilter} · ` : ""}${methodLabel}${displayLabel}`;
  renderSummary(rows, grouped);
  els.treemap.hidden = state.chartView !== "tiles";
  els.companyList.hidden = state.chartView !== "list";
  els.tileView.checked = state.chartView === "tiles";
  els.listView.checked = state.chartView === "list";
  if (state.chartView === "list") renderCompanyList(grouped);
  else renderTreemap(grouped);
  renderDetails(grouped);
}

async function loadPublishedData() {
  try {
    const response = await fetch("./data/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("게시 자료를 불러오지 못했습니다.");
    const manifest = await response.json();
    if (manifest.schemaVersion !== 1 || !/^[a-f0-9]{20}$/.test(manifest.version)) throw new Error("지원하지 않는 데이터 버전입니다.");
    const res = await fetch("./data/contracts.json?v=" + manifest.version, { cache: "no-store" });
    if (!res.ok) throw new Error("게시 데이터를 읽지 못했습니다.");
    const buffer = await res.arrayBuffer();
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), b => b.toString(16).padStart(2, "0")).join("");
    if (checksum !== manifest.dataSha256) throw new Error("데이터 배포 중입니다. 잠시 후 새로고침하세요.");
    state.rows = JSON.parse(new TextDecoder().decode(buffer));
    const summary = ProcurementData.summarize(state.rows);
    if (summary.count !== manifest.summary.count || summary.amount !== manifest.summary.amount) throw new Error("게시 집계 검증 실패");
    els.fileName.textContent = "게시 자료 · " + summary.count.toLocaleString("ko-KR") + "건";
    document.querySelector("#publishedAt").textContent = new Date(manifest.publishedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    document.querySelector("#datasetPeriod").textContent = summary.from + " ~ " + summary.to;
    document.querySelector("#validationInfo").textContent = "중복 " + (manifest.validation?.duplicates || 0) + "건 정리 · 혁신 최종금액 " + (manifest.validation?.adjustedInnovationContracts || 0) + "건 반영";
    document.querySelector("#dataStatus").textContent = "게시 검증 완료";
    state.selectedCompany = null;
    setInitialDates();
    render();
  } catch (error) {
    els.fileName.textContent = "자료 로딩 실패";
    els.treemap.textContent = error.message;
    document.querySelector("#dataStatus").textContent = "게시 자료 확인 실패";
  }
}
els.itemSelect.addEventListener("change", () => { state.selectedItem = els.itemSelect.value; state.selectedCompany = null; render(); });
els.metricSelect.addEventListener("change", () => { state.metric = els.metricSelect.value; state.selectedCompany = null; render(); });
els.tileView.addEventListener("change", () => { state.chartView = "tiles"; render(); });
els.listView.addEventListener("change", () => { state.chartView = "list"; render(); });

els.dateFrom.addEventListener("change", () => { state.dateFrom = els.dateFrom.value; state.selectedCompany = null; render(); });
els.dateTo.addEventListener("change", () => { state.dateTo = els.dateTo.value; state.selectedCompany = null; render(); });
els.companySearch.addEventListener("input", () => { state.search = els.companySearch.value.trim(); state.selectedCompany = null; render(); });
els.procurementFilter.addEventListener("change", () => { state.procurementFilter = els.procurementFilter.value; state.selectedCompany = null; render(); });
els.contractMethod.addEventListener("change", () => { state.contractMethod = els.contractMethod.value; state.selectedCompany = null; render(); });
els.resetSelection.addEventListener("click", () => { state.selectedCompany = null; render(); });
function selectCompany(event) {
  const target = event.target.closest("[data-company]");
  if (!target) return;
  state.selectedCompany = target.dataset.company;
  render();
}
els.treemap.addEventListener("click", selectCompany);
els.companyList.addEventListener("click", selectCompany);
window.addEventListener("resize", () => render());
loadPublishedData();

