// Power Consumption Monitoring Dashboard Kelompook 9

// =====================================
// MQTT CONFIG
// =====================================

const broker = "wss://public.cloud.shiftr.io:443";

const options = {
  username: "public",
  password: "public",
  clientId: "web_" + Math.random().toString(16).slice(2)
};

const dataTopic = "LBCMH/1/data";
const cmdTopic  = "LBCMH/1/cmd";

// =====================================
// SELECTED METRIC
// =====================================

let selectedMetric = "voltage";

// =====================================
// METRIC CONFIG
// =====================================

const metricConfig = {
  voltage: {
    label: "Voltage (V)",
    color: "#3b82f6"
  },

  current: {
    label: "Current (A)",
    color: "#22c55e"
  },

  power: {
    label: "Power (W)",
    color: "#facc15"
  },

  pf: {
    label: "Power Factor",
    color: "#c084fc"
  }
};

// =====================================
// THRESHOLD CONFIG
// =====================================

const thresholds = {
  voltage: {
    min: 210,
    max: 230
  },

  current: {
    min: 0,
    max: 0.7
  },

  power: {
    min: 0,
    max: 100
  },

  pf: {
    min: 0.85,
    max: 1
  }
};

// =====================================
// ELECTRICITY TARIFF
// =====================================

const electricityTariff = {
  "900": 1352,
  "1300": 1444.70,
  "3500": 1699.53
};

// =====================================
// USER CONFIG
// =====================================

const userVA = "1300";

// =====================================
// MQTT CONNECT
// =====================================

const client = mqtt.connect(
  broker,
  options
);

// =====================================
// HISTORY DATA
// =====================================

const labels = [];

const historyTimestamps = [];

const historyData = {
  voltage: [],
  current: [],
  power: [],
  pf: []
};

// =====================================
// CSV HISTORY DATA
// =====================================

const csvHistory = [];

// =====================================
// ENERGY TRACKING
// =====================================

let totalEnergyKwh = 0;
let previousTimestamp = null;

// =====================================
// RELAY STATE
// =====================================

let lastRelayState = null;

// =====================================
// DEVICE STATUS
// =====================================

let offlineTimer = null;
let wasOffline = false;

// =====================================
// CREATE CHART
// =====================================

const ctx = document
  .getElementById("powerChart")
  .getContext("2d");

const powerChart = new Chart(ctx, {
  type: "line",

  data: {
    labels: labels,

    datasets: [{
      label: metricConfig[selectedMetric].label,
      data: historyData[selectedMetric],
      borderColor: metricConfig[selectedMetric].color,
      backgroundColor: metricConfig[selectedMetric].color + "33",
      fill: true,
      tension: 0.4,
      borderWidth: 3,
      pointRadius: 3,
      pointHoverRadius: 6
    }]
  },

  options: {
    responsive: true,
    maintainAspectRatio: false,

    animation: {
      duration: 500
    },

    scales: {
      x: {
        ticks: {
          color: "white"
        },

        grid: {
          color: "rgba(255,255,255,0.05)"
        }
      },

      y: {
        ticks: {
          color: "white"
        },

        grid: {
          color: "rgba(255,255,255,0.05)"
        }
      }
    },

    plugins: {
      legend: {
        labels: {
          color: "white"
        }
      }
    }
  }
});

// =====================================
// HELPER FUNCTION
// =====================================

function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.innerText = value;
  }
}

function parseRelayState(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "TRUE" ||
    value === "ON" ||
    value === "on"
  );
}

function relayStateToText(isOn) {
  if (isOn === true) {
    return "ON";
  }

  if (isOn === false) {
    return "OFF";
  }

  return "UNKNOWN";
}

function updateRelayUI(isOn) {
  lastRelayState = isOn;

  const relayStatus =
    document.getElementById("relayStatus");

  if (relayStatus) {
    relayStatus.innerText =
      isOn ? "Relay: ON" : "Relay: OFF";

    relayStatus.classList.toggle(
      "on",
      isOn
    );
  }

  setText(
    "relaySwitchText",
    isOn ? "Switch ON" : "Switch OFF"
  );

  const relaySwitch =
    document.getElementById("relaySwitch");

  if (relaySwitch) {
    relaySwitch.checked = isOn;
  }
}

// =====================================
// MQTT COMMAND
// =====================================

