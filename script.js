/* ═══════════════════════════════════════════════════════════
   MOODCAST — Main Application Script

   APIs used:
     1. Geolocation API  (browser) — gets user coordinates
     2. localStorage API (browser) — persists entries across sessions
     3. Open-Meteo API   (data)    — fetches real-time weather (free, no key)
   ═══════════════════════════════════════════════════════════ */

// ── Constants ─────────────────────────────────────────────
const MOODS = [
  { id: 'joyful',   emoji: '😄', label: 'Joyful',   color: '#e07a56' },
  { id: 'calm',     emoji: '😌', label: 'Calm',     color: '#5a7a5a' },
  { id: 'anxious',  emoji: '😰', label: 'Anxious',  color: '#9c8670' },
  { id: 'sad',      emoji: '😔', label: 'Sad',      color: '#4a7fa5' },
  { id: 'angry',    emoji: '😤', label: 'Angry',    color: '#b85c38' },
  { id: 'focused',  emoji: '🎯', label: 'Focused',  color: '#5a7a5a' },
  { id: 'tired',    emoji: '😴', label: 'Tired',    color: '#8fa0b0' },
  { id: 'excited',  emoji: '🤩', label: 'Excited',  color: '#e07a56' },
  { id: 'grateful', emoji: '🙏', label: 'Grateful', color: '#9c8670' },
  { id: 'meh',      emoji: '😐', label: 'Meh',      color: '#c8b89a' },
];

const WMO_CODES = {
  0:  { label: 'Clear sky',       icon: '☀️' },
  1:  { label: 'Mainly clear',    icon: '🌤️' },
  2:  { label: 'Partly cloudy',   icon: '⛅' },
  3:  { label: 'Overcast',        icon: '☁️' },
  45: { label: 'Foggy',           icon: '🌫️' },
  48: { label: 'Rime fog',        icon: '🌫️' },
  51: { label: 'Light drizzle',   icon: '🌦️' },
  53: { label: 'Drizzle',         icon: '🌦️' },
  55: { label: 'Heavy drizzle',   icon: '🌧️' },
  61: { label: 'Slight rain',     icon: '🌧️' },
  63: { label: 'Rain',            icon: '🌧️' },
  65: { label: 'Heavy rain',      icon: '🌧️' },
  71: { label: 'Slight snow',     icon: '🌨️' },
  73: { label: 'Snow',            icon: '❄️' },
  75: { label: 'Heavy snow',      icon: '❄️' },
  80: { label: 'Rain showers',    icon: '🌦️' },
  81: { label: 'Rain showers',    icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  95: { label: 'Thunderstorm',    icon: '⛈️' },
  99: { label: 'Thunderstorm',    icon: '⛈️' },
};

const STORAGE_KEY = 'moodcast_entries';

// ── State ──────────────────────────────────────────────────
let selectedMood = null;
let currentWeather = null;
let entries = loadEntries();

// ── DOM references ─────────────────────────────────────────
const headerDate        = document.getElementById('header-date');
const weatherLoading    = document.getElementById('weather-loading');
const weatherError      = document.getElementById('weather-error');
const weatherErrorMsg   = document.getElementById('weather-error-msg');
const retryWeatherBtn   = document.getElementById('retry-weather-btn');
const weatherDisplay    = document.getElementById('weather-display');
const logBtn            = document.getElementById('log-btn');
const moodGrid          = document.getElementById('mood-grid');
const energySlider      = document.getElementById('energy-slider');
const moodNote          = document.getElementById('mood-note');
const logList           = document.getElementById('log-list');
const patternsContainer = document.getElementById('patterns-container');
const miniChart         = document.getElementById('mini-chart');
const toast             = document.getElementById('toast');

// ── Init ───────────────────────────────────────────────────
function init() {
  renderDate();
  renderMoodGrid();
  renderLog();
  renderPatterns();
  renderMiniChart();
  fetchWeather();
  retryWeatherBtn.addEventListener('click', fetchWeather);
  logBtn.addEventListener('click', handleLog);
}

// ── Date display ───────────────────────────────────────────
function renderDate() {
  const now = new Date();
  headerDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── API #1: Geolocation (browser API) ─────────────────────
// ── API #3: Open-Meteo (data API) ─────────────────────────
function fetchWeather() {
  weatherLoading.style.display = 'flex';
  weatherError.style.display = 'none';
  weatherDisplay.classList.remove('loaded');

  if (!navigator.geolocation) {
    showWeatherError('Geolocation is not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      await fetchOpenMeteo(latitude, longitude);
    },
    (err) => {
      let msg = 'Location access denied.';
      if (err.code === 1) {
        msg = 'Location permission denied. Please allow location access and retry.';
      } else if (err.code === 2) {
        msg = 'Location unavailable. Check your connection.';
      } else if (err.code === 3) {
        msg = 'Location request timed out.';
      }
      showWeatherError(msg);
    },
    { timeout: 10000 }
  );
}

async function fetchOpenMeteo(lat, lon) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
      `wind_speed_10m,uv_index,weather_code` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Derive a city name from Open-Meteo's timezone field
    const tz = data.timezone || '';
    const city = tz.split('/').pop().replace(/_/g, ' ');

    const cur = data.current;
    const wmo = WMO_CODES[cur.weather_code] || { label: 'Unknown', icon: '🌡️' };

    currentWeather = {
      temp:     Math.round(cur.temperature_2m),
      feels:    Math.round(cur.apparent_temperature),
      humidity: cur.relative_humidity_2m,
      wind:     Math.round(cur.wind_speed_10m),
      uv:       cur.uv_index,
      desc:     wmo.label,
      icon:     wmo.icon,
      code:     cur.weather_code,
      city,
      lat,
      lon,
    };

    displayWeather(currentWeather);
    logBtn.disabled = !selectedMood;
  } catch (e) {
    showWeatherError('Failed to fetch weather data. Check your connection.');
  }
}

