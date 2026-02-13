// ============================================
//  Daily Tracker — Frontend Logic
//  Sajeel (Auckland NZ) & Mahrukh (Lahore PK)
// ============================================

let currentPerson = localStorage.getItem('tracker_person') || 'sajeel';
let currentDate = new Date();
let trackerData = {};

const NAMES = { sajeel: 'Sajeel', mahrukh: 'Mahrukh' };

const CITIES = {
  sajeel: { city: 'Auckland', country: 'New Zealand', method: 3, flag: '\uD83C\uDDF3\uD83C\uDDFF', tz: 'Pacific/Auckland' },
  mahrukh: { city: 'Lahore', country: 'Pakistan', method: 1, flag: '\uD83C\uDDF5\uD83C\uDDF0', tz: 'Asia/Karachi' },
};

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setActivePerson(currentPerson);
  updateDateDisplay();
  loadAll();
  setupEventListeners();
});

// ===== PERSON SWITCHING =====
function setActivePerson(person) {
  currentPerson = person;
  localStorage.setItem('tracker_person', person);

  document.querySelectorAll('.user-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.person === person);
  });

  setGreeting();
}

function setGreeting() {
  const name = NAMES[currentPerson];
  const city = CITIES[currentPerson].city;
  const hour = new Date().getHours();
  let msg;

  if (hour < 12) msg = `Assalamu Alaikum, ${name} — make today count.`;
  else if (hour < 17) msg = `Keep going, ${name} — the afternoon is yours.`;
  else if (hour < 20) msg = `Evening check-in — how did today go, ${name}?`;
  else msg = `Wind down well, ${name} — rest is part of the journey.`;

  document.getElementById('greeting').textContent = msg;
}

// ===== DATE =====
function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

