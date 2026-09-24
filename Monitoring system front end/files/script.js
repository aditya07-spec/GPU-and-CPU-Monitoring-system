/*
═══════════════════════════════════════════════════════════
   GPU & CPU MONITORING DASHBOARD · script.js
   ───────────────────────────────────────────────────────────
   Data architecture
   ─────────────────
   C Engine (Sleep 1000ms)
     └── writes telemetry.json ← fetch() polls every 1000ms
     └── writes monitoring.csv ← preserved, untouched
                │
                ▼
   [DATA LAYER] fetchTelemetry()
                │
          ┌─────┴─────┐
          ▼           ▼
    updateCards()  updateCharts()
          │              │
      DOM values    Chart.js canvases

═══════════════════════════════════════════════════════════
*/

"use strict";

// ── TELEMETRY.JSON PATH ────────────────────────────────────
// Relative to index.html.
// The C engine must write this file.
const TELEMETRY_JSON_PATH = "telemetry.json";

// ── POLL INTERVAL (ms) ─────────────────────────────────────
// C engine sleeps 1000ms per iteration.
const POLL_MS = 1000;

// ── ROLLING HISTORY LENGTH (samples) ───────────────────────
// Matches the C engine's 60-sample circular buffer.
const HISTORY_LEN = 60;

// ── METRIC CONFIG ──────────────────────────────────────────
// Defines scale ranges for each metric used in graphs and bars.
const METRIC_CONFIG = {
  gpu_util: {
    label: "GPU UTILIZATION",
    unit: "%",
    min: 0,
    max: 100,
    color: "#76b900",
  },

  gpu_temp: {
    label: "GPU TEMPERATURE",
    unit: "°C",
    min: 0,
    max: 100,
    color: "#e07040",
  },

  gpu_power: {
    label: "GPU POWER DRAW",
    unit: "W",
    min: 0,
    max: 80,
    color: "#c0a030",
  },

  gpu_clock: {
    label: "GPU GRAPHICS CLOCK",
    unit: "MHz",
    min: 0,
    max: 1800,
    color: "#5090d0",
  },

  gpu_mem_clock: {
    label: "GPU MEMORY CLOCK",
    unit: "MHz",
    min: 0,
    max: 7000,
    color: "#5090d0",
  },

  vram_usage: {
    label: "VRAM USAGE",
    unit: "%",
    min: 0,
    max: 100,
    color: "#76b900",
  },

  gpu_mem_util: {
    label: "GPU MEMORY BUS UTIL",
    unit: "%",
    min: 0,
    max: 100,
    color: "#76b900",
  },

  cpu_usage: {
    label: "CPU UTILIZATION",
    unit: "%",
    min: 0,
    max: 100,
    color: "#7070d0",
  },

  ram_usage: {
    label: "RAM USAGE",
    unit: "%",
    min: 0,
    max: 100,
    color: "#4090a0",
  },
};

// ═══════════════════════════════════════════════════════════
// ROLLING HISTORY STORE
// ═══════════════════════════════════════════════════════════

const history = {
  labels: [],
  gpu_util: [],
  gpu_temp: [],
  gpu_power: [],
  gpu_clock: [],
  gpu_mem_clock: [],
  vram_usage: [],
  gpu_mem_util: [],
  cpu_usage: [],
  ram_usage: [],
};