function displayWeather(w) {
  document.getElementById('w-temp').innerHTML      = `${w.temp}<sup>°F</sup>`;
  document.getElementById('w-feels').textContent   = `${w.feels}°F`;
  document.getElementById('w-humidity').textContent = `${w.humidity}%`;
  document.getElementById('w-wind').textContent    = `${w.wind} mph`;
  document.getElementById('w-uv').textContent      = w.uv;
  document.getElementById('w-desc').textContent    = w.desc;
  document.getElementById('w-icon').textContent    = w.icon;
  document.getElementById('w-location').textContent = w.city ? `📍 ${w.city}` : '';

  weatherLoading.style.display = 'none';
  weatherDisplay.classList.add('loaded');
}

function showWeatherError(msg) {
  weatherLoading.style.display = 'none';
  weatherErrorMsg.textContent = msg;
  weatherError.style.display = 'flex';
}

// ── Mood Grid ──────────────────────────────────────────────
function renderMoodGrid() {
  moodGrid.innerHTML = '';
  MOODS.forEach((mood) => {
    const btn = document.createElement('button');
    btn.className = 'mood-btn';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', mood.label);
    btn.dataset.id = mood.id;
    btn.innerHTML = `
      <span class="emoji">${mood.emoji}</span>
      <span class="mood-name">${mood.label}</span>
    `;
    btn.addEventListener('click', () => selectMood(mood.id));
    moodGrid.appendChild(btn);
  });
}

