const ITEM_OPTIONS = [
  { code: "5512190301", name: "안내전광판" },
  { code: "5512190302", name: "기상전광판" },
  { code: "5512190303", name: "교통정보전광판" },
];

const state = {
  rows: [],
  sourceName: "sample-procurement.csv",
  selectedItem: ITEM_OPTIONS[0].name,
  metric: "amount",
  selectedCompany: null,
  dateFrom: "",
  dateTo: "",
  search: "",
  procurementFilter: "all",
};

const els = {
  itemSelect: document.querySelector("#itemSelect"),
  csvFile: document.querySelector("#csvFile"),
  fileName: document.querySelector("#fileName"),
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  companySearch: document.querySelector("#companySearch"),
  metricSelect: document.querySelector("#metricSelect"),
  procurementFilter: document.querySelector("#procurementFilter"),
  summaryGrid: document.querySelector("#summaryGrid"),
  treemap: document.querySelector("#treemap"),
  chartTitle: document.querySelector("#chartTitle"),
  chartSubTitle: document.querySelector("#chartSubTitle"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSubTitle: document.querySelector("#detailSubTitle"),
  detailRows: document.querySelector("#detailRows"),
  companyStats: document.querySelector("#companyStats"),
  resetSelection: document.querySelector("#resetSelection"),
};

function parseTable(text, sourceName = "") {
  const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).filter(Boolean);
  const headerIndex = lines.findIndex(line => (line.includes("세부품명번호") || line.includes("물품분류번호")) && (line.includes("공급금액") || line.includes("계약(납품요구)금액")));
  if (headerIndex < 0) throw new Error(`${sourceName || "CSV"}에서 분석 가능한 헤더를 찾지 못했습니다.`);
  const delimiter = lines[headerIndex].includes("\t") ? "\t" : ",";
  const headers = parseDelimitedLine(lines[headerIndex], delimiter).map(cleanCell);
  return lines.slice(headerIndex + 1).map(line => {
    const cells = parseDelimitedLine(line, delimiter);
    const row = headers.reduce((acc, key, index) => {
      acc[key] = cleanCell(cells[index] ?? "");
      return acc;
    }, {});
    return normalizeRow(row, sourceName);
  }).filter(row => row["업체명"] && isTargetItem(row));
}

function normalizeRow(row, sourceName) {
  const inferred = inferItem(row);
  return {
    ...row,
    "세부품명번호": row["세부품명번호"] || inferred?.code || row["물품분류번호"] || "",
    "세부품명": row["세부품명"] || inferred?.name || row["품명"] || "",
    "공급금액": row["공급금액"] || row["계약(납품요구)금액"] || "0",
    "계약(납품요구)명": row["계약(납품요구)명"] || row["계약명"] || "",
    "최종계약(납품요구)여부": row["최종계약(납품요구)여부"] || "Y",
    "자료구분": sourceName?.includes("혁신") || sourceName?.toLowerCase().includes("innovation") ? "혁신제품" : "특정품목",
    "원본파일": sourceName || "업로드 CSV",
  };
}

function inferItem(row) {
  const text = [row["세부품명"], row["품명"], row["품목명"], row["계약명"], row["계약(납품요구)명"]].filter(Boolean).join(" ");
  return ITEM_OPTIONS.find(option => text.includes(option.name));
}

function isTargetItem(row) {
  return ITEM_OPTIONS.some(option => row["세부품명번호"] === option.code || row["세부품명"] === option.name);
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += ch;
    }
  }
  cells.push(value);
  return cells;
}

function cleanCell(value) {
  return String(value ?? "").trim().replace(/^"|"$/g, "").trim();
}

function decodeCsv(buffer) {
  const bytes = new Uint8Array(buffer);
  const hasUtf16Bom = bytes[0] === 0xff && bytes[1] === 0xfe;
  const likelyUtf16 = hasUtf16Bom || bytes.slice(0, 80).filter((_, index) => index % 2 === 1 && bytes[index] === 0).length > 10;
  const decoder = new TextDecoder(likelyUtf16 ? "utf-16le" : "utf-8");
  return decoder.decode(buffer);
}

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
  return normalized === "Y" || normalized === "YES" || normalized === "TRUE" || normalized === "1" || normalized.includes("우수") || normalized.includes("해당");
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

function formatDate(value) {
  const date = toDateInput(value);
  return date || "-";
}

function uniqueContractRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const itemIdentity = [row["물품식별번호"], row["품목명"]].filter(Boolean).join(" / ");
    const methodType = [row["조달방식"], row["계약구분"], row["계약방법"]].filter(Boolean).join(" / ");
    const key = [
      formatDate(row["계약(납품요구)일자"]),
      row["조달방식"],
      row["세부품명"],
      itemIdentity,
      methodType,
      row["업체명"],
      row["수요기관"],
      row["계약(납품요구)명"],
      toNumber(row["공급금액"]),
    ].join("\u001f");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filteredRows() {
  return state.rows.filter(row => {
    const date = toDateInput(row["계약(납품요구)일자"]);
    const item = ITEM_OPTIONS.find(option => option.name === state.selectedItem);
    const matchesItem = row["세부품명"] === state.selectedItem || row["세부품명번호"] === item?.code;
    const afterStart = !state.dateFrom || date >= state.dateFrom;
    const beforeEnd = !state.dateTo || date <= state.dateTo;
    const matchesSearch = !state.search || row["업체명"].toLowerCase().includes(state.search.toLowerCase());
    const matchesExcellent = state.procurementFilter !== "excellent" || isExcellentProcurement(row);
    const matchesMas = state.procurementFilter !== "mas" || isMasContract(row);
    return isFinalContract(row) && matchesItem && afterStart && beforeEnd && matchesSearch && matchesExcellent && matchesMas;
  });
}

function aggregate(rows) {
  const map = new Map();
  rows.forEach(row => {
    const company = row["업체명"];
    const current = map.get(company) ?? { company, count: 0, amount: 0, rows: [] };
    current.count += 1;
    current.amount += toNumber(row["공급금액"]);
    current.rows.push(row);
    map.set(company, current);
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
    ["참여 업체", `${grouped.length.toLocaleString("ko-KR")}개`],
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
    return `<button class="tile ${tiny ? "tileTiny" : ""} ${state.selectedCompany === box.company ? "selected" : ""}"
      style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;background:${colorFor(index, boxes.length)};font-size:${fontSize}px"
      title="${box.company} ${displayValue}" data-company="${escapeAttr(box.company)}">
      <span class="tileCompany">${box.company}</span>
      <span class="tileValue">${displayValue}</span>
      <span class="tileMeta">${box.count.toLocaleString("ko-KR")}건 · ${share}</span>
    </button>`;
  }).join("");
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderDetails(grouped) {
  const selected = grouped.find(item => item.company === state.selectedCompany);
  if (!selected) {
    els.detailTitle.textContent = "업체 상세";
    els.detailSubTitle.textContent = "업체 타일을 선택하세요";
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
  const filterLabels = { all: "", excellent: "우수조달", mas: "MAS" };
  const activeFilter = filterLabels[state.procurementFilter] || "";
  els.chartSubTitle.textContent = `${state.dateFrom || "전체"} ~ ${state.dateTo || "전체"} · ${activeFilter ? `${activeFilter} · ` : ""}${metricLabel} 기준 면적 표시`;
  renderSummary(rows, grouped);
  renderTreemap(grouped);
  renderDetails(grouped);
}

async function loadSample() {
  const samples = [
    "./data/sample-procurement.csv",
    "./data/sample-innovation.csv",
  ];
  try {
    const loaded = [];
    for (const url of samples) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      const name = url.split("/").pop();
      loaded.push(...parseTable(decodeCsv(buffer), name));
    }
    if (!loaded.length) throw new Error("샘플 CSV를 불러오지 못했습니다.");
    state.rows = loaded;
    state.sourceName = "기본 샘플 2개";
    state.selectedCompany = null;
    setInitialDates();
    els.fileName.textContent = `${state.sourceName} · ${state.rows.length.toLocaleString("ko-KR")}행`;
    render();
  } catch (error) {
    els.fileName.textContent = "CSV를 업로드하세요";
    els.treemap.innerHTML = `<div class="notice">${error.message}</div>`;
  }
}

els.csvFile.addEventListener("change", async event => {
  const files = [...(event.target.files || [])];
  if (!files.length) return;
  const loaded = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    loaded.push(...parseTable(decodeCsv(buffer), file.name));
  }
  state.rows = loaded;
  state.sourceName = files.length === 1 ? files[0].name : `${files.length.toLocaleString("ko-KR")}개 CSV`;
  state.selectedCompany = null;
  setInitialDates();
  els.fileName.textContent = `${state.sourceName} · ${state.rows.length.toLocaleString("ko-KR")}행`;
  render();
});
els.itemSelect.addEventListener("change", () => { state.selectedItem = els.itemSelect.value; state.selectedCompany = null; render(); });
els.metricSelect.addEventListener("change", () => { state.metric = els.metricSelect.value; state.selectedCompany = null; render(); });

els.dateFrom.addEventListener("change", () => { state.dateFrom = els.dateFrom.value; state.selectedCompany = null; render(); });
els.dateTo.addEventListener("change", () => { state.dateTo = els.dateTo.value; state.selectedCompany = null; render(); });
els.companySearch.addEventListener("input", () => { state.search = els.companySearch.value.trim(); state.selectedCompany = null; render(); });
els.procurementFilter.addEventListener("change", () => { state.procurementFilter = els.procurementFilter.value; state.selectedCompany = null; render(); });
els.resetSelection.addEventListener("click", () => { state.selectedCompany = null; render(); });
els.treemap.addEventListener("click", event => {
  const tile = event.target.closest(".tile");
  if (!tile) return;
  state.selectedCompany = tile.dataset.company;
  render();
});
window.addEventListener("resize", () => render());
loadSample();


















