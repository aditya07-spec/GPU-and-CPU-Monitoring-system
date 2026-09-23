/* ═══════════════════════════════════════════════════════════
   GPU & CPU MONITORING DASHBOARD  ·  script.js
   ───────────────────────────────────────────────────────────
   Data architecture
   ─────────────────
   C Engine (Sleep 1000ms)
     └── writes telemetry.json  ← fetch() polls every 1000ms
     └── writes monitoring.csv  ← preserved, untouched
                 │
                 ▼
   [DATA LAYER]  parseTelemetry()
                 │
          ┌──────┴──────┐
          ▼             ▼
    updateCards()   updateGraphs()
          │             │
    DOM values     Chart.js canvases
                         │
                    update3D()  ← Three.js hook (see 3D section)

   ═══════════════════════════════════════════════════════════
   MOCK MODE
   ─────────
   Set MOCK_MODE = true  →  fake telemetry, dashboard is previewable
   Set MOCK_MODE = false →  polls telemetry.json written by C engine
   ═══════════════════════════════════════════════════════════ */

"use strict";

// ── MOCK MODE SWITCH ─────────────────────────────────────────
// true  → synthetic data (UI preview)
// false → live fetch from telemetry.json (requires C engine running)
const MOCK_MODE = false;

// ── TELEMETRY.JSON PATH (relative to index.html) ─────────────
// When MOCK_MODE = false, the C engine must write this file.
// Place dashboard/ folder next to your compiled .exe so paths align.
const TELEMETRY_JSON_PATH = "telemetry.json";

// ── POLL INTERVAL (ms) ───────────────────────────────────────
// C engine sleeps 1000ms per iteration, so 1000ms poll is appropriate.
const POLL_MS = 1000;

// ── ROLLING HISTORY LENGTH (samples) ─────────────────────────
// Matches the C engine's 60-sample circular buffer.
const HISTORY_LEN = 60;

// ── METRIC CONFIG ────────────────────────────────────────────
// Defines scale ranges for each metric used in graphs and bar fills.
// Adjust maxes to match your actual GPU's spec sheet.
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

// ── STATIC GPU IDENTITY ──────────────────────────────────────
// Populated once from the first telemetry.json that includes it.
// In MOCK_MODE this is pre-filled.
const GPU_IDENTITY_DEFAULTS = {
  gpu_name: "NVIDIA GeForce RTX 3050",
  gpu_sub: "Laptop GPU",
  driver_ver: "—",
  cuda_driver_ver: 0,
  total_vram_gb: 4.0,
  cpu_cores: 6,
};

/* ═══════════════════════════════════════════════════════════
   ROLLING HISTORY STORE
   ═══════════════════════════════════════════════════════════ */
const history = {
  labels: [], // timestamp strings for X axis
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
  fields.forEach((k) => history[k].push(snap[k] ?? 0));

  // trim to rolling window
  if (history.labels.length > HISTORY_LEN) {
    history.labels.shift();
    fields.forEach((k) => history[k].shift());
  }
}

// 60-sample averages (updated by C engine, mirrored here)
const averages = {
  cpu_avg: null,
  gpu_avg: null,
  temp_avg: null,
  clock_avg: null,
};

let sampleCount = 0;
let identitySet = false;

/* ═══════════════════════════════════════════════════════════
   MOCK DATA GENERATOR
   ═══════════════════════════════════════════════════════════ */
