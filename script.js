// Replace this link with your S3 public CSV link
const CSV_URL =
  "https://smart-irrigation-data1.s3.us-east-1.amazonaws.com/analyzed_data.csv?cacheBust=" +
  Date.now();

// Database configuration (using localStorage as a fallback)
const DB_CONFIG = {
  name: "SmartIrrigationDB",
  version: 1,
  storeName: "users",
};

let moistureChart, temperatureChart;
let currentUser = null;
let notifications = [];

// Database initialization
function initDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn("IndexedDB not supported, using localStorage fallback");
      resolve("localStorage");
      return;
    }

    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

    request.onerror = () => {
      console.error("Database error:", request.error);
      resolve("localStorage");
    };

    request.onsuccess = () => {
      console.log("Database opened successfully");
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
        const store = db.createObjectStore(DB_CONFIG.storeName, {
          keyPath: "username",
        });
        store.createIndex("email", "email", { unique: true });

        // Add a default user for testing
        store.add({
          username: "admin",
          email: "admin@irrigation.com",
          password: "admin123",
        });
      }
    };
  });
}

// User authentication
async function authenticateUser(username, password) {
  const dbType = await initDB();

  if (dbType === "localStorage") {
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem("irrigationUsers") || "{}");
    if (users[username] && users[username].password === password) {
      return { username, email: users[username].email };
    }
    return null;
  } else {
    // Use IndexedDB
    return new Promise((resolve) => {
      const transaction = dbType.transaction([DB_CONFIG.storeName], "readonly");
      const store = transaction.objectStore(DB_CONFIG.storeName);
      const request = store.get(username);

      request.onsuccess = () => {
        const user = request.result;
        if (user && user.password === password) {
          resolve({ username: user.username, email: user.email });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error("Error fetching user:", request.error);
        resolve(null);
      };
    });
  }
}

// Register new user
async function registerUser(username, email, password) {
  const dbType = await initDB();

  if (dbType === "localStorage") {
    // Fallback to localStorage
    const users = JSON.parse(localStorage.getItem("irrigationUsers") || "{}");
    if (users[username]) {
      return { success: false, message: "Username already exists" };
    }

    users[username] = { email, password };
    localStorage.setItem("irrigationUsers", JSON.stringify(users));
    return { success: true };
  } else {
    // Use IndexedDB
    return new Promise((resolve) => {
      const transaction = dbType.transaction(
        [DB_CONFIG.storeName],
        "readwrite"
      );
      const store = transaction.objectStore(DB_CONFIG.storeName);

      // Check if username already exists
      const checkRequest = store.get(username);
      checkRequest.onsuccess = () => {
        if (checkRequest.result) {
          resolve({ success: false, message: "Username already exists" });
          return;
        }

        // Add new user
        const addRequest = store.add({ username, email, password });
        addRequest.onsuccess = () => {
          resolve({ success: true });
        };

        addRequest.onerror = () => {
          resolve({ success: false, message: "Error creating user" });
        };
      };
    });
  }
}

// UI Management
function showLogin() {
  document.getElementById("loginSection").classList.remove("hidden");
  document.getElementById("dashboardSection").classList.add("hidden");
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("registerForm").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("dashboardSection").classList.remove("hidden");
}

function showRegister() {
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("registerForm").classList.remove("hidden");
}

function toggleNotifications() {
  const panel = document.getElementById("notificationsPanel");
  panel.classList.toggle("hidden");
}

function addNotification(message, type = "info") {
  const notification = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date().toLocaleTimeString(),
  };

  notifications.unshift(notification);
  updateNotificationsUI();

  // Show notification count
  const countElement = document.getElementById("notificationCount");
  countElement.textContent = notifications.length;

  // Auto-hide info notifications after 5 seconds
  if (type === "info") {
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  }
}

function removeNotification(id) {
  notifications = notifications.filter(
    (notification) => notification.id !== id
  );
  updateNotificationsUI();

  // Update notification count
  const countElement = document.getElementById("notificationCount");
  countElement.textContent = notifications.length;
}

function updateNotificationsUI() {
  const listElement = document.getElementById("notificationsList");
  listElement.innerHTML = "";

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    item.className = `notification-item ${notification.type}`;
    item.innerHTML = `
      <p>${notification.message}</p>
      <div class="notification-time">${notification.timestamp}</div>
    `;
    listElement.appendChild(item);
  });
}