function selectMood(id) {
  selectedMood = id;
  moodGrid.querySelectorAll('.mood-btn').forEach((btn) => {
    const active = btn.dataset.id === id;
    btn.classList.toggle('selected', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  logBtn.disabled = !currentWeather;
}

// ── Log Entry ──────────────────────────────────────────────
function handleLog() {
  if (!selectedMood || !currentWeather) return;

  const mood = MOODS.find((m) => m.id === selectedMood);
  const entry = {
    id:        Date.now(),
    timestamp: new Date().toISOString(),
    mood:      mood.id,
    emoji:     mood.emoji,
    energy:    parseInt(energySlider.value),
    note:      moodNote.value.trim(),
    weather: {
      temp:     currentWeather.temp,
      feels:    currentWeather.feels,
      desc:     currentWeather.desc,
      icon:     currentWeather.icon,
      code:     currentWeather.code,
      wind:     currentWeather.wind,
      humidity: currentWeather.humidity,
      uv:       currentWeather.uv,
    },
    timeOfDay: getTimeOfDay(),
  };

  // API #2: localStorage (browser storage API)
  entries.unshift(entry);
  saveEntries(entries);

  // Reset form
  selectedMood = null;
  moodGrid.querySelectorAll('.mood-btn').forEach((b) => {
    b.classList.remove('selected');
    b.setAttribute('aria-pressed', 'false');
  });
  energySlider.value = 5;
  moodNote.value = '';
  logBtn.disabled = true;

  renderLog();
  renderPatterns();
  renderMiniChart();
  showToast('Entry saved ✓');
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 6)  return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

// ── API #2: localStorage (browser storage API) ─────────────
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage unavailable:', e);
  }
}

// ── Render: Recent Entries Log ─────────────────────────────
function renderLog() {
  if (entries.length === 0) {
    logList.innerHTML = `<p class="log-empty">Your journal is empty.<br>Log your first mood above.</p>`;
    return;
  }

  logList.innerHTML = '';
  entries.slice(0, 20).forEach((e) => {
    const el = document.createElement('div');
    el.className = 'log-entry';

    const date = new Date(e.timestamp);
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    el.innerHTML = `
      <span class="log-emoji">${e.emoji}</span>
      <span class="log-mood-name">${capitalize(e.mood)}</span>
      <span class="log-time">${dateStr}<br>${timeStr}</span>
      <div class="log-meta">
        <span>⚡ ${e.energy}/10</span>
        <span class="log-weather-badge">${e.weather.icon} ${e.weather.temp}°F · ${e.weather.desc}</span>
        <span>🕐 ${e.timeOfDay}</span>
      </div>
      ${e.note ? `<p class="log-note">"${escapeHtml(e.note)}"</p>` : ''}
    `;
    logList.appendChild(el);
  });
}

// ── Render: Patterns Sidebar ───────────────────────────────
function renderPatterns() {
  if (entries.length < 3) {
    const remaining = 3 - entries.length;
    const word = entries.length === 2 ? 'entry' : 'entries';
    patternsContainer.innerHTML = `<p class="no-patterns">Log ${remaining} more ${word} to start discovering patterns.</p>`;
    return;
  }

  const insights = buildInsights(entries);
  if (insights.length === 0) {
    patternsContainer.innerHTML = `<p class="no-patterns">Keep logging — patterns will emerge soon.</p>`;
    return;
  }

  patternsContainer.innerHTML = '';
  insights.slice(0, 4).forEach((ins) => {
    const el = document.createElement('div');
    el.className = 'pattern-item';
    el.innerHTML = `
      <span class="pattern-icon">${ins.icon}</span>
      <p class="pattern-text">${ins.text}</p>
    `;
    patternsContainer.appendChild(el);
  });
}

function buildInsights(allEntries) {
  const insights = [];

  // 1. Most frequent mood
  const moodCount = {};
  allEntries.forEach((e) => {
    moodCount[e.mood] = (moodCount[e.mood] || 0) + 1;
  });
  const topMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0];
  if (topMood) {
    const m = MOODS.find((x) => x.id === topMood[0]);
    const times = topMood[1] === 1 ? 'time' : 'times';
    insights.push({
      icon: m.emoji,
      text: `Your most common mood is <strong>${capitalize(topMood[0])}</strong> (${topMood[1]} ${times}).`,
    });
  }

  // 2. Weather & energy correlation
  const rainyEntries = allEntries.filter((e) => e.weather.code >= 51 && e.weather.code <= 82);
  const sunnyEntries = allEntries.filter((e) => e.weather.code <= 3);
  if (rainyEntries.length >= 2 && sunnyEntries.length >= 1) {
    const avgEnergyRainy = avg(rainyEntries.map((e) => e.energy));
    const avgEnergySunny = avg(sunnyEntries.map((e) => e.energy));
    const diff = avgEnergySunny - avgEnergyRainy;
    if (diff > 1) {
      insights.push({
        icon: '☀️',
        text: `You tend to have <strong>${diff.toFixed(1)} pts higher energy</strong> on sunny days vs rainy ones.`,
      });
    } else if (diff < -1) {
      insights.push({
        icon: '🌧️',
        text: `Interestingly, you have <strong>more energy on rainy days</strong> — perhaps you're a cozy homebody.`,
      });
    }
  }

  // 3. Best time of day for energy
  const timeGroups = {};
  allEntries.forEach((e) => {
    if (!timeGroups[e.timeOfDay]) timeGroups[e.timeOfDay] = [];
    timeGroups[e.timeOfDay].push(e.energy);
  });
  let bestTime = null;
  let bestAvg = 0;
  Object.entries(timeGroups).forEach(([t, vals]) => {
    const a = avg(vals);
    if (a > bestAvg && vals.length >= 2) {
      bestAvg = a;
      bestTime = t;
    }
  });
  if (bestTime) {
    insights.push({
      icon: '🕐',
      text: `Your energy peaks in the <strong>${bestTime}</strong> (avg ${bestAvg.toFixed(1)}/10).`,
    });
  }

  // 4. Cold vs warm temperature & energy
  const coldEntries = allEntries.filter((e) => e.weather.temp < 45);
  const warmEntries = allEntries.filter((e) => e.weather.temp >= 65);
  if (coldEntries.length >= 2 && warmEntries.length >= 2) {
    const coldEnergy = avg(coldEntries.map((e) => e.energy));
    const warmEnergy = avg(warmEntries.map((e) => e.energy));
    if (warmEnergy - coldEnergy > 1) {
      insights.push({
        icon: '🌡️',
        text: `You feel <strong>more energized in warmer weather</strong> (${warmEnergy.toFixed(1)} vs ${coldEnergy.toFixed(1)} avg energy).`,
      });
    } else if (coldEnergy - warmEnergy > 1) {
      insights.push({
        icon: '❄️',
        text: `You tend to feel <strong>more energized in cold weather</strong> — a winter person perhaps!`,
      });
    }
  }

  // 5. Consecutive-day streak
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const todayEntry = allEntries.find((e) => new Date(e.timestamp).toDateString() === today);
  const yestEntry  = allEntries.find((e) => new Date(e.timestamp).toDateString() === yesterday);
  if (todayEntry && yestEntry) {
    insights.push({
      icon: '🔥',
      text: `You're on a <strong>2+ day streak</strong>. Keep it up!`,
    });
  }

  return insights;
}

