(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./vendor/papaparse.js"));
  else root.ProcurementData = factory(root.Papa);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Papa) {
  const RULES_VERSION = "2";
  const ITEMS = [
    { code: "5512190301", name: "안내전광판" },
    { code: "5512190302", name: "기상전광판" },
    { code: "5512190303", name: "교통정보전광판" },
  ];
  const clean = value => String(value ?? "").trim();
  const digits = value => clean(value).replace(/[^0-9]/g, "");
  function decode(buffer) {
    const bytes = new Uint8Array(buffer);
    const encoding = bytes[0] === 255 && bytes[1] === 254 ? "utf-16le" : "utf-8";
    return new TextDecoder(encoding, { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  }
  function date(value) {
    const d = digits(value);
    if (d.length !== 8) throw new Error("계약일자 형식 오류: " + value);
    const iso = d.slice(0,4) + "-" + d.slice(4,6) + "-" + d.slice(6);
    const parsed = new Date(iso + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== iso) throw new Error("유효하지 않은 계약일자: " + value);
    return iso;
  }
  function money(value) {
    const text = clean(value).replace(/,/g, "");
    if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text))) throw new Error("계약금액 형식 오류: " + value);
    return Number(text);
  }
  function companyKey(row) {
    const id = digits(row["사업자등록번호"]);
    return id.length === 10 ? "id:" + id : "name:" + clean(row["업체명"]).replace(/\s+/g, "");
  }
  function parse(text, source, expected) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    const headerIndex = lines.findIndex(line => line.includes("업체명") && line.includes("물품") && (line.includes("공급금액") || line.includes("계약(납품요구)금액")));
    if (headerIndex < 0) throw new Error(source + ": CSV 헤더가 없습니다.");
    const delimiter = lines[headerIndex].includes("\t") ? "\t" : ",";
    const parsed = Papa.parse(lines.slice(headerIndex).join("\n"), { header: true, delimiter, skipEmptyLines: "greedy", transformHeader: clean });
    if (parsed.errors.length) throw new Error(source + ": " + parsed.errors[0].message);
    const fields = parsed.meta.fields;
    const innovation = fields.includes("혁신지정구분");
    const type = innovation ? "innovation" : "procurement";
    if (expected && type !== expected) throw new Error(source + ": 파일명과 자료 유형이 다릅니다.");
    for (const f of ["업체명", "계약(납품요구)번호", "계약(납품요구)일자", innovation ? "계약(납품요구)금액" : "공급금액"]) {
      if (!fields.includes(f)) throw new Error(source + ": 필수 열 누락 " + f);
    }
    const stats = { source, type, original: parsed.data.length, target: 0, excluded: 0, inferred: 0, nonFinal: 0 };
    const rows = [];
    for (const raw of parsed.data) {
      const r = Object.fromEntries(Object.entries(raw).map(([k,v]) => [k, clean(v)]));
      const text = [r["세부품명"], r["품명"], r["품목명"], r["계약명"]].join(" ");
      if (innovation && text.includes("융복합안내전광판")) { stats.excluded++; continue; }
      const code = r["세부품명번호"];
      let item = code ? ITEMS.find(i => i.code === code) : ITEMS.find(i => text.includes(i.name));
      if (!item) { stats.excluded++; continue; }
      if (code && r["세부품명"] && r["세부품명"] !== item.name) throw new Error(source + ": 코드와 품명 충돌 " + code);
      if (!code) stats.inferred++;
      const flag = r["최종계약(납품요구)여부"];
      if (flag && !["Y", "YES", "TRUE", "1"].includes(flag.toUpperCase())) { stats.nonFinal++; continue; }
      if (!r["업체명"] || !r["계약(납품요구)번호"]) throw new Error(source + ": 업체명 또는 계약번호 누락");
      date(r["계약(납품요구)일자"]);
      const amount = money(r["공급금액"] || r["계약(납품요구)금액"]);
      rows.push({ ...r, "세부품명번호": item.code, "세부품명": item.name,
        "공급금액": String(amount), "계약(납품요구)명": r["계약(납품요구)명"] || r["계약명"] || "",
        "자료구분": innovation ? "혁신제품" : "특정품목", "원본파일": source,
        "_innovation": innovation, "_sources": [type] });
      stats.target++;
    }
    return { rows, stats };
  }
  function merge(rows) {
    const map = new Map();
    let duplicates = 0;
    let fallbackKeys = 0;
    for (const row of rows) {
      const product = row["물품식별번호"];
      if (!product) fallbackKeys++;
      const base = JSON.stringify([row["계약(납품요구)번호"], row["계약납품구분"], companyKey(row),
        row["세부품명번호"], product || row["품목명"]]);
      const key = base + "/" + (row["물품순번"] || "") + "/" + row["자료구분"];
      const previous = map.get(key);
      if (!previous) { map.set(key, { ...row }); continue; }
      const a = Number(previous["변경차수"] || 0), b = Number(row["변경차수"] || 0);
      if (a !== b && previous["변경차수"] && row["변경차수"]) {
        map.set(key, b > a ? { ...row } : previous); duplicates++; continue;
      }
      const comparison = r => JSON.stringify([date(r["계약(납품요구)일자"]), money(r["공급금액"]), r["수요기관"], r["계약(납품요구)명"]]);
      if (comparison(previous) !== comparison(row)) throw new Error("동일 계약 식별 충돌: " + row["계약(납품요구)번호"]);
      previous._innovation ||= row._innovation;
      previous._sources = [...new Set([...(previous._sources || []), ...(row._sources || [])])];
      for (const flag of ["MAS여부", "우수제품여부"]) if (row[flag] === "Y") previous[flag] = "Y";
      duplicates++;
    }
    const result = [];
    const conflicts = [];
    const adjustments = [];
    const groups = new Map();
    const describe = r => ({ contract: r["계약(납품요구)번호"], company: r["업체명"], date: r["계약(납품요구)일자"], amount: r["공급금액"], type: r["자료구분"], product: r["물품식별번호"], line: r["물품순번"] || "" });
    // Group before reconciliation so input order cannot hide multiple item lines.
    for (const row of map.values()) {
      const identity = JSON.stringify([row["계약(납품요구)번호"], row["계약납품구분"], companyKey(row), row["물품식별번호"], row["세부품명번호"]]);
      const group = groups.get(identity) || [];
      group.push(row);
      groups.set(identity, group);
    }
    for (const group of groups.values()) {
      const procurement = group.filter(r => r._sources.includes("procurement"));
      const innovation = group.filter(r => r._sources.includes("innovation"));
      if (!procurement.length || !innovation.length || group.length === 1) { result.push(...group); continue; }
      if (group.length !== 2 || procurement.length !== 1 || innovation.length !== 1) {
        conflicts.push({ reason: "여러 물품 행의 금액 배분 확인 필요", rows: group.map(describe) });
        continue;
      }
      const final = procurement[0], initial = innovation[0];
      const changed = date(final["계약(납품요구)일자"]) !== date(initial["계약(납품요구)일자"])
        || money(final["공급금액"]) !== money(initial["공급금액"]);
      const verifiedFinal = ["Y", "YES", "TRUE", "1"].includes(clean(final["최종계약(납품요구)여부"]).toUpperCase());
      if (final["수요기관"] !== initial["수요기관"] || (changed && (!verifiedFinal || !final["물품식별번호"]))) {
        conflicts.push({ reason: "최종계약 여부 또는 수요기관·물품 식별 확인 필요", rows: group.map(describe) });
        continue;
      }
      // The procurement export contains final adjusted values; innovation contains initial values.
      const reconciled = { ...final, _innovation: true, _sources: [...new Set([...final._sources, ...initial._sources])] };
      for (const flag of ["MAS여부", "우수제품여부"]) if (initial[flag] === "Y") reconciled[flag] = "Y";
      if (changed) {
        const adjustment = { contract: final["계약(납품요구)번호"], company: final["업체명"],
          product: final["물품식별번호"], initialDate: initial["계약(납품요구)일자"], finalDate: final["계약(납품요구)일자"],
          initialAmount: money(initial["공급금액"]), finalAmount: money(final["공급금액"]),
          difference: money(final["공급금액"]) - money(initial["공급금액"]), basis: "특정품목 최종계약" };
        reconciled._adjustment = adjustment;
        adjustments.push(adjustment);
      }
      result.push(reconciled);
      duplicates++;
    }
    if (conflicts.length) {
      const error = new Error("자료 간 계약 식별 충돌 " + conflicts.length + "건. 검증 보고서 확인이 필요합니다.");
      error.details = conflicts;
      throw error;
    }
    // Use one display name for all rows sharing a business identifier.
    const names = new Map();
    for (const row of result) {
      const key = companyKey(row);
      if (!names.has(key)) names.set(key, row["업체명"]);
      row["업체명"] = names.get(key);
    }
    return { rows: result, duplicates, fallbackKeys, adjustments };
  }
  function summarize(rows) {
    const dates = rows.map(r => date(r["계약(납품요구)일자"])).sort();
    const amount = rows.reduce((s,r) => s + money(r["공급금액"]), 0);
    if (!Number.isSafeInteger(amount)) throw new Error("금액 합계 정밀도 범위 초과");
    return { count: rows.length, amount, companies: new Set(rows.map(companyKey)).size, from: dates[0] || "", to: dates.at(-1) || "" };
  }
  function compare(current, previous, decrease = 0.3) {
    const errors = [];
    if (!current.count) errors.push("대상 계약이 0건입니다.");
    if (previous) {
      if (current.to < previous.to) errors.push("계약기간 종료일이 후퇴했습니다.");
      if (current.from > previous.from) errors.push("계약기간 시작일이 후퇴했습니다.");
      for (const k of ["count", "amount"]) if (previous[k] > 0 && current[k] < previous[k] * (1-decrease)) errors.push(k + ": 허용 감소율 초과");
    }
    return errors;
  }
  return { RULES_VERSION, ITEMS, decode, parse, merge, summarize, compare, companyKey };
});