const mock = (() => {
  let t = 0;
  // Smooth random walk helpers
  function walk(prev, min, max, step) {
    const next = prev + (Math.random() - 0.5) * step;
    return Math.max(min, Math.min(max, next));
  }
  let s = {
    gpu_util: 45,
    gpu_temp: 62,
    gpu_power: 35,
    gpu_clock: 1300,
    gpu_mem_clock: 4200,
    vram_usage: 40,
    gpu_mem_util: 30,
    cpu_usage: 25,
    ram_usage: 52,
    used_vram_gb: 1.6,
    free_vram_gb: 2.4,
    used_ram_gb: 8.3,
    free_ram_gb: 7.7,
  };

  return function generateSnapshot() {
    t++;
    s.gpu_util = walk(s.gpu_util, 0, 100, 8);
    s.gpu_temp = walk(s.gpu_temp, 30, 90, 2);
    s.gpu_power = walk(s.gpu_power, 5, 75, 4);
    s.gpu_clock = Math.round(walk(s.gpu_clock, 100, 1800, 50));
    s.gpu_mem_clock = Math.round(walk(s.gpu_mem_clock, 300, 7000, 100));
    s.vram_usage = walk(s.vram_usage, 5, 99, 3);
    s.gpu_mem_util = walk(s.gpu_mem_util, 0, 100, 6);
    s.cpu_usage = walk(s.cpu_usage, 2, 100, 7);
    s.ram_usage = walk(s.ram_usage, 20, 90, 2);
    s.used_vram_gb = +((s.vram_usage / 100) * 4.0).toFixed(2);
    s.free_vram_gb = +(4.0 - s.used_vram_gb).toFixed(2);
    s.used_ram_gb = +((s.ram_usage / 100) * 16.0).toFixed(2);
    s.free_ram_gb = +(16.0 - s.used_ram_gb).toFixed(2);

    return {
      // identity (sent every tick in mock; real C engine sends once)
      gpu_name: "NVIDIA GeForce RTX 3050",
      gpu_sub: "Laptop GPU",
      driver_ver: "616.56",
      cuda_driver_ver: 13040,
      total_vram_gb: 4.0,
      cpu_cores: 8,

      // snapshot
      timestamp: Math.floor(Date.now() / 1000),
      cpu_usage: +s.cpu_usage.toFixed(2),
      ram_usage: +s.ram_usage.toFixed(2),
      gpu_util: +s.gpu_util.toFixed(2),
      gpu_mem_util: +s.gpu_mem_util.toFixed(2),
      gpu_temp: Math.round(s.gpu_temp),
      vram_usage: +s.vram_usage.toFixed(2),
      gpu_power: +s.gpu_power.toFixed(2),
      gpu_clock: s.gpu_clock,
      gpu_mem_clock: s.gpu_mem_clock,

      // extended VRAM / RAM (used in sidebar)
      used_vram_gb: s.used_vram_gb,
      free_vram_gb: s.free_vram_gb,
      used_ram_gb: s.used_ram_gb,
      free_ram_gb: s.free_ram_gb,
      total_ram_gb: 16.0,

      // optional: C engine reports 60-sample averages
      averages:
        t % 60 === 0
          ? {
              cpu_avg: +s.cpu_usage.toFixed(2),
              gpu_avg: +s.gpu_util.toFixed(2),
              temp_avg: +s.gpu_temp.toFixed(1),
              clock_avg: +s.gpu_clock.toFixed(0),
            }
          : null,
    };
  };
})();

/* ═══════════════════════════════════════════════════════════
   FETCH LAYER  (live or mock)
   ═══════════════════════════════════════════════════════════ */