function pushHistory(snap) {
  const ts = new Date(snap.timestamp * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const fields = Object.keys(history).filter((k) => k !== "labels");

  history.labels.push(ts);

  fields.forEach((k) => {
    history[k].push(snap[k] ?? 0);
  });

  // Keep only the most recent HISTORY_LEN samples.
  if (history.labels.length > HISTORY_LEN) {
    history.labels.shift();

    fields.forEach((k) => {
      history[k].shift();
    });
  }
}

let sampleCount = 0;
let identitySet = false;
let lastTimestamp = null;

// ═══════════════════════════════════════════════════════════
// FETCH LAYER
// ═══════════════════════════════════════════════════════════

async function fetchTelemetry() {
  try {
    const res = await fetch(TELEMETRY_JSON_PATH + "?t=" + Date.now());

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    return await res.json();
  } catch (err) {
    console.warn("[telemetry] fetch failed:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// CHART.JS SETUP
// ═══════════════════════════════════════════════════════════

function makeChartConfig({ color, unit, min, max }) {
  return {
    type: "line",

    data: {
      labels: [],

      datasets: [
        {
          data: [],
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.35,

          fill: {
            target: "origin",
            above: hexAlpha(color, 0.07),
          },
        },
      ],
    },

    options: {
      animation: {
        duration: 0,
      },

      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "nearest",
        intersect: false,
      },

      plugins: {
        legend: {
          display: false,
        },

        tooltip: {
          backgroundColor: "#1f2123",
          titleColor: "#8e9499",
          bodyColor: "#e8eaeb",
          borderColor: "#272a2c",
          borderWidth: 1,

          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toFixed(1)} ${unit}`,
          },
        },
      },

      scales: {
        x: {
          display: false,
        },

        y: {
          min: min,
          max: max,

          grid: {
            color: "rgba(255,255,255,0.04)",
            drawBorder: false,
          },

          ticks: {
            color: "#555c62",
            font: {
              size: 9,
              family: "Courier New, monospace",
            },

            maxTicksLimit: 5,

            callback: (v) => v + " " + unit,
          },

          border: {
            display: false,
          },
        },
      },
    },
  };
}

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════════════════
// CHART INSTANCES
// ═══════════════════════════════════════════════════════════

let primaryChart = null;
let primaryMetric = "gpu_util";

let cpuChart = null;

function initCharts() {
  const primaryCtx = document.getElementById("primaryGraph").getContext("2d");

  const cfg = METRIC_CONFIG[primaryMetric];

  primaryChart = new Chart(primaryCtx, makeChartConfig(cfg));

  const cpuCtx = document.getElementById("cpuGraph").getContext("2d");

  const cpuCfg = METRIC_CONFIG["cpu_usage"];

  cpuChart = new Chart(cpuCtx, makeChartConfig(cpuCfg));
}

function updateCharts() {
  // Primary chart
  const primaryData = primaryChart.data;

  primaryData.labels = [...history.labels];

  primaryData.datasets[0].data = [...history[primaryMetric]];

  primaryChart.update("none");

  // CPU chart
  const cpuData = cpuChart.data;

  cpuData.labels = [...history.labels];

  cpuData.datasets[0].data = [...history.cpu_usage];

  cpuChart.update("none");
}

function switchPrimaryMetric(metric) {
  if (!METRIC_CONFIG[metric]) return;

  primaryMetric = metric;

  const cfg = METRIC_CONFIG[metric];

  // Update line color
  primaryChart.data.datasets[0].borderColor = cfg.color;

  // Update fill color
  primaryChart.data.datasets[0].fill.above = hexAlpha(cfg.color, 0.07);

  // Update Y-axis range
  primaryChart.options.scales.y.min = cfg.min;
  primaryChart.options.scales.y.max = cfg.max;

  // Update tooltip unit
  primaryChart.options.plugins.tooltip.callbacks.label = (ctx) =>
    ` ${ctx.parsed.y.toFixed(1)} ${cfg.unit}`;

  // Update Y-axis unit
  primaryChart.options.scales.y.ticks.callback = (v) => v + " " + cfg.unit;

  // Load current history
  primaryChart.data.labels = [...history.labels];

  primaryChart.data.datasets[0].data = [...history[primaryMetric]];

  primaryChart.update("none");

  // Update graph title
  document.getElementById("graphTitle").textContent = cfg.label;
}

// ═══════════════════════════════════════════════════════════
// DOM UPDATE — METRIC CARDS
// ═══════════════════════════════════════════════════════════

function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return "—";

  return v.toFixed(dec);
}

function setCard(valueId, barId, value, max) {
  const el = document.getElementById(valueId);
  const bar = document.getElementById(barId);

  if (el) {
    el.textContent = fmt(value, value % 1 !== 0 ? 1 : 0);
  }

  if (bar) {
    bar.style.width = Math.min(100, Math.max(0, (value / max) * 100)) + "%";
  }
}

function updateCards(snap) {
  setCard("valGpuUtil", "barGpuUtil", snap.gpu_util, 100);

  setCard("valGpuTemp", "barGpuTemp", snap.gpu_temp, 100);

  setCard(
    "valGpuPower",
    "barGpuPower",
    snap.gpu_power,
    METRIC_CONFIG.gpu_power.max,
  );

  setCard(
    "valGpuClock",
    "barGpuClock",
    snap.gpu_clock,
    METRIC_CONFIG.gpu_clock.max,
  );

  setCard(
    "valGpuMemClock",
    "barGpuMemClock",
    snap.gpu_mem_clock,
    METRIC_CONFIG.gpu_mem_clock.max,
  );

  setCard("valVramUsage", "barVramUsage", snap.vram_usage, 100);

  setCard("valGpuMemUtil", "barGpuMemUtil", snap.gpu_mem_util, 100);

  setCard("valCpuUsage", "barCpuUsage", snap.cpu_usage, 100);

  setCard("valRamUsage", "barRamUsage", snap.ram_usage, 100);
}

// ═══════════════════════════════════════════════════════════
// DOM UPDATE — SIDEBAR
// ═══════════════════════════════════════════════════════════

function updateSidebar(snap) {
  // VRAM
  const vramFill = document.getElementById("vramBarFill");

  if (vramFill) {
    vramFill.style.width = Math.min(100, snap.vram_usage) + "%";
  }

  setText("vramUsedGb", fmt(snap.used_vram_gb, 2) + " GiB");

  setText("vramFreeGb", fmt(snap.free_vram_gb, 2) + " GiB free");

  // RAM
  const ramFill = document.getElementById("ramBarFill");

  if (ramFill) {
    ramFill.style.width = Math.min(100, snap.ram_usage) + "%";
  }

  setText("ramUsedGb", fmt(snap.used_ram_gb, 2) + " GiB");

  setText("ramFreeGb", fmt(snap.free_ram_gb, 2) + " GiB free");
}

function updateAveragesSidebar(avgs) {
  if (!avgs) return;

  setText("avgCpu", fmt(avgs.cpu_avg, 2) + "%");

  setText("avgGpu", fmt(avgs.gpu_avg, 2) + "%");

  setText("avgTemp", fmt(avgs.temp_avg, 1) + "°C");

  setText("avgClock", fmt(avgs.clock_avg, 0) + " MHz");
}

function setText(id, val) {
  const el = document.getElementById(id);

  if (el) {
    el.textContent = val;
  }
}

// ═══════════════════════════════════════════════════════════
// GPU IDENTITY
// ═══════════════════════════════════════════════════════════

function setIdentity(snap) {
  if (identitySet) return;
  if (!snap.gpu_name) return;

  const fullName = snap.gpu_name;

  // Separate "Laptop GPU", "Desktop GPU", Ti, Super, etc.
  const subMatch = fullName.match(
    /(Laptop GPU|Desktop GPU|Ti|Super|TITAN.*)$/i,
  );

  const sub = snap.gpu_sub || (subMatch ? subMatch[1] : "");

  const base = sub ? fullName.replace(sub, "").trim() : fullName;

  setText("gpuName", base);

  const gpuSubEl = document.querySelector(".gpu-sub");

  if (gpuSubEl) {
    gpuSubEl.textContent = sub;
  }

  setText("driverVer", snap.driver_ver || "—");

  // CUDA version:
  // Example: 13040 → 13.4
  if (snap.cuda_driver_ver && snap.cuda_driver_ver > 0) {
    const major = Math.floor(snap.cuda_driver_ver / 1000);

    const minor = Math.floor((snap.cuda_driver_ver % 1000) / 10);

    setText("cudaVer", `${major}.${minor}`);
  }

  setText("vramTotal", fmt(snap.total_vram_gb, 2) + " GiB");

  setText("cpuCores", snap.cpu_cores ?? "—");

  identitySet = true;
}

// ═══════════════════════════════════════════════════════════
// STATUS INDICATOR
// ═══════════════════════════════════════════════════════════

function setStatus(ok) {
  const dot = document.getElementById("statusDot");

  const text = document.getElementById("statusText");

  const lbl = document.querySelector(".status-label");

  if (ok) {
    dot.classList.add("live");

    text.textContent = "LIVE";

    lbl.textContent = "MONITORING";
  } else {
    dot.classList.remove("live");

    text.textContent = "STALLED";

    lbl.textContent = "MONITORING";
  }
}

// ═══════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════

function updateFooter(snap) {
  sampleCount++;

  const ts = new Date(snap.timestamp * 1000).toLocaleTimeString();

  setText("lastUpdate", "Last update: " + ts);

  setText("sampleCount", "Samples: " + sampleCount);
}

// ═══════════════════════════════════════════════════════════
// MAIN POLLING LOOP
// ═══════════════════════════════════════════════════════════

async function tick() {
  const snap = await fetchTelemetry();

  if (!snap) {
    setStatus(false);
    return;
  }

  setStatus(true);

  setIdentity(snap);

  if (snap.timestamp !== lastTimestamp) {
    pushHistory(snap);
    lastTimestamp = snap.timestamp;
  }

  updateCards(snap);

  updateSidebar(snap);

  updateCharts();

  updateFooter(snap);

  if (snap.averages) {
    updateAveragesSidebar(snap.averages);
  }
}

// ═══════════════════════════════════════════════════════════
// METRIC CARD INTERACTION
// ═══════════════════════════════════════════════════════════

function initCardInteraction() {
  const cards = document.querySelectorAll(".metric-card");

  cards.forEach((card) => {
    const handler = () => {
      const metric = card.dataset.metric;

      if (!metric) return;

      // Deactivate all cards
      cards.forEach((c) => c.classList.remove("active-card"));

      // Activate clicked card
      card.classList.add("active-card");

      switchPrimaryMetric(metric);
    };

    card.addEventListener("click", handler);

    // Keyboard accessibility
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  // Wait for Chart.js CDN script to load.
  const waitForChart = setInterval(() => {
    if (typeof Chart === "undefined") {
      return;
    }

    clearInterval(waitForChart);

    initCharts();

    initCardInteraction();

    // First live reading immediately.
    tick();

    // Continue polling telemetry.json.
    setInterval(tick, POLL_MS);
  }, 50);
});
