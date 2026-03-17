const bankAssetsInput = document.getElementById("bankAssets");
const liquidityBufferPctInput = document.getElementById("liquidityBufferPct");
const hqlaSharePctInput = document.getElementById("hqlaSharePct");
const govBondSharePctInput = document.getElementById("govBondSharePct");
const stressAdjustmentPctInput = document.getElementById("stressAdjustmentPct");
const regionLabelInput = document.getElementById("regionLabel");

const calculateBtn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");

const bondDemandValueEl = document.getElementById("bondDemandValue");
const liquidityBufferValueEl = document.getElementById("liquidityBufferValue");
const hqlaStockValueEl = document.getElementById("hqlaStockValue");
const demandStatusValueEl = document.getElementById("demandStatusValue");

const assetsDisplayEl = document.getElementById("assetsDisplay");
const bufferDisplayEl = document.getElementById("bufferDisplay");
const hqlaDisplayEl = document.getElementById("hqlaDisplay");
const govBondDisplayEl = document.getElementById("govBondDisplay");
const interpretationTextEl = document.getElementById("interpretationText");
const scenarioTableBodyEl = document.getElementById("scenarioTableBody");

let compositionChart = null;
let scenarioChart = null;

function formatTrillions(value) {
  return `$${value.toFixed(2)}T`;
}

