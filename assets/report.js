
(function () {
  const AUTH_USER = "DNA365";
  const AUTH_HASH = "d2e219e34d2b118af22bce6ccf2454ffbe145f5bcbbeea2fc37e6ad0807b6903";
  const AUTH_SALT = "oil-report";
  const AUTH_KEY = "dna365_report_authenticated";

  const norm = (value) => (value || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const text = (el) => norm(el ? el.textContent : "");
  const fmtInt = (value) => Math.round(value || 0).toLocaleString("pt-BR");
  const filterActive = () => Boolean(
    document.querySelector("[data-page-health]")?.value ||
    document.querySelector("[data-page-site]")?.value ||
    document.querySelector("[data-page-status]")?.value
  );

  async function digest(value) {
    if (!window.crypto?.subtle) return "";
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function unlockReport() {
    sessionStorage.setItem(AUTH_KEY, "1");
    document.body.classList.remove("auth-locked");
    document.body.classList.add("auth-ready");
    document.querySelector(".auth-screen")?.setAttribute("hidden", "");
    document.querySelector(".shell")?.removeAttribute("aria-hidden");
  }

  function setupAuth() {
    const shell = document.querySelector(".shell");
    const authScreen = document.querySelector(".auth-screen");
    const form = document.querySelector("[data-login-form]");
    const error = document.querySelector("[data-login-error]");

    if (sessionStorage.getItem(AUTH_KEY) === "1") {
      unlockReport();
    } else {
      document.body.classList.add("auth-locked");
      authScreen?.removeAttribute("hidden");
      shell?.setAttribute("aria-hidden", "true");
      document.querySelector("[data-login-user]")?.focus();
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const user = document.querySelector("[data-login-user]")?.value.trim();
      const password = document.querySelector("[data-login-password]")?.value || "";
      const submitted = await digest(`${user}:${password}:${AUTH_SALT}`);
      if (user === AUTH_USER && submitted === AUTH_HASH) {
        if (error) error.textContent = "";
        unlockReport();
      } else if (error) {
        error.textContent = "Usuario ou senha invalidos.";
      }
    });

    document.querySelector("[data-logout]")?.addEventListener("click", () => {
      sessionStorage.removeItem(AUTH_KEY);
      window.location.href = "index.html";
    });
  }

  function icon(name) {
    const paths = {
      search: "m20 18.6-4.2-4.2A7 7 0 1 0 14.4 16l4.2 4 1.4-1.4ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z",
      download: "M11 4h2v8l3-3 1.4 1.4L12 15.8l-5.4-5.4L8 9l3 3V4ZM5 18h14v2H5v-2Z",
      filter: "M4 5h16l-6 7v5l-4 2v-7L4 5Z"
    };
    return `<span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.filter}"/></svg></span>`;
  }

  function tableName(table, index) {
    const previous = table.closest("[data-table-wrap]").previousElementSibling;
    if (previous && /^H[1-4]$/.test(previous.tagName)) return previous.textContent.trim();
    return `tabela_${index + 1}`;
  }

  function cellText(row, columnIndex) {
    if (columnIndex < 0) return "";
    const cell = row.cells[columnIndex];
    return cell ? cell.textContent.trim() : "";
  }

  function headers(table) {
    return Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
  }

  function columnIndex(table, candidates) {
    const hs = headers(table).map(norm);
    const normalized = candidates.map(norm);
    const exact = hs.findIndex((h) => normalized.some((c) => h === c));
    if (exact >= 0) return exact;
    return hs.findIndex((h) => normalized.some((c) => c.length > 4 && h.includes(c)));
  }

  function csvEscape(value) {
    const clean = (value || "").toString().replace(/\s+/g, " ").trim();
    return `"${clean.replace(/"/g, '""')}"`;
  }

  function htmlEscape(value) {
    return (value || "").toString().replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function visibleRows(table) {
    return Array.from(table.querySelectorAll("tbody tr")).filter((row) => row.style.display !== "none");
  }

  function exportCsv(table, filename) {
    const rows = [headers(table), ...visibleRows(table).map((row) => Array.from(row.cells).map((td) => td.textContent.trim()))];
    const csv = "\ufeff" + rows.map((row) => row.map(csvEscape).join(";")).join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
  }

  function exportExcel(table, filename) {
    const clone = table.cloneNode(true);
    Array.from(clone.querySelectorAll("tbody tr")).forEach((row, idx) => {
      if (table.querySelectorAll("tbody tr")[idx].style.display === "none") row.remove();
    });
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${clone.outerHTML}</body></html>`;
    download(new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" }), `${filename}.xls`);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/[^\w\-]+/g, "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function applyFilters() {
    const pageSearch = "";
    const health = norm(document.querySelector("[data-page-health]")?.value);
    const site = norm(document.querySelector("[data-page-site]")?.value);
    const status = norm(document.querySelector("[data-page-status]")?.value);

    document.querySelectorAll("[data-table-wrap] table").forEach((table) => {
      const localSearch = norm(table.closest("[data-table-block]")?.querySelector("[data-table-search]")?.value);
      const hIdx = columnIndex(table, ["Saúde"]);
      const sIdx = columnIndex(table, ["Site de Trabalho", "Site"]);
      const stIdx = columnIndex(table, ["Status"]);

      table.querySelectorAll("tbody tr").forEach((row) => {
        const rowText = text(row);
        const visible =
          (!pageSearch || rowText.includes(pageSearch)) &&
          (!localSearch || rowText.includes(localSearch)) &&
          (!health || hIdx < 0 || norm(cellText(row, hIdx)).includes(health)) &&
          (!site || sIdx < 0 || norm(cellText(row, sIdx)).includes(site)) &&
          (!status || stIdx < 0 || norm(cellText(row, stIdx)).includes(status));
        row.style.display = visible ? "" : "none";
      });
      const count = table.closest("[data-table-block]")?.querySelector("[data-row-count]");
      if (count) count.textContent = `${visibleRows(table).length} linhas visíveis`;
    });
    updateKpis(pageSearch, health, site, status);
    applyVesselFilter();
  }

  function filteredRecords(pageSearch, health, site, status) {
    const records = window.REPORT_DATA || [];
    return records.filter((row) => {
      const rowText = norm(Object.values(row).join(" "));
      return (!pageSearch || rowText.includes(pageSearch)) &&
        (!health || norm(row.health).includes(health)) &&
        (!site || norm(row.site).includes(site)) &&
        (!status || norm(row.status).includes(status));
    });
  }

  function uniqueCount(records, field) {
    return new Set(records.map((row) => row[field]).filter(Boolean)).size;
  }

  function setKpi(kpi, value, filtered) {
    const strong = kpi.querySelector("strong");
    const small = kpi.querySelector("small");
    if (!strong) return;
    if (!kpi.dataset.originalValue) kpi.dataset.originalValue = strong.textContent;
    if (small && !kpi.dataset.originalNote) kpi.dataset.originalNote = small.textContent;
    strong.textContent = fmtInt(value);
    if (small) small.textContent = filtered ? "considerando filtros aplicados" : kpi.dataset.originalNote;
    kpi.classList.toggle("filtered-kpi", filtered);
  }

  function updateKpis(pageSearch, health, site, status) {
    const records = filteredRecords(pageSearch, health, site, status);
    const filtered = filterActive();
    const latestRecords = records.filter((row) => row.latest);
    document.querySelectorAll(".kpi").forEach((kpi) => {
      const label = norm(kpi.querySelector("span")?.textContent || "");
      if (label.includes("amostras de oleo") || label === "amostras") setKpi(kpi, records.length, filtered);
      else if (label.includes("ativos monitorados") || label === "ativos") setKpi(kpi, uniqueCount(records, "asset"), filtered);
      else if (label.includes("pares avaliados") || label.includes("pares priorizados")) setKpi(kpi, uniqueCount(records, "pair"), filtered);
      else if (label.includes("acao requerida")) setKpi(kpi, records.filter((row) => row.health === "Ação requerida").length, filtered);
      else if (label.includes("ultimo resultado critico") || label.includes("ultimo resultado em acao")) setKpi(kpi, latestRecords.filter((row) => row.health === "Ação requerida").length, filtered);
      else if (label.includes("ultimo resultado monitorado")) setKpi(kpi, latestRecords.filter((row) => row.health === "Componente do Monitor").length, filtered);
      else if (label.includes("sites com amostras")) setKpi(kpi, uniqueCount(records, "site"), filtered);
      else if (label.includes("tipos de fluido")) setKpi(kpi, uniqueCount(records, "fluid"), filtered);
      else if (label.includes("viscosidades")) setKpi(kpi, uniqueCount(records, "weight"), filtered);
      else if (label.includes("textos interpretativos")) setKpi(kpi, records.filter((row) => row.statusText).length, filtered);
      else if (label.includes("com iso preenchido")) setKpi(kpi, records.filter((row) => row.iso).length, filtered);
      else if (label.includes("com h2o medido")) setKpi(kpi, records.filter((row) => row.h2o).length, filtered);
      else if (label.includes("amostras com prazo")) setKpi(kpi, records.filter((row) => row.delay !== null).length, filtered);
    });
  }

  function fillPageFilters() {
    const values = { health: new Set(), site: new Set(), status: new Set() };
    document.querySelectorAll("table").forEach((table) => {
      const hIdx = columnIndex(table, ["Saúde"]);
      const sIdx = columnIndex(table, ["Site de Trabalho", "Site"]);
      const stIdx = columnIndex(table, ["Status"]);
      table.querySelectorAll("tbody tr").forEach((row) => {
        if (hIdx >= 0) values.health.add(cellText(row, hIdx));
        if (sIdx >= 0) values.site.add(cellText(row, sIdx));
        if (stIdx >= 0) values.status.add(cellText(row, stIdx));
      });
    });
    [["[data-page-health]", values.health], ["[data-page-site]", values.site], ["[data-page-status]", values.status]].forEach(([selector, set]) => {
      const select = document.querySelector(selector);
      if (!select) return;
      const options = Array.from(set).filter(Boolean).sort();
      select.closest("label").style.display = options.length ? "" : "none";
      options.forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      });
    });
  }

  function enhanceTables() {
    document.querySelectorAll("[data-table-wrap]").forEach((wrap, index) => {
      const table = wrap.querySelector("table");
      if (!table || wrap.closest("[data-table-block]")) return;
      const filename = tableName(table, index);
      const block = document.createElement("section");
      block.className = "table-block";
      block.dataset.tableBlock = "";
      wrap.parentNode.insertBefore(block, wrap);
      block.appendChild(wrap);

      const toolbar = document.createElement("div");
      toolbar.className = "table-toolbar";
      toolbar.innerHTML = `
        <label class="searchbox">${icon("search")}<input data-table-search type="search" placeholder="Filtrar esta tabela"></label>
        <span class="row-count" data-row-count>${table.querySelectorAll("tbody tr").length} linhas visíveis</span>
        <details class="export-menu">
          <summary>${icon("download")}Exportar</summary>
          <button type="button" data-export-csv>CSV</button>
          <button type="button" data-export-xls>Excel</button>
        </details>
      `;
      block.insertBefore(toolbar, wrap);
      toolbar.querySelector("[data-table-search]").addEventListener("input", applyFilters);
      toolbar.querySelector("[data-export-csv]").addEventListener("click", () => exportCsv(table, filename));
      toolbar.querySelector("[data-export-xls]").addEventListener("click", () => exportExcel(table, filename));
    });
  }

  function enhanceTips() {
    const tip = document.createElement("div");
    tip.className = "chart-tooltip";
    document.body.appendChild(tip);
    document.querySelectorAll("[data-tooltip]").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        tip.textContent = el.dataset.tooltip;
        tip.classList.add("show");
      });
      el.addEventListener("mousemove", (event) => {
        tip.style.left = `${event.clientX + 14}px`;
        tip.style.top = `${event.clientY + 14}px`;
      });
      el.addEventListener("mouseleave", () => tip.classList.remove("show"));
    });
  }

  function applyVesselFilter() {
    const select = document.querySelector("[data-vessel-filter]");
    if (!select) return;
    const selected = norm(select.value);
    let visible = 0;
    if (window.VESSEL_MARKERS && window.VESSEL_MAP) {
      window.VESSEL_MARKERS.forEach((item) => {
        const show = !selected || norm(item.name) === selected;
        if (show) {
          item.marker.addTo(window.VESSEL_MARKER_LAYER);
          visible += 1;
        } else {
          window.VESSEL_MARKER_LAYER.removeLayer(item.marker);
        }
      });
      if (selected) {
        const found = window.VESSEL_MARKERS.find((item) => norm(item.name) === selected);
        if (found) {
          window.VESSEL_MAP.setView(found.marker.getLatLng(), Math.max(window.VESSEL_MAP.getZoom(), 6), { animate: true });
          found.marker.openTooltip();
        }
      } else if (window.VESSEL_BOUNDS && window.VESSEL_BOUNDS.isValid()) {
        window.VESSEL_MAP.fitBounds(window.VESSEL_BOUNDS, { padding: [24, 24] });
      }
    } else {
      document.querySelectorAll("[data-vessel]").forEach((marker) => {
        const show = !selected || norm(marker.dataset.vessel) === selected;
        marker.classList.toggle("is-hidden", !show);
        if (show) visible += 1;
      });
      if (!visible) {
        visible = Array.from(document.querySelectorAll("[data-vessel-row]")).filter((row) => {
          return !selected || norm(row.dataset.vesselRow) === selected;
        }).length;
      }
    }
    document.querySelectorAll("[data-vessel-row]").forEach((row) => {
      row.style.display = (!selected || norm(row.dataset.vesselRow) === selected) ? "" : "none";
    });
    const count = document.querySelector("[data-vessel-count]");
    if (count) count.textContent = `${visible} navio${visible === 1 ? "" : "s"} no mapa`;
  }

  function setupLeafletVesselMap() {
    const el = document.getElementById("leaflet-vessel-map");
    if (!el) return;
    if (!window.L || !Array.isArray(window.VESSEL_MAP_DATA)) {
      el.classList.add("map-unavailable");
      el.textContent = "Nao foi possivel carregar o mapa online. Verifique a conexao com a internet e recarregue a pagina.";
      return;
    }
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    const humanitarian = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team'
    });
    const markerLayer = L.layerGroup();
    const map = L.map(el, {
      layers: [osm, markerLayer],
      worldCopyJump: true,
      zoomControl: true
    });
    window.VESSEL_MAP = map;
    window.VESSEL_MARKER_LAYER = markerLayer;
    window.VESSEL_MARKERS = window.VESSEL_MAP_DATA.map((ship) => {
      const marker = L.circleMarker([ship.lat, ship.lon], {
        radius: 7,
        weight: 2,
        color: "#ffffff",
        fillColor: "#0f3a68",
        fillOpacity: 0.92
      }).bindTooltip(ship.name, {
        direction: "top",
        offset: [0, -6],
        sticky: true
      }).bindPopup(`
        <strong>${htmlEscape(ship.name)}</strong><br>
        Rota: ${htmlEscape(ship.route)}<br>
        Referencia: ${htmlEscape(ship.port)}<br>
        Status: ${htmlEscape(ship.status)}<br>
        Operacao: ${htmlEscape(ship.operation)}<br>
        Latitude: ${ship.lat.toLocaleString("pt-BR")}<br>
        Longitude: ${ship.lon.toLocaleString("pt-BR")}
      `);
      marker.addTo(markerLayer);
      return { name: ship.name, marker };
    });
    const bounds = L.latLngBounds(window.VESSEL_MARKERS.map((item) => item.marker.getLatLng()));
    window.VESSEL_BOUNDS = bounds;
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28] });
    L.control.layers(
      { "OpenStreetMap": osm, "OSM Humanitário": humanitarian },
      { "Navios": markerLayer },
      { collapsed: false }
    ).addTo(map);
    setTimeout(() => map.invalidateSize(), 120);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupAuth();

    const topButton = document.createElement("button");
    topButton.type = "button";
    topButton.className = "back-to-top";
    topButton.setAttribute("aria-label", "Voltar ao topo");
    topButton.innerHTML = "↑";
    document.body.appendChild(topButton);
    topButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.addEventListener("scroll", () => {
      topButton.classList.toggle("show", window.scrollY > 420);
    }, { passive: true });

    enhanceTables();
    fillPageFilters();
    document.querySelectorAll("[data-page-filter] input, [data-page-filter] select").forEach((el) => {
      el.addEventListener("input", applyFilters);
      el.addEventListener("change", applyFilters);
    });
    document.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
      document.querySelectorAll("[data-page-filter] select, [data-table-search]").forEach((el) => { el.value = ""; });
      applyFilters();
    });
    document.querySelector("[data-vessel-filter]")?.addEventListener("change", applyVesselFilter);
    document.querySelector("[data-clear-vessel]")?.addEventListener("click", () => {
      const select = document.querySelector("[data-vessel-filter]");
      if (select) select.value = "";
      applyVesselFilter();
    });
    setupLeafletVesselMap();
    enhanceTips();
    applyFilters();
    applyVesselFilter();
  });
})();