// Data fetching and processing
async function fetchData() {
  try {
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
        tr.innerHTML = `<td>${time}</td><td>${moist}%</td><td>${temp}°C</td><td>${pump}</td>`;
        tableBody.appendChild(tr);

        latestSoil = moist;
        latestPump = pump;
        latestRain = rain;
      }
    });

    // Update charts
    updateCharts(timestamps, moisture, temperature);

    // Update soil moisture meter and value
    const meter = document.getElementById("soilMeter");
    const soilValue = document.getElementById("soilMoistureValue");
    const moisturePercentage = Math.min(latestSoil / 8, 100);
    meter.style.width = moisturePercentage + "%";
    soilValue.textContent = `${moisturePercentage.toFixed(1)}%`;

    // Update Pump Status and Rain
    const pumpElem = document.getElementById("pumpIcon");
    const pumpStatusElem = document.getElementById("pumpStatus");
    pumpStatusElem.textContent = latestPump;
    pumpStatusElem.style.color = latestPump === "ON" ? "red" : "green";
    document.getElementById("rainForecast").textContent = `${latestRain} mm`;

    // Animate Pump Icon
    if (latestPump === "ON") {
      pumpElem.classList.remove("pump-off");
      pumpElem.classList.add("pump-on");
    } else {
      pumpElem.classList.remove("pump-on");
      pumpElem.classList.add("pump-off");
    }

    // Check for notifications
    checkForNotifications(latestSoil, latestPump, latestRain);
  } catch (error) {
    console.error("Error fetching data:", error);
    addNotification("Failed to fetch sensor data", "danger");
  }
}

function checkForNotifications(soilMoisture, pumpStatus, rainForecast) {
  const moisturePercentage = Math.min(soilMoisture / 8, 100);

  // Check if soil is too dry and pump is off
  if (moisturePercentage < 30 && pumpStatus === "OFF") {
    addNotification(
      "Soil moisture is low. Consider turning on the pump.",
      "warning"
    );
  }

  // Check if rain is forecasted
  if (rainForecast > 5) {
    addNotification(
      `Rain forecast: ${rainForecast}mm. Pump may not be needed.`,
      "info"
    );
  }

  // Check if soil is too wet but pump is on
  if (moisturePercentage > 80 && pumpStatus === "ON") {
    addNotification(
      "Soil moisture is high. Consider turning off the pump.",
      "warning"
    );
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
          backgroundColor: "rgba(76, 175, 80, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Moisture (%)",
          },
        },
        x: {
          title: {
            display: true,
            text: "Time",
          },
        },
      },
    },
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
          backgroundColor: "rgba(255, 152, 0, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Temperature (°C)",
          },
        },
        x: {
          title: {
            display: true,
            text: "Time",
          },
        },
      },
    },
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

// Event Listeners
document.addEventListener("DOMContentLoaded", function () {
  // Login form submission
  document
    .getElementById("loginForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      const user = await authenticateUser(username, password);
      if (user) {
        currentUser = user;
        showDashboard();
        addNotification(`Welcome back, ${user.username}!`, "info");
      } else {
        alert("Invalid username or password");
      }
    });

  // Register form submission
  document
    .getElementById("registerForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const username = document.getElementById("regUsername").value;
      const email = document.getElementById("regEmail").value;
      const password = document.getElementById("regPassword").value;

      const result = await registerUser(username, email, password);
      if (result.success) {
        alert("Registration successful! Please login.");
        showLogin();
      } else {
        alert(result.message || "Registration failed");
      }
    });

  // Show register form
  document
    .getElementById("showRegister")
    .addEventListener("click", function (e) {
      e.preventDefault();
      showRegister();
    });

  // Show login form
  document.getElementById("showLogin").addEventListener("click", function (e) {
    e.preventDefault();
    showLogin();
  });

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", function () {
    currentUser = null;
    showLogin();
    addNotification("You have been logged out", "info");
  });

  // Notifications
  document
    .getElementById("notificationIcon")
    .addEventListener("click", toggleNotifications);
  document
    .getElementById("closeNotifications")
    .addEventListener("click", toggleNotifications);

  // Manual pump control
  document
    .getElementById("manualPumpBtn")
    .addEventListener("click", function () {
      addNotification(
        "Manual pump control is not implemented in this demo",
        "info"
      );
    });

  // Initialize dashboard
  createCharts();
  fetchData();
  setInterval(fetchData, 10000); // refresh every 10 sec
});