function getInputs() {
  return {
    assets: Number(bankAssetsInput.value) || 0,
    bufferPct: Number(liquidityBufferPctInput.value) || 0,
    hqlaPct: Number(hqlaSharePctInput.value) || 0,
    govPct: Number(govBondSharePctInput.value) || 0,
    stressPct: Number(stressAdjustmentPctInput.value) || 0,
    label: regionLabelInput.value.trim()
  };
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function calculateMetrics(data) {
  const adjustedBufferPct = data.bufferPct * (1 + data.stressPct / 100);
  const bufferValue = data.assets * (adjustedBufferPct / 100);
  const hqlaValue = bufferValue * (clampPercent(data.hqlaPct) / 100);
  const govBondDemand = hqlaValue * (clampPercent(data.govPct) / 100);

  return {
    adjustedBufferPct,
    bufferValue,
    hqlaValue,
    govBondDemand
  };
}

function getDemandStatus(demandValue) {
  if (demandValue < 0.50) {
    return {
      label: "Low",
      summaryClass: "status-low",
      badgeClass: "badge-low"
    };
  }

  if (demandValue < 1.50) {
    return {
      label: "Moderate",
      summaryClass: "status-moderate",
      badgeClass: "badge-moderate"
    };
  }

  return {
    label: "High",
    summaryClass: "status-high",
    badgeClass: "badge-high"
  };
}

function buildInterpretation(metrics, data) {
  const status = getDemandStatus(metrics.govBondDemand).label;
  const labelPart = data.label ? ` for ${data.label}` : "";

  if (status === "High") {
    return `Under the selected assumptions${labelPart}, Basel-style liquidity requirements imply a high level of structural demand for government bonds. This suggests that sovereign securities play a major role in the liquidity architecture of the modeled banking system.`;
  }

  if (status === "Moderate") {
    return `Under the selected assumptions${labelPart}, the modeled banking system generates moderate structural demand for government bonds through its estimated liquidity buffer and HQLA allocation.`;
  }

  return `Under the selected assumptions${labelPart}, the estimated structural demand for government bonds remains relatively limited. This may reflect a smaller liquidity buffer, lower HQLA allocation, or lower sovereign weighting within liquid assets.`;
}

function updateSummary(metrics, data) {
  const status = getDemandStatus(metrics.govBondDemand);

  bondDemandValueEl.textContent = formatTrillions(metrics.govBondDemand);
  liquidityBufferValueEl.textContent = formatTrillions(metrics.bufferValue);
  hqlaStockValueEl.textContent = formatTrillions(metrics.hqlaValue);
  demandStatusValueEl.textContent = status.label;
  demandStatusValueEl.className = `summary-value ${status.summaryClass}`;

  assetsDisplayEl.textContent = formatTrillions(data.assets);
  bufferDisplayEl.textContent = formatTrillions(metrics.bufferValue);
  hqlaDisplayEl.textContent = formatTrillions(metrics.hqlaValue);
  govBondDisplayEl.textContent = formatTrillions(metrics.govBondDemand);

  interpretationTextEl.textContent = buildInterpretation(metrics, data);
}

function buildCompositionChart(metrics, data) {
  const ctx = document.getElementById("compositionChart").getContext("2d");

  if (compositionChart) {
    compositionChart.destroy();
  }

  const nonLiquidityAssets = Math.max(data.assets - metrics.bufferValue, 0);
  const nonGovHqla = Math.max(metrics.hqlaValue - metrics.govBondDemand, 0);

  compositionChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Asset Structure"],
      datasets: [
        {
          label: "Non-Liquidity Assets",
          data: [nonLiquidityAssets]
        },
        {
          label: "Non-HQLA Buffer",
          data: [Math.max(metrics.bufferValue - metrics.hqlaValue, 0)]
        },
        {
          label: "Non-Government HQLA",
          data: [nonGovHqla]
        },
        {
          label: "Government Bond Demand",
          data: [metrics.govBondDemand]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}T`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          }
        },
        y: {
          stacked: true,
          ticks: {
            callback: function(value) {
              return `$${value.toFixed(1)}T`;
            }
          }
        }
      }
    }
  });
}

function buildScenarioData(data) {
  const scenarioDefs = [
    { name: "Base Case", bufferShift: 0 },
    { name: "Tighter Liquidity", bufferShift: 2 },
    { name: "Higher Regulatory Pressure", bufferShift: 4 },
    { name: "Eased Conditions", bufferShift: -2 },
    { name: "Stress Environment", bufferShift: 6 }
  ];

  return scenarioDefs.map((scenario) => {
    const scenarioBufferPct = Math.max(data.bufferPct + scenario.bufferShift, 0);
    const scenarioInputs = {
      ...data,
      bufferPct: scenarioBufferPct
    };
    const metrics = calculateMetrics(scenarioInputs);
    return {
      name: scenario.name,
      bufferPct: metrics.adjustedBufferPct,
      hqlaValue: metrics.hqlaValue,
      govBondDemand: metrics.govBondDemand,
      status: getDemandStatus(metrics.govBondDemand)
    };
  });
}

function buildScenarioChart(data) {
  const ctx = document.getElementById("scenarioChart").getContext("2d");
  const scenarios = buildScenarioData(data);

  if (scenarioChart) {
    scenarioChart.destroy();
  }

  scenarioChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: scenarios.map((item) => item.name),
      datasets: [
        {
          label: "Estimated Government Bond Demand",
          data: scenarios.map((item) => item.govBondDemand),
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Demand: $${context.parsed.y.toFixed(2)}T`;
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: function(value) {
              return `$${value.toFixed(1)}T`;
            }
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function buildScenarioTable(data) {
  const scenarios = buildScenarioData(data);
  scenarioTableBodyEl.innerHTML = "";

  scenarios.forEach((scenario) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${scenario.name}</td>
      <td>${scenario.bufferPct.toFixed(1)}%</td>
      <td>${formatTrillions(scenario.hqlaValue)}</td>
      <td>${formatTrillions(scenario.govBondDemand)}</td>
      <td><span class="badge ${scenario.status.badgeClass}">${scenario.status.label}</span></td>
    `;
    scenarioTableBodyEl.appendChild(row);
  });
}

function updateVisualizer() {
  const inputs = getInputs();
  const metrics = calculateMetrics(inputs);

  updateSummary(metrics, inputs);
  buildCompositionChart(metrics, inputs);
  buildScenarioChart(inputs);
  buildScenarioTable(inputs);
}

function resetVisualizer() {
  bankAssetsInput.value = "10.0";
  liquidityBufferPctInput.value = "15.0";
  hqlaSharePctInput.value = "80.0";
  govBondSharePctInput.value = "70.0";
  stressAdjustmentPctInput.value = "0.0";
  regionLabelInput.value = "";

  updateVisualizer();
}

[
  bankAssetsInput,
  liquidityBufferPctInput,
  hqlaSharePctInput,
  govBondSharePctInput,
  stressAdjustmentPctInput,
  regionLabelInput
].forEach((input) => {
  input.addEventListener("input", updateVisualizer);
});

calculateBtn.addEventListener("click", updateVisualizer);
resetBtn.addEventListener("click", resetVisualizer);

document.addEventListener("DOMContentLoaded", updateVisualizer);