function fmtDisplay(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function updateDateDisplay() {
  document.getElementById('currentDate').textContent = fmtDisplay(currentDate);
}

// ===== LOAD ALL =====
function loadAll() {
  loadData();
  loadStreaks();
  loadWeekly();
  loadPartner();
  loadPrayerTimes();
}

// ===== PRAYER TIMES (Aladhan API) =====
async function loadPrayerTimes() {
  const me = currentPerson;
  const partner = me === 'sajeel' ? 'mahrukh' : 'sajeel';

  const myInfo = CITIES[me];
  const partnerInfo = CITIES[partner];

  // Set city labels
  document.getElementById('myCityLabel').innerHTML =
    `${myInfo.flag} ${myInfo.city} <span class="city-sub">(You)</span>`;
  document.getElementById('partnerCityLabel').innerHTML =
    `${partnerInfo.flag} ${partnerInfo.city} <span class="city-sub">(${NAMES[partner]})</span>`;

  // Fetch prayer times for both cities
  const [myTimes, partnerTimes] = await Promise.all([
    fetchPrayerTimes(myInfo),
    fetchPrayerTimes(partnerInfo),
  ]);

  renderPrayerTimes('myPrayerTimes', myTimes, myInfo.tz);
  renderPrayerTimes('partnerPrayerTimes', partnerTimes, partnerInfo.tz);

  // Fill salah box times with current user's times
  if (myTimes) {
    const salahMap = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
    Object.keys(salahMap).forEach(k => {
      const el = document.getElementById(`salah-time-${k}`);
      if (el && myTimes[salahMap[k]]) {
        el.textContent = to12h(myTimes[salahMap[k]]);
      }
    });
  }

  // Show next prayer for current user
  if (myTimes) {
    showNextPrayer(myTimes, myInfo.tz);
  }
}

async function fetchPrayerTimes(info) {
  try {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const url = `https://api.aladhan.com/v1/timingsByCity/${dd}-${mm}-${yyyy}?city=${encodeURIComponent(info.city)}&country=${encodeURIComponent(info.country)}&method=${info.method}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 200 && data.data && data.data.timings) {
      return data.data.timings;
    }
    return null;
  } catch (err) {
    console.error('Prayer times fetch failed:', err);
    return null;
  }
}

function renderPrayerTimes(containerId, timings, tz) {
  const container = document.getElementById(containerId);
  if (!timings) {
    container.innerHTML = '<div class="prayer-loading">Could not load</div>';
    return;
  }

  // Get current time in the target timezone
  const nowStr = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const nowMins = timeToMinutes(nowStr);

  let html = '';
  PRAYER_NAMES.forEach(name => {
    const time24 = timings[name]; // e.g. "05:23"
    const timeMins = timeToMinutes(time24);

    // Convert to 12h format
    const time12 = to12h(time24);

    // Determine if this prayer is next, done, or upcoming
    let cls = '';
    if (nowMins >= timeMins) {
      cls = 'prayer-done';
    }

    html += `<div class="prayer-time-item ${cls}">
      <span class="prayer-t-name">${name}</span>
      <span class="prayer-t-time">${time12}</span>
    </div>`;
  });

  // Also show Sunrise & Sunset as info
  if (timings.Sunrise && timings.Sunset) {
    html += `<div class="prayer-time-item prayer-info">
      <span class="prayer-t-name">Sunrise</span>
      <span class="prayer-t-time">${to12h(timings.Sunrise)}</span>
    </div>`;
  }

  container.innerHTML = html;
}

function showNextPrayer(timings, tz) {
  const badge = document.getElementById('nextPrayerBadge');
  const nowStr = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const nowMins = timeToMinutes(nowStr);

  let nextPrayer = null;
  let nextMins = Infinity;

  for (const name of PRAYER_NAMES) {
    const pMins = timeToMinutes(timings[name]);
    if (pMins > nowMins && pMins < nextMins) {
      nextMins = pMins;
      nextPrayer = name;
    }
  }

  if (nextPrayer) {
    const diff = nextMins - nowMins;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
    badge.innerHTML = `Next: <strong>${nextPrayer}</strong> in ${timeStr}`;
    badge.className = 'prayer-next active';
  } else {
    badge.textContent = 'All prayers done for today';
    badge.className = 'prayer-next done';
  }
}

function timeToMinutes(t) {
  if (!t) return 0;
  const parts = t.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function to12h(t) {
  if (!t) return '';
  const [hh, mm] = t.split(':');
  let h = parseInt(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}

// ===== LOAD TRACKER DATA =====
async function loadData() {
  try {
    const res = await fetch(`/api/tracker/${currentPerson}/${fmtDate(currentDate)}/`);
    trackerData = await res.json();
    populateUI();
  } catch (err) {
    console.error('Load failed:', err);
  }
}

function populateUI() {
  const d = trackerData;

  // Salah
  if (d.salah) {
    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'tahajjud'].forEach(k => {
      const el = document.getElementById(`salah-${k}`);
      if (el) el.checked = d.salah[k] || false;
    });
  }
  updateSalahProgress();

  // Quran
  if (d.quran) {
    const r = document.getElementById('quran-read');
    if (r) r.checked = d.quran.read || false;
    const p = document.getElementById('quran-pages');
    if (p) p.value = d.quran.pages || 0;
    const s = document.getElementById('quran-surah');
    if (s) s.value = d.quran.surah || '';
  }

  // Habits
  if (d.habits) {
    ['exercise', 'no_junk_food', 'wake_early', 'dua_after_salah', 'dhikr', 'sadaqah'].forEach(k => {
      const el = document.getElementById(`habit-${k}`);
      if (el) el.checked = d.habits[k] || false;
    });
    updateWaterUI(d.habits.water || 0);
    const sl = document.getElementById('sleep-hours');
    if (sl) {
      sl.value = d.habits.sleep_hours || 0;
      document.getElementById('sleepDisplay').textContent = (d.habits.sleep_hours || 0) + 'h';
    }
  }

  // Goals
  renderGoals(d.goals || []);

  // Mood
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.mood) === d.mood);
  });

  // Notes
  document.getElementById('dailyNotes').value = d.notes || '';
}

// ===== SALAH PROGRESS =====
function updateSalahProgress() {
  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  let count = 0;
  prayers.forEach(p => {
    const el = document.getElementById(`salah-${p}`);
    if (el && el.checked) count++;
  });
  document.getElementById('salahProgress').style.width = (count / 5 * 100) + '%';
  document.getElementById('salahProgressText').textContent = `${count}/5`;
}

// ===== WATER =====
function updateWaterUI(val) {
  document.querySelectorAll('.water-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.val) <= val);
  });
}

function getWaterCount() {
  return document.querySelectorAll('.water-btn.active').length;
}

// ===== GOALS =====
function renderGoals(goals) {
  const list = document.getElementById('goalsList');
  list.innerHTML = '';
  goals.forEach((g, i) => {
    const li = document.createElement('li');
    li.className = 'goal-item' + (g.done ? ' done' : '');
    li.innerHTML = `
      <input type="checkbox" ${g.done ? 'checked' : ''} data-idx="${i}" />
      <span class="goal-text">${esc(g.text)}</span>
      <button class="goal-delete" data-idx="${i}" type="button">&times;</button>
    `;
    list.appendChild(li);
  });
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function getGoals() {
  const goals = [];
  document.querySelectorAll('.goal-item').forEach(item => {
    goals.push({
      text: item.querySelector('.goal-text').textContent,
      done: item.querySelector('input[type="checkbox"]').checked,
    });
  });
  return goals;
}

// ===== TODAY'S STATS =====
async function loadStreaks() {
  try {
    const res = await fetch(`/api/streaks/${currentPerson}/`);
    const d = await res.json();
    document.getElementById('salahStreak').innerHTML = `${d.salahStreak}<span class="streak-of">/5</span>`;
    document.getElementById('quranStreak').textContent = d.quranStreak ? 'Yes' : 'No';
    document.getElementById('exerciseStreak').innerHTML = `${d.exerciseStreak}<span class="streak-of">/6</span>`;
    document.getElementById('totalDays').textContent = d.totalDaysTracked;
  } catch (err) {
    console.error('Stats failed:', err);
  }
}

// ===== WEEKLY =====
async function loadWeekly() {
  try {
    const res = await fetch(`/api/weekly/${currentPerson}/`);
    const data = await res.json();
    const grid = document.getElementById('weeklyGrid');
    grid.innerHTML = '';
    const todayStr = fmtDate(new Date());
    const moods = ['', '&#128542;', '&#128533;', '&#128528;', '&#128522;', '&#129321;'];

    data.forEach(day => {
      const div = document.createElement('div');
      div.className = 'weekly-day' + (day.date === todayStr ? ' today' : '');
      const color = day.salahCount >= 5 ? 'var(--green)' :
        day.salahCount >= 3 ? 'var(--gold)' :
        day.salahCount > 0 ? 'var(--red)' : 'var(--txt3)';

      div.innerHTML = `
        <span class="weekly-day-name">${day.day}</span>
        <span class="weekly-date">${day.date.split('-')[2]}</span>
        <span class="weekly-salah" style="color:${color}">${day.salahCount}/5</span>
        <span class="weekly-salah-label">Salah</span>
        <div class="weekly-icons">
          <span>${day.quran ? '&#128214;' : '&#9898;'}</span>
          <span>${day.habitCount >= 3 ? '&#9989;' : '&#9898;'}</span>
        </div>
        <span class="weekly-mood">${day.mood > 0 ? moods[day.mood] : '&#9898;'}</span>
      `;
      grid.appendChild(div);
    });
  } catch (err) {
    console.error('Weekly failed:', err);
  }
}

// ===== PARTNER PEEK =====
async function loadPartner() {
  try {
    const res = await fetch(`/api/partner/${currentPerson}/`);
    const d = await res.json();
    const badge = document.getElementById('partnerBadge');
    const stats = document.getElementById('partnerStats');
    const label = document.getElementById('partnerLabel');

    const partnerInfo = CITIES[d.partner];
    label.textContent = `${d.partner_display}'s Today (${partnerInfo.flag} ${partnerInfo.city})`;

    if (d.has_data) {
      badge.textContent = 'Active today';
      badge.className = 'partner-badge active';
      const moods = ['', '&#128542;', '&#128533;', '&#128528;', '&#128522;', '&#129321;'];
      stats.innerHTML = `
        <div class="partner-stat">&#9770; Salah <span class="partner-stat-val">${d.salahCount}/5</span></div>
        <div class="partner-stat">&#128214; Quran <span class="partner-stat-val">${d.quran ? 'Yes' : 'No'}</span></div>
        <div class="partner-stat">&#127947; Exercise <span class="partner-stat-val">${d.exercise ? 'Yes' : 'No'}</span></div>
        <div class="partner-stat">&#128167; Water <span class="partner-stat-val">${d.water}</span></div>
        <div class="partner-stat">Mood <span class="partner-stat-val">${d.mood > 0 ? moods[d.mood] : '-'}</span></div>
      `;
    } else {
      badge.textContent = 'No data yet';
      badge.className = 'partner-badge';
      stats.innerHTML = '<div class="partner-stat" style="color:var(--txt3)">Nothing tracked yet today</div>';
    }
  } catch (err) {
    console.error('Partner failed:', err);
  }
}

// ===== COLLECT DATA =====
function collectData() {
  return {
    person: currentPerson,
    date: fmtDate(currentDate),
    salah: {
      fajr: document.getElementById('salah-fajr').checked,
      dhuhr: document.getElementById('salah-dhuhr').checked,
      asr: document.getElementById('salah-asr').checked,
      maghrib: document.getElementById('salah-maghrib').checked,
      isha: document.getElementById('salah-isha').checked,
      tahajjud: document.getElementById('salah-tahajjud').checked,
    },
    quran: {
      read: document.getElementById('quran-read').checked,
      pages: parseInt(document.getElementById('quran-pages').value) || 0,
      surah: document.getElementById('quran-surah').value.trim(),
    },
    habits: {
      exercise: document.getElementById('habit-exercise').checked,
      no_junk_food: document.getElementById('habit-no_junk_food').checked,
      wake_early: document.getElementById('habit-wake_early').checked,
      dua_after_salah: document.getElementById('habit-dua_after_salah').checked,
      dhikr: document.getElementById('habit-dhikr').checked,
      sadaqah: document.getElementById('habit-sadaqah').checked,
      water: getWaterCount(),
      sleep_hours: parseFloat(document.getElementById('sleep-hours').value) || 0,
    },
    goals: getGoals(),
    mood: getSelectedMood(),
    notes: document.getElementById('dailyNotes').value.trim(),
  };
}

function getSelectedMood() {
  const a = document.querySelector('.mood-btn.active');
  return a ? parseInt(a.dataset.mood) : 3;
}

// ===== SAVE =====
async function saveData() {
  try {
    const data = collectData();
    const res = await fetch(`/api/tracker/${currentPerson}/${fmtDate(currentDate)}/save/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      showToast('Saved!');
      // Small delay to let database fully commit before re-reading
      await new Promise(r => setTimeout(r, 300));
      await Promise.all([loadStreaks(), loadWeekly(), loadPartner()]);
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('Save response error:', err);
      showToast('Failed to save!', true);
    }
  } catch (err) {
    console.error('Save failed:', err);
    showToast('Failed to save!', true);
  }
}

function showToast(msg, isError = false) {
  const toast = document.getElementById('saveToast');
  toast.textContent = msg;
  toast.className = 'save-toast show' + (isError ? ' error' : '');
  setTimeout(() => { toast.className = 'save-toast'; }, 2200);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // User switching
  document.querySelectorAll('.user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActivePerson(btn.dataset.person);
      loadAll();
    });
  });

  // Date navigation
  document.getElementById('prevDay').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    updateDateDisplay();
    loadData();
  });

  document.getElementById('nextDay').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    updateDateDisplay();
    loadData();
  });

  // Salah progress
  document.querySelectorAll('[id^="salah-"]').forEach(el => {
    el.addEventListener('change', updateSalahProgress);
  });

  // Water
  document.querySelectorAll('.water-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.val);
      const cur = getWaterCount();
      updateWaterUI(val === cur ? val - 1 : val);
    });
  });

  // Sleep
  document.getElementById('sleep-hours').addEventListener('input', e => {
    document.getElementById('sleepDisplay').textContent = e.target.value + 'h';
  });

  // Goals
  document.getElementById('addGoalBtn').addEventListener('click', addGoal);
  document.getElementById('goalInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') addGoal();
  });

  document.getElementById('goalsList').addEventListener('click', e => {
    if (e.target.classList.contains('goal-delete')) {
      const idx = parseInt(e.target.dataset.idx);
      const goals = getGoals();
      goals.splice(idx, 1);
      renderGoals(goals);
    }
  });

  document.getElementById('goalsList').addEventListener('change', e => {
    if (e.target.type === 'checkbox') {
      e.target.closest('.goal-item').classList.toggle('done', e.target.checked);
    }
  });

  // Mood
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Save
  document.getElementById('saveBtn').addEventListener('click', saveData);

  // Ctrl+S / Cmd+S
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveData();
    }
  });
}

function addGoal() {
  const input = document.getElementById('goalInput');
  const text = input.value.trim();
  if (!text) return;
  const goals = getGoals();
  goals.push({ text, done: false });
  renderGoals(goals);
  input.value = '';
  input.focus();
}