// ── Render: 7-Day Energy Chart ─────────────────────────────
function renderMiniChart() {
  miniChart.innerHTML = '';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toDateString());
  }

  const palette = ['#4a7fa5', '#5a9a5a', '#b85c38', '#9c8670', '#e07a56', '#5a7a5a', '#4a7fa5'];

  days.forEach((day, idx) => {
    const dayEntries = entries.filter((e) => new Date(e.timestamp).toDateString() === day);
    const avgE = dayEntries.length ? avg(dayEntries.map((e) => e.energy)) : 0;
    const pct  = (avgE / 10) * 100;
    const label = new Date(day).toLocaleDateString('en-US', { weekday: 'narrow' });

    const wrap = document.createElement('div');
    wrap.className = 'chart-bar-wrap';
    wrap.innerHTML = `
      <div
        class="chart-bar"
        style="height:${pct}%; background:${palette[idx]}; opacity:${avgE ? 1 : 0.18};"
        title="${label}: ${avgE ? avgE.toFixed(1) : 'no data'}"
      ></div>
      <span class="chart-tick">${label}</span>
    `;
    miniChart.appendChild(wrap);
  });
}

// ── Toast notification ─────────────────────────────────────
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Utility functions ──────────────────────────────────────
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Start the app ──────────────────────────────────────────
init();