function sendCommand(command) {
  console.log("Command sent:", command);
  console.log("Publish topic:", cmdTopic);
  console.log("MQTT connected:", client.connected());

  client.publish(
    cmdTopic,
    command
  );

  addNotification(
    "online",
    "Command sent: " + command
  );

  return true;
}

// =====================================
// MONTHLY COST CALCULATION
// =====================================

function updateMonthlyCost() {
  if (historyTimestamps.length < 2)
    return;

  const firstTime =
    new Date(
      historyTimestamps[0]
    ).getTime();

  const lastTime =
    new Date(
      historyTimestamps[
        historyTimestamps.length - 1
      ]
    ).getTime();

  const durationMs =
    lastTime - firstTime;

  if (durationMs <= 0)
    return;

  const kwhPerMs =
    totalEnergyKwh / durationMs;

  const thirtyDaysMs =
    30 * 24 * 60 * 60 * 1000;

  const projectedMonthlyKwh =
    kwhPerMs * thirtyDaysMs;

  const tariff =
    electricityTariff[userVA];

  const estimatedCost =
    projectedMonthlyKwh * tariff;

  const costValue =
    document.querySelector(".cost-value");

  if (costValue) {
    costValue.innerText =
      "Rp " +
      estimatedCost.toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 0
        }
      );
  }
}

// =====================================
// NOTIFICATION SYSTEM
// =====================================

function addNotification(type, text) {
  const notificationList =
    document.getElementById(
      "notificationList"
    );

  if (!notificationList)
    return;

  const item =
    document.createElement("div");

  item.className =
    "notification-item " +
    (
      type === "online"
        ? "notification-online"
        : "notification-offline"
    );

  item.innerHTML = `
    <div class="notification-title">
      ${text}
    </div>

    <div class="notification-time">
      ${new Date().toLocaleString()}
    </div>
  `;

  notificationList.prepend(item);

  if (notificationList.children.length > 20) {
    notificationList.removeChild(
      notificationList.lastChild
    );
  }
}

// =====================================
// STATUS UPDATE
// =====================================

function setDeviceStatus(isOnline) {
  const status =
    document.querySelector(".status");

  if (!status)
    return;

  if (isOnline) {
    status.classList.remove("offline");
    status.classList.add("online");

    status.innerHTML = `
      <span class="dot"></span>
      Online
    `;

    if (wasOffline) {
      addNotification(
        "online",
        "Device reconnected"
      );

      wasOffline = false;
    }

  } else {
    status.classList.remove("online");
    status.classList.add("offline");

    status.innerHTML = `
      <span class="dot"></span>
      Offline
    `;

    wasOffline = true;
  }
}

// =====================================
// OFFLINE DETECTION
// =====================================

function resetOfflineTimer() {
  clearTimeout(offlineTimer);

  offlineTimer = setTimeout(() => {
    setDeviceStatus(false);

    addNotification(
      "offline",
      "Device disconnected"
    );

  }, 10000);
}

// =====================================
// CHECK METRIC STATUS
// =====================================

function updateMetricStatus(metric, value) {
  const card =
    document.querySelector(
      `[data-metric="${metric}"]`
    );

  if (!card)
    return;

  const statusText =
    card.querySelector(".status-text");

  if (!statusText)
    return;

  const config =
    thresholds[metric];

  if (!config)
    return;

  if (
    value < config.min ||
    value > config.max
  ) {
    card.classList.add("danger");

    statusText.innerHTML =
      "● Warning";

    statusText.style.color =
      "#ef4444";

    addNotification(
      "offline",
      `${metric.toUpperCase()} abnormal (${value.toFixed(2)})`
    );

  } else {
    card.classList.remove("danger");

    statusText.innerHTML =
      "● Normal";

    statusText.style.color =
      "#4ade80";
  }
}

// =====================================
// UPDATE CHART SCALE
// =====================================

function updateChartScale() {
  if (selectedMetric === "pf") {
    powerChart.options.scales.y.min = 0.8;
    powerChart.options.scales.y.max = 1;
  } else {
    powerChart.options.scales.y.min = undefined;
    powerChart.options.scales.y.max = undefined;
  }
}

// =====================================
// CSV EXPORT
// =====================================

function csvEscape(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return '"' +
      text.replace(/"/g, '""') +
      '"';
  }

  return text;
}