async function fetchTelemetry() {
  if (MOCK_MODE) {
    return mock();
  }
  try {
    const res = await fetch(TELEMETRY_JSON_PATH + "?t=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    console.warn("[telemetry] fetch failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   CHART.JS SETUP
   ═══════════════════════════════════════════════════════════ */
// Shared dataset defaults for monitoring-style graphs
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
      animation: { duration: 0 }, // no animation — real-time data must be exact
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { display: false },
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
          display: false, // hide X labels — time axis declutters the graph
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
            font: { size: 9, family: "Courier New, monospace" },
            maxTicksLimit: 5,
            callback: (v) => v + " " + unit,
          },
          border: { display: false },
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

// Primary (interactive) graph
let primaryChart = null;
let primaryMetric = "gpu_util"; // default selected metric

// CPU graph (always visible)
let cpuChart = null;

function initCharts() {
  const primaryCtx = document.getElementById("primaryGraph").getContext("2d");
  const cfg = METRIC_CONFIG[primaryMetric];
  primaryChart = new Chart(primaryCtx, makeChartConfig(cfg));

  const cpuCtx = document.getElementById("cpuGraph").getContext("2d");
  const cpuCfg = METRIC_CONFIG["cpu_usage"];
  cpuChart = new Chart(cpuCtx, makeChartConfig(cpuCfg));
}

function updateCharts(snap) {
  // Primary chart: update dataset with new data point
  const primaryData = primaryChart.data;
  primaryData.labels = [...history.labels];
  primaryData.datasets[0].data = [...history[primaryMetric]];
  primaryChart.update("none"); // "none" = no animation, keeps data accurate

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

  // Update dataset styling in-place
  primaryChart.data.datasets[0].borderColor = cfg.color;
  primaryChart.data.datasets[0].fill.above = hexAlpha(cfg.color, 0.07);

  // Update Y axis range/unit
  primaryChart.options.scales.y.min = cfg.min;
  primaryChart.options.scales.y.max = cfg.max;
  primaryChart.options.plugins.tooltip.callbacks.label = (ctx) =>
    ` ${ctx.parsed.y.toFixed(1)} ${cfg.unit}`;
  primaryChart.options.scales.y.ticks.callback = (v) => v + " " + cfg.unit;

  // Flush with current history
  primaryChart.data.labels = [...history.labels];
  primaryChart.data.datasets[0].data = [...history[primaryMetric]];
  primaryChart.update("none");

  // Update title
  document.getElementById("graphTitle").textContent = cfg.label;
}

/* ═══════════════════════════════════════════════════════════
   DOM UPDATE — METRIC CARDS
   ═══════════════════════════════════════════════════════════ */
function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(dec);
}

function setCard(valueId, barId, value, max) {
  const el = document.getElementById(valueId);
  const bar = document.getElementById(barId);
  if (el) el.textContent = fmt(value, value % 1 !== 0 ? 1 : 0);
  if (bar)
    bar.style.width = Math.min(100, Math.max(0, (value / max) * 100)) + "%";
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

/* ═══════════════════════════════════════════════════════════
   DOM UPDATE — SIDEBAR
   ═══════════════════════════════════════════════════════════ */
function updateSidebar(snap) {
  // VRAM bar + numbers
  const vramFill = document.getElementById("vramBarFill");
  if (vramFill) vramFill.style.width = Math.min(100, snap.vram_usage) + "%";
  setText("vramUsedGb", fmt(snap.used_vram_gb, 2) + " GiB");
  setText("vramFreeGb", fmt(snap.free_vram_gb, 2) + " GiB free");

  // RAM bar + numbers
  const ramFill = document.getElementById("ramBarFill");
  if (ramFill) ramFill.style.width = Math.min(100, snap.ram_usage) + "%";
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
  if (el) el.textContent = val;
}

/* ═══════════════════════════════════════════════════════════
   GPU IDENTITY (set once)
   ═══════════════════════════════════════════════════════════ */
function setIdentity(snap) {
  if (identitySet) return;
  if (!snap.gpu_name) return;

  // GPU name split for display
  const fullName = snap.gpu_name;
  // Separate "Laptop GPU" suffix if present
  const subMatch = fullName.match(
    /(Laptop GPU|Desktop GPU|Ti|Super|TITAN.*)$/i,
  );
  const sub = snap.gpu_sub || (subMatch ? subMatch[1] : "");
  const base = sub ? fullName.replace(sub, "").trim() : fullName;

  setText("gpuName", base);
  const gpuSubEl = document.querySelector(".gpu-sub");
  if (gpuSubEl) gpuSubEl.textContent = sub;

  setText("driverVer", snap.driver_ver || "—");

  // CUDA version: raw int like 13040 → "13.4"
  if (snap.cuda_driver_ver && snap.cuda_driver_ver > 0) {
    const major = Math.floor(snap.cuda_driver_ver / 1000);
    const minor = Math.floor((snap.cuda_driver_ver % 1000) / 10);
    setText("cudaVer", `${major}.${minor}`);
  }

  setText("vramTotal", fmt(snap.total_vram_gb, 2) + " GiB");
  setText("cpuCores", snap.cpu_cores ?? "—");

  identitySet = true;
}

/* ═══════════════════════════════════════════════════════════
   STATUS INDICATOR
   ═══════════════════════════════════════════════════════════ */
let lastGoodTick = 0;

function setStatus(ok) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  const lbl = document.querySelector(".status-label");
  if (ok) {
    dot.classList.add("live");
    text.textContent = "LIVE";
    lbl.textContent = MOCK_MODE ? "MOCK DATA" : "MONITORING";
  } else {
    dot.classList.remove("live");
    text.textContent = "STALLED";
  }
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
function updateFooter(snap) {
  sampleCount++;
  const ts = new Date(snap.timestamp * 1000).toLocaleTimeString();
  setText("lastUpdate", "Last update: " + ts);
  setText("sampleCount", "Samples: " + sampleCount);
}

/* ═══════════════════════════════════════════════════════════
   MAIN POLLING LOOP
   ═══════════════════════════════════════════════════════════ */
async function tick() {
  const snap = await fetchTelemetry();

  if (!snap) {
    setStatus(false);
    return;
  }

  setStatus(true);
  setIdentity(snap);
  pushHistory(snap);
  updateCards(snap);
  updateSidebar(snap);
  updateCharts(snap);
  updateFooter(snap);

  if (snap.averages) {
    updateAveragesSidebar(snap.averages);
    // Expose averages to 3D layer
    update3D(snap, snap.averages);
  } else {
    update3D(snap, null);
  }
}

/* ═══════════════════════════════════════════════════════════
   METRIC CARD INTERACTION — click switches primary graph
   ═══════════════════════════════════════════════════════════ */
function initCardInteraction() {
  const cards = document.querySelectorAll(".metric-card");

  cards.forEach((card) => {
    const handler = () => {
      const metric = card.dataset.metric;
      if (!metric) return;

      // Deactivate all
      cards.forEach((c) => c.classList.remove("active-card"));
      // Activate clicked
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

/* ═══════════════════════════════════════════════════════════
   ── 3D INTEGRATION POINT ──
   ═══════════════════════════════════════════════════════════
   Steps to activate 3D:
   1. Export your Blender model as .glb (File → Export → glTF 2.0)
      Place it in dashboard/assets/gpu.glb

   2. Load Three.js (add before </body> in index.html):
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="assets/GLTFLoader.js"></script>  ← from Three.js examples/jsm

   3. Uncomment and complete init3D() below.

   4. The update3D(snap, averages) function is already called every
      tick with live telemetry — drive your material uniforms from there.
   ═══════════════════════════════════════════════════════════ */

let three = {
  scene: null,
  camera: null,
  renderer: null,
  model: null,
  active: false,
};

function init3D() {
  /*
  // ── Uncomment when Three.js is loaded ──

  const canvas      = document.getElementById("viz3dCanvas");
  const placeholder = document.getElementById("viz3dPlaceholder");
  const wrap        = document.getElementById("viz3dWrap");

  three.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  three.renderer.setPixelRatio(window.devicePixelRatio);
  three.renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  three.renderer.setClearColor(0x000000, 0);

  three.scene  = new THREE.Scene();
  three.camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
  three.camera.position.set(0, 1, 3);

  // Ambient + directional lighting
  three.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dirLight = new THREE.DirectionalLight(0x76b900, 1.2);
  dirLight.position.set(2, 4, 3);
  three.scene.add(dirLight);

  // Load Blender GLB export
  const loader = new THREE.GLTFLoader();
  loader.load("assets/gpu.glb", gltf => {
    three.model = gltf.scene;
    three.scene.add(three.model);
    three.active = true;
    canvas.style.display = "block";
    placeholder.style.display = "none";
  });

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    if (three.model) three.model.rotation.y += 0.003;
    three.renderer.render(three.scene, three.camera);
  }
  animate();

  // Resize handler
  window.addEventListener("resize", () => {
    three.renderer.setSize(wrap.clientWidth, wrap.clientHeight);
    three.camera.aspect = wrap.clientWidth / wrap.clientHeight;
    three.camera.updateProjectionMatrix();
  });
  */
}

function update3D(snap, averages) {
  if (!three.active || !three.model) return;

  /*
  // ── Telemetry → 3D visual mappings ──
  // Drive material uniforms from live data here.

  // GPU UTILIZATION → emissive intensity (higher util = brighter core glow)
  const utilNorm = snap.gpu_util / 100;
  three.model.traverse(child => {
    if (child.isMesh && child.material.emissive) {
      child.material.emissiveIntensity = 0.1 + utilNorm * 1.2;
    }
  });

  // GPU TEMPERATURE → heat color tint (green → amber → red)
  const tempNorm = Math.min(1, (snap.gpu_temp - 30) / 70);   // 30°C=0, 100°C=1
  const tempColor = new THREE.Color().lerpColors(
    new THREE.Color(0x76b900),  // cool  (NVIDIA green)
    new THREE.Color(0xff3300),  // hot   (red)
    tempNorm
  );
  three.model.traverse(child => {
    if (child.isMesh && child.material.color) {
      child.material.color.copy(tempColor);
    }
  });

  // GPU CLOCK → rotation speed
  const clockNorm = snap.gpu_clock / METRIC_CONFIG.gpu_clock.max;
  // Use clockNorm in animate() to scale rotation speed
  */
}

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Charts must init after Chart.js CDN script loads
  // Use a small poll to wait for Chart global
  const waitForChart = setInterval(() => {
    if (typeof Chart === "undefined") return;
    clearInterval(waitForChart);

    initCharts();
    initCardInteraction();
    init3D(); // no-op until you uncomment the Three.js block above

    // Run immediately, then on interval
    tick();
    setInterval(tick, POLL_MS);
  }, 50);
});
