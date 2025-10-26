// Replace this link with your S3 public CSV link
const CSV_URL =
  "https://smart-irrigation-data1.s3.us-east-1.amazonaws.com/analyzed_data.csv?cacheBust=" +
  Date.now();

let moistureChart, temperatureChart;

async function fetchData() {
  const response = await fetch(CSV_URL + Date.now()); // prevent caching
  const data = await response.text();
  const rows = data.split("\n").slice(1);

  const timestamps = [];
  const moisture = [];
  const temperature = [];

  const tableBody = document.querySelector("#dataTable tbody");
  tableBody.innerHTML = "";

  let latestSoil = 0;
  let latestPump = "";
  let latestRain = 0;

  rows.forEach((row) => {
    const cols = row.split(",");
    if (cols.length > 4) {
      const time = cols[0];
      const moist = parseFloat(cols[1]);
      const temp = parseFloat(cols[2]);
      const rain = parseFloat(cols[3]);
      const pump = cols[4];

      timestamps.push(time);
      moisture.push(moist);
      temperature.push(temp);

      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${time}</td><td>${moist}</td><td>${temp}</td><td>${pump}</td><td>${rain}</td>`;
      tableBody.appendChild(tr);

      latestSoil = moist;
      latestPump = pump;
      latestRain = rain;
    }
  });

  // Update charts
  updateCharts(timestamps, moisture, temperature);

  // Update soil moisture meter
  const meter = document.getElementById("soilMeter");
  meter.style.width = Math.min(latestSoil / 8, 100) + "%"; // scale 0-800 to 0-100%

  // Update Pump Status and Rain
  // Update Pump Status and Rain
  const pumpElem = document.getElementById("pumpIcon");
  document.getElementById("pumpStatus").innerText = latestPump;
  document.getElementById("pumpStatus").style.color =
    latestPump === "ON" ? "red" : "green";
  document.getElementById("rainForecast").innerText = latestRain;

  // Animate Pump Icon
  if (latestPump === "ON") {
    pumpElem.classList.remove("pump-off");
    pumpElem.classList.add("pump-on");
  } else {
    pumpElem.classList.remove("pump-on");
    pumpElem.classList.add("pump-off");
  }
  if (latestPump === "ON") {
    pumpElem.classList.remove("pump-off");
    pumpElem.classList.add("pump-on");
  } else {
    pumpElem.classList.remove("pump-on");
    pumpElem.classList.add("pump-off");
  }
}

// Chart.js setup
function createCharts() {
  const ctxMoisture = document.getElementById("moistureChart").getContext("2d");
  const ctxTemp = document.getElementById("temperatureChart").getContext("2d");

  moistureChart = new Chart(ctxMoisture, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Soil Moisture (%)",
          data: [],
          borderColor: "green",
          fill: false,
          tension: 0.3,
        },
      ],
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } },
  });

  temperatureChart = new Chart(ctxTemp, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Temperature (°C)",
          data: [],
          borderColor: "orange",
          fill: false,
          tension: 0.3,
        },
      ],
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } },
  });
}

function updateCharts(timestamps, moisture, temperature) {
  moistureChart.data.labels = timestamps;
  moistureChart.data.datasets[0].data = moisture;
  moistureChart.update();

  temperatureChart.data.labels = timestamps;
  temperatureChart.data.datasets[0].data = temperature;
  temperatureChart.update();
}

// Initialize dashboard
createCharts();
fetchData();
setInterval(fetchData, 10000); // refresh every 10 sec