function downloadCSV() {
  if (csvHistory.length === 0) {
    addNotification(
      "offline",
      "No data to export"
    );

    return;
  }

  const headers = [
    "timestamp",
    "local_time",
    "voltage_v",
    "current_a",
    "power_w",
    "energy_kwh_pzem",
    "frequency_hz",
    "power_factor",
    "relay_state",
    "estimated_session_energy_kwh"
  ];

  const rows =
    csvHistory.map(row => [
      row.timestamp,
      row.localTime,
      row.voltage,
      row.current,
      row.power,
      row.energy,
      row.frequency,
      row.pf,
      row.relayState,
      row.totalEnergyKwh
    ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(csvEscape).join(",")
    )
  ].join("\n");

  const blob = new Blob(
    ["\uFEFF" + csvContent],
    {
      type: "text/csv;charset=utf-8;"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const now =
    new Date();

  const filename =
    "powermonitor_" +
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "_" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    ".csv";

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  addNotification(
    "online",
    "CSV exported: " + filename
  );
}

function clearNotifications() {
  const notificationList =
    document.getElementById(
      "notificationList"
    );

  if (!notificationList)
    return;

  notificationList.innerHTML = "";

  console.log("Notifications cleared");
}

function createExportButton() {
  if (document.getElementById("exportCsvBtn"))
    return;

  const actionRow =
    document.createElement("div");

  actionRow.id = "notificationActionRow";

  actionRow.style.display = "flex";
  actionRow.style.gap = "10px";
  actionRow.style.marginTop = "12px";
  actionRow.style.flexWrap = "wrap";

  const exportButton =
    document.createElement("button");

  exportButton.id = "exportCsvBtn";
  exportButton.innerText = "Export CSV";

  exportButton.style.padding = "10px 14px";
  exportButton.style.border = "none";
  exportButton.style.borderRadius = "10px";
  exportButton.style.background = "#38bdf8";
  exportButton.style.color = "#020617";
  exportButton.style.fontWeight = "700";
  exportButton.style.cursor = "pointer";

  exportButton.addEventListener("click", () => {
    downloadCSV();
  });

  const clearButton =
    document.createElement("button");

  clearButton.id = "clearNotificationBtn";
  clearButton.innerText = "Clear";

  clearButton.style.padding = "10px 14px";
  clearButton.style.border = "none";
  clearButton.style.borderRadius = "10px";
  clearButton.style.background = "#ef4444";
  clearButton.style.color = "white";
  clearButton.style.fontWeight = "700";
  clearButton.style.cursor = "pointer";

  clearButton.addEventListener("click", () => {
    clearNotifications();
  });

  actionRow.appendChild(exportButton);
  actionRow.appendChild(clearButton);

  const notificationHeader =
    document.querySelector(
      ".notification-header"
    );

  if (notificationHeader) {
    notificationHeader.appendChild(actionRow);
    return;
  }

  const topRight =
    document.querySelector(".top-right");

  if (topRight) {
    topRight.appendChild(actionRow);
    return;
  }

  document.body.appendChild(actionRow);
}

// =====================================
// MQTT CONNECTED
// =====================================

client.on("connect", () => {
  console.log("MQTT Connected");

  client.subscribe(dataTopic, (err) => {
    if (err) {
      console.log("Subscribe error:", err);

      addNotification(
        "offline",
        "Subscribe error"
      );
    } else {
      console.log("Subscribed to:", dataTopic);

      addNotification(
        "online",
        "MQTT broker connected"
      );
    }
  });
});

// =====================================
// MQTT DISCONNECT / ERROR
// =====================================

client.on("offline", () => {
  setDeviceStatus(false);

  addNotification(
    "offline",
    "MQTT broker offline"
  );
});

client.on("close", () => {
  console.log("MQTT Disconnected");
});

client.on("reconnect", () => {
  console.log("MQTT Reconnecting...");
});

client.on("error", (err) => {
  console.log("MQTT Error:", err);

  addNotification(
    "offline",
    "MQTT error"
  );
});

// =====================================
// RECEIVE DATA
// =====================================

client.on("message", (topic, message) => {
  const raw = message.toString().trim();

  console.log("Topic:", topic);
  console.log("Raw message:", raw);

  let data;

  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.log("Payload bukan JSON valid:", raw);

    addNotification(
      "offline",
      "Invalid MQTT payload"
    );

    return;
  }

  const voltage =
    Number(data.voltage);

  const current =
    Number(data.current);

  const power =
    Number(data.power);

  const pf =
    Number(data.pf);

  const energy =
    Number(data.energy);

  const frequency =
    Number(data.frequency);

  if (
    isNaN(voltage) ||
    isNaN(current) ||
    isNaN(power) ||
    isNaN(pf)
  ) {
    console.log("Data sensor tidak valid:", data);

    addNotification(
      "offline",
      "Sensor data invalid"
    );

    return;
  }

  console.log("Data valid:", data);

  // =====================================
  // ONLINE STATUS
  // =====================================

  setDeviceStatus(true);
  resetOfflineTimer();

  // =====================================
  // RELAY STATUS FROM ESP32
  // =====================================

  if (data.relay_state !== undefined) {
    const relayState =
      parseRelayState(data.relay_state);

    updateRelayUI(relayState);
  }

  // =====================================
  // UPDATE CARD VALUE
  // =====================================

  setText(
    "voltage",
    voltage.toFixed(1) + " V"
  );

  setText(
    "current",
    current.toFixed(2) + " A"
  );

  setText(
    "power",
    power.toFixed(1) + " W"
  );

  setText(
    "pf",
    pf.toFixed(2)
  );

  if (!isNaN(energy)) {
    setText(
      "energy",
      energy.toFixed(3) + " kWh"
    );
  }

  if (!isNaN(frequency)) {
    setText(
      "frequency",
      frequency.toFixed(1) + " Hz"
    );
  }

  // =====================================
  // UPDATE METRIC STATUS
  // =====================================

  updateMetricStatus(
    "voltage",
    voltage
  );

  updateMetricStatus(
    "current",
    current
  );

  updateMetricStatus(
    "power",
    power
  );

  updateMetricStatus(
    "pf",
    pf
  );

  // =====================================
  // TIME HANDLING
  // =====================================

  const time = data.timestamp
    ? new Date(data.timestamp)
    : new Date();

  const timestampISO =
    time.toISOString();

  const localTime =
    time.toLocaleString();

  setText(
    "lastUpdate",
    "Last Update: " + localTime
  );

  // =====================================
  // SAVE LABEL
  // =====================================

  labels.push(
    time.toLocaleTimeString()
  );

  // =====================================
  // SAVE TIMESTAMP
  // =====================================

  historyTimestamps.push(
    timestampISO
  );

  // =====================================
  // SAVE HISTORY
  // =====================================

  historyData.voltage.push(
    voltage
  );

  historyData.current.push(
    current
  );

  historyData.power.push(
    power
  );

  historyData.pf.push(
    pf
  );

  // =====================================
  // ENERGY INTEGRATION
  // =====================================

  const currentTimestamp =
    time.getTime();

  if (previousTimestamp !== null) {
    const deltaHour =
      (
        currentTimestamp -
        previousTimestamp
      ) / 1000 / 60 / 60;

    const energyKwh =
      (power / 1000) * deltaHour;

    totalEnergyKwh +=
      energyKwh;
  }

  previousTimestamp =
    currentTimestamp;

  // =====================================
  // SAVE CSV HISTORY
  // =====================================

  csvHistory.push({
    timestamp: timestampISO,
    localTime: localTime,
    voltage: voltage.toFixed(1),
    current: current.toFixed(2),
    power: power.toFixed(1),
    energy: isNaN(energy)
      ? ""
      : energy.toFixed(3),
    frequency: isNaN(frequency)
      ? ""
      : frequency.toFixed(1),
    pf: pf.toFixed(2),
    relayState: relayStateToText(lastRelayState),
    totalEnergyKwh: totalEnergyKwh.toFixed(6)
  });

  // =====================================
  // LIMIT HISTORY
  // =====================================

  if (labels.length > 1000) {
    labels.shift();

    historyTimestamps.shift();

    historyData.voltage.shift();
    historyData.current.shift();
    historyData.power.shift();
    historyData.pf.shift();
  }

  if (csvHistory.length > 5000) {
    csvHistory.shift();
  }

  // =====================================
  // UPDATE CHART DATA
  // =====================================

  powerChart.data.datasets[0].data =
    historyData[selectedMetric];

  powerChart.data.datasets[0].label =
    metricConfig[selectedMetric].label;

  powerChart.data.datasets[0].borderColor =
    metricConfig[selectedMetric].color;

  powerChart.data.datasets[0].backgroundColor =
    metricConfig[selectedMetric].color + "33";

  // =====================================
  // MONTHLY COST
  // =====================================

  updateMonthlyCost();

  // =====================================
  // PF SCALE FIX
  // =====================================

  updateChartScale();

  powerChart.update();
});

// =====================================
// CARD CLICK EVENT
// =====================================

const cards =
  document.querySelectorAll(
    ".card[data-metric]"
  );

cards.forEach(card => {
  card.addEventListener("click", () => {
    cards.forEach(c => {
      c.classList.remove("active");
    });

    card.classList.add("active");

    selectedMetric =
      card.dataset.metric;

    console.log(
      "Selected:",
      selectedMetric
    );

    powerChart.data.datasets[0].label =
      metricConfig[selectedMetric].label;

    powerChart.data.datasets[0].borderColor =
      metricConfig[selectedMetric].color;

    powerChart.data.datasets[0].backgroundColor =
      metricConfig[selectedMetric].color + "33";

    powerChart.data.datasets[0].data =
      historyData[selectedMetric];

    updateChartScale();

    powerChart.update();
  });
});

// =====================================
// RELAY BUTTON CONTROL
// =====================================

const relayOn =
  document.getElementById("relayOn");

const relayOff =
  document.getElementById("relayOff");

if (relayOn) {
  relayOn.addEventListener("click", () => {
    console.log("Relay ON button clicked");

    client.publish(
      cmdTopic,
      "ON"
    );

    const relayStatus =
      document.getElementById("relayStatus");

    if (relayStatus) {
      relayStatus.innerText =
        "Relay: ON command sent";

      relayStatus.classList.add("on");
    }

    setText(
      "relaySwitchText",
      "Switch ON"
    );

    const relaySwitch =
      document.getElementById("relaySwitch");

    if (relaySwitch) {
      relaySwitch.checked = true;
    }

    addNotification(
      "online",
      "Relay ON command sent"
    );
  });
}

if (relayOff) {
  relayOff.addEventListener("click", () => {
    console.log("Relay OFF button clicked");

    client.publish(
      cmdTopic,
      "OFF"
    );

    const relayStatus =
      document.getElementById("relayStatus");

    if (relayStatus) {
      relayStatus.innerText =
        "Relay: OFF command sent";

      relayStatus.classList.remove("on");
    }

    setText(
      "relaySwitchText",
      "Switch OFF"
    );

    const relaySwitch =
      document.getElementById("relaySwitch");

    if (relaySwitch) {
      relaySwitch.checked = false;
    }

    addNotification(
      "online",
      "Relay OFF command sent"
    );
  });
}

// =====================================
// OPTIONAL RELAY SWITCH CONTROL
// =====================================

const relaySwitch =
  document.getElementById("relaySwitch");

if (relaySwitch) {
  relaySwitch.addEventListener("change", () => {
    if (relaySwitch.checked) {
      console.log("Relay switch ON");

      client.publish(
        cmdTopic,
        "ON"
      );

      updateRelayUI(true);

      setText(
        "relayStatus",
        "Relay: ON command sent"
      );

      const relayStatus =
        document.getElementById("relayStatus");

      if (relayStatus) {
        relayStatus.classList.add("on");
      }

      addNotification(
        "online",
        "Relay ON command sent"
      );
    }

    else {
      console.log("Relay switch OFF");

      client.publish(
        cmdTopic,
        "OFF"
      );

      updateRelayUI(false);

      setText(
        "relayStatus",
        "Relay: OFF command sent"
      );

      const relayStatus =
        document.getElementById("relayStatus");

      if (relayStatus) {
        relayStatus.classList.remove("on");
      }

      addNotification(
        "online",
        "Relay OFF command sent"
      );
    }
  });
}

// =====================================
// OPTIONAL INFO BUTTON
// =====================================

const relayInfo =
  document.getElementById("relayInfo");

const btnInfo =
  document.getElementById("btnInfo");

if (relayInfo) {
  relayInfo.addEventListener("click", () => {
    sendCommand("INFO");
  });
}

if (btnInfo) {
  btnInfo.addEventListener("click", () => {
    sendCommand("INFO");
  });
}

// =====================================
// INIT UI
// =====================================

createExportButton();