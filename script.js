const WMO = {
  0: ['☀️', 'Vedro'],
  1: ['🌤️', 'Pretežno vedro'],
  2: ['⛅', 'Delimično oblačno'],
  3: ['☁️', 'Oblačno'],
  45: ['🌫️', 'Magla'],
  48: ['🌫️', 'Slana magla'],
  51: ['🌦️', 'Slaba rosulja'],
  53: ['🌦️', 'Rosulja'],
  55: ['🌦️', 'Jaka rosulja'],
  56: ['🌧️', 'Ledena rosulja'],
  57: ['🌧️', 'Jaka ledena rosulja'],
  61: ['🌧️', 'Slaba kiša'],
  63: ['🌧️', 'Kiša'],
  65: ['🌧️', 'Jaka kiša'],
  66: ['🌧️', 'Ledena kiša'],
  67: ['🌧️', 'Jaka ledena kiša'],
  71: ['🌨️', 'Slab sneg'],
  73: ['🌨️', 'Sneg'],
  75: ['❄️', 'Jak sneg'],
  77: ['❄️', 'Snežna zrna'],
  80: ['🌦️', 'Slabi pljuskovi'],
  81: ['🌧️', 'Pljuskovi'],
  82: ['⛈️', 'Jaki pljuskovi'],
  85: ['🌨️', 'Snežni pljuskovi'],
  86: ['❄️', 'Jaki snežni pljuskovi'],
  95: ['⛈️', 'Grmljavina'],
  96: ['⛈️', 'Grmljavina sa gradom'],
  99: ['⛈️', 'Jaka grmljavina sa gradom']
};

const dayShort = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
const BELGRADE = { lat: 44.8125, lon: 20.4612, name: 'Beograd' };

function wmoInfo(code) {
  return WMO[code] || ['🌡️', 'Vreme'];
}

function windLabel(speed, gust) {
  return `${Math.round(speed)}/${Math.round(gust)} km/h`;
}

function buildUrl(lat, lon) {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,uv_index_clear_sky_max' +
    '&timezone=auto&forecast_days=8'
  );
}

function buildAqiUrl(lat, lon) {
  return (
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    '&current=us_aqi,european_aqi&timezone=auto'
  );
}

function aqiCategory(aqi) {
  if (aqi <= 50) return { label: 'Dobar', color: '#5fa777' };
  if (aqi <= 100) return { label: 'Umeren', color: '#d8b84a' };
  if (aqi <= 150) return { label: 'Nezdrav za osetljive grupe', color: '#dd8a45' };
  if (aqi <= 200) return { label: 'Nezdrav', color: '#c0554a' };
  if (aqi <= 300) return { label: 'Vrlo nezdrav', color: '#8a5aa8' };
  return { label: 'Opasan', color: '#7a3b40' };
}

function contrastText(hex) {
  const color = hex.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#141a26' : '#ffffff';
}

function findCurrentIndex(times) {
  const now = new Date();

  for (let i = 0; i < times.length; i += 1) {
    if (new Date(times[i]) >= now) return i;
  }

  return 0;
}

function svgLineChart(labels, series, height) {
  const width = 600;
  const chartHeight = height;
  const padLeft = 16;
  const padRight = 16;
  const padTop = 24;
  const padBottom = 22;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;
  const count = labels.length;

  const x = (index) => padLeft + (count === 1 ? plotWidth / 2 : index * (plotWidth / (count - 1)));

  const groups = {};
  series.forEach((entry) => {
    const groupName = entry.scaleGroup || 'main';
    (groups[groupName] = groups[groupName] || []).push(entry);
  });

  const range = {};
  Object.keys(groups).forEach((groupName) => {
    const zeroBase = groups[groupName].some((entry) => entry.zeroBase);
    const values = groups[groupName].flatMap((entry) => entry.values);
    let min = zeroBase ? 0 : Math.min(...values);
    let max = Math.max(...values);

    if (max <= min) max = min + 1;
    range[groupName] = { min, max };
  });

  const y = (value, groupName) => {
    const groupRange = range[groupName];
    return padTop + plotHeight - ((value - groupRange.min) / (groupRange.max - groupRange.min)) * plotHeight;
  };

  let svg = `<svg viewBox="0 0 ${width} ${chartHeight}" preserveAspectRatio="none" style="width:100%;height:${chartHeight}px;display:block;font-family:'IBM Plex Sans',sans-serif;">`;

  series.forEach((entry) => {
    const groupName = entry.scaleGroup || 'main';
    const points = entry.values.map((value, index) => `${x(index)},${y(value, groupName)}`).join(' ');

    if (entry.area) {
      svg += `<polygon points="${x(0)},${padTop + plotHeight} ${points} ${x(count - 1)},${padTop + plotHeight}" fill="${entry.color}" opacity="0.12"/>`;
    }

    svg += `<polyline points="${points}" fill="none" stroke="${entry.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" ${entry.dash ? `stroke-dasharray="${entry.dash}"` : ''} />`;

    entry.values.forEach((value, index) => {
      svg += `<circle cx="${x(index)}" cy="${y(value, groupName)}" r="2.8" fill="${entry.color}"/>`;

      if (entry.showValues !== false) {
        const label = entry.unit === 'mm' ? value.toFixed(1) : `${Math.round(value)}°`;
        const offsetY = entry.labelBelow ? 16 : -8;
        svg += `<text x="${x(index)}" y="${y(value, groupName) + offsetY}" font-size="10" text-anchor="middle" fill="${entry.color}">${label}</text>`;
      }
    });
  });

  labels.forEach((label, index) => {
    svg += `<text x="${x(index)}" y="${chartHeight - 6}" font-size="10" text-anchor="middle" fill="var(--muted)">${label}</text>`;
  });

  svg += '</svg>';
  return svg;
}

function renderHero(data, locLabel) {
  const hourly = data.hourly;
  const index = findCurrentIndex(hourly.time);
  const [icon, desc] = wmoInfo(hourly.weather_code[index]);

  document.getElementById('loc').textContent = locLabel;
  document.getElementById('heroIcon').textContent = icon;
  document.getElementById('heroTemp').textContent = `${Math.round(hourly.temperature_2m[index])}°`;
  document.getElementById('heroDesc').textContent = desc;
  document.getElementById('heroWind').textContent = windLabel(hourly.wind_speed_10m[index], hourly.wind_gusts_10m[index]);
  document.getElementById('heroFeels').textContent = `${Math.round(hourly.apparent_temperature[index])}°`;
  document.getElementById('heroHum').textContent = `${hourly.relative_humidity_2m[index]}%`;
  document.getElementById('heroPrecip').textContent = `${hourly.precipitation[index]} mm`;
}

function renderAqi(aqiData) {
  const block = document.getElementById('aqiBlock');
  const aqi = aqiData && aqiData.current ? aqiData.current.us_aqi : null;

  if (aqi == null) {
    block.style.display = 'none';
    return;
  }

  const cat = aqiCategory(aqi);
  const text = contrastText(cat.color);

  block.style.background = cat.color;
  block.style.color = text;
  document.getElementById('aqiNum').textContent = aqi;
  document.getElementById('aqiCat').textContent = cat.label;
  block.style.display = 'block';
}

function renderHourly(data) {
  const hourly = data.hourly;
  const start = findCurrentIndex(hourly.time);
  const indexes = [];

  for (let i = start; i < start + 12 && i < hourly.time.length; i += 1) {
    indexes.push(i);
  }

  const labels = indexes.map((index, position) => position === 0 ? 'Sada' : `${String(new Date(hourly.time[index]).getHours()).padStart(2, '0')}h`);
  const temperatures = indexes.map((index) => hourly.temperature_2m[index]);
  const precipitations = indexes.map((index) => hourly.precipitation[index]);
  const winds = indexes.map((index) => hourly.wind_speed_10m[index]);

  document.getElementById('hourlyChart').innerHTML = svgLineChart(labels, [
    { values: temperatures, color: 'var(--amber)' },
    { values: precipitations, color: 'var(--rain)', scaleGroup: 'precip', zeroBase: true, unit: 'mm', showValues: false, dash: '4,3' },
    { values: winds, color: 'var(--wind)', scaleGroup: 'wind', zeroBase: true, unit: 'km/h', showValues: false, dash: '1,3' }
  ], 150);

  const details = document.getElementById('hourlyDetails');
  details.innerHTML = '';

  indexes.forEach((index, position) => {
    const date = new Date(hourly.time[index]);
    const hourLabel = `${String(date.getHours()).padStart(2, '0')}:00`;
    const [icon, desc] = wmoInfo(hourly.weather_code[index]);
    const temp = Math.round(hourly.temperature_2m[index]);
    const feels = Math.round(hourly.apparent_temperature[index]);

    details.insertAdjacentHTML('beforeend', `
      <div class="detail-card">
        <div class="dtop">
          <div class="dname">${position === 0 ? 'Sada' : hourLabel}</div>
          <div class="dic">${icon}</div>
          <div class="ddesc">${desc}</div>
          <div class="drange">${temp}°</div>
        </div>
        <div class="dstats">
          <div class="dstat">🌡️ oseća se <b>${feels}°</b></div>
          <div class="dstat">💧 padavine <b>${hourly.precipitation[index]} mm</b></div>
          <div class="dstat">💦 vlažnost <b>${hourly.relative_humidity_2m[index]}%</b></div>
          <div class="dstat">💨 vetar (brz./udar) <b>${windLabel(hourly.wind_speed_10m[index], hourly.wind_gusts_10m[index])}</b></div>
        </div>
      </div>
    `);
  });
}

function renderDaily(data) {
  const daily = data.daily;
  const count = Math.min(7, daily.time.length);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const labels = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(daily.time[i]);
    labels.push(date.getTime() === today.getTime() ? 'Danas' : dayShort[date.getDay()]);
  }

  const maxTemperatures = daily.temperature_2m_max.slice(0, count);
  const minTemperatures = daily.temperature_2m_min.slice(0, count);
  const precipitationTotals = daily.precipitation_sum.slice(0, count);
  const maxWind = daily.wind_speed_10m_max.slice(0, count);

  document.getElementById('dailyChart').innerHTML = svgLineChart(labels, [
    { values: maxTemperatures, color: 'var(--amber)' },
    { values: minTemperatures, color: 'var(--teal)', labelBelow: true },
    { values: precipitationTotals, color: 'var(--rain)', scaleGroup: 'precip', zeroBase: true, unit: 'mm', showValues: false, dash: '4,3' },
    { values: maxWind, color: 'var(--wind)', scaleGroup: 'wind', zeroBase: true, unit: 'km/h', showValues: false, dash: '1,3' }
  ], 150);

  const details = document.getElementById('dailyDetails');
  details.innerHTML = '';

  for (let i = 0; i < count; i += 1) {
    const date = new Date(daily.time[i]);
    const isToday = date.getTime() === today.getTime();
    const [icon, desc] = wmoInfo(daily.weather_code[i]);
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);
    const uv = Math.round(daily.uv_index_max[i] * 10) / 10;
    const uvClear = Math.round(daily.uv_index_clear_sky_max[i] * 10) / 10;

    details.insertAdjacentHTML('beforeend', `
      <div class="detail-card">
        <div class="dtop">
          <div class="dname">${isToday ? 'Danas' : dayShort[date.getDay()]}<span class="ddate">${date.getDate()}.${date.getMonth() + 1}.</span></div>
          <div class="dic">${icon}</div>
          <div class="ddesc">${desc}</div>
          <div class="drange">${max}° <span class="lo">${min}°</span></div>
        </div>
        <div class="dstats">
          <div class="dstat">💧 padavine <b>${daily.precipitation_sum[i]} mm</b></div>
          <div class="dstat">💨 vetar (brz./udar) <b>${windLabel(daily.wind_speed_10m_max[i], daily.wind_gusts_10m_max[i])}</b></div>
          <div class="dstat">☀️ UV maks (obl./vedro) <b>${uv} / ${uvClear}</b></div>
        </div>
      </div>
    `);
  }
}

function toggleDetails(buttonId, detailsId) {
  const details = document.getElementById(detailsId);
  const button = document.getElementById(buttonId);
  const isOpen = details.classList.toggle('open');
  button.textContent = isOpen ? 'Sakrij detaljniji prikaz' : 'Prikaži detaljniji prikaz';
}

document.getElementById('hourlyBtn').addEventListener('click', () => {
  toggleDetails('hourlyBtn', 'hourlyDetails');
});

document.getElementById('dailyBtn').addEventListener('click', () => {
  toggleDetails('dailyBtn', 'dailyDetails');
});

async function loadWeather(lat, lon, locLabel) {
  const status = document.getElementById('status');

  try {
    const response = await fetch(buildUrl(lat, lon));
    if (!response.ok) throw new Error('Mrežna greška');

    const data = await response.json();
    renderHero(data, locLabel);
    renderHourly(data);
    renderDaily(data);

    status.innerHTML = `Podaci: Open-Meteo · ažurirano ${new Date().toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    status.innerHTML = '<span class="err">Nije moguće učitati podatke o vremenu.</span><br><button onclick="init()">Pokušaj ponovo</button>';
    return;
  }

  try {
    const aqiResponse = await fetch(buildAqiUrl(lat, lon));
    if (aqiResponse.ok) renderAqi(await aqiResponse.json());
  } catch (error) {
    // AQI je opcioni podatak - tiho preskačemo ako ne uspe
  }
}

function normalizeText(value) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function fetchHtml(url) {
  const attempts = [url, `https://r.jina.ai/http://https://www.pudecjidani.rs/`, `https://r.jina.ai/http://www.pudecjidani.rs/`];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt, { cache: 'no-store' });
      if (!response.ok) continue;
      return await response.text();
    } catch (error) {
      // try next fallback
    }
  }

  return null;
}

function findAbsoluteUrl(value, baseUrl) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).href;
  } catch (error) {
    return null;
  }
}

async function loadMenuImage() {
  const wrap = document.getElementById('menuPhotoWrap');
  if (!wrap) return;

  const baseUrl = 'https://www.pudecjidani.rs/';

  try {
    const homeHtml = await fetchHtml(baseUrl);
    if (!homeHtml) {
      throw new Error('Nije bilo moguće dohvatiti početnu stranicu sajtova.');
    }

    const homeDoc = new DOMParser().parseFromString(homeHtml, 'text/html');
    const menuCandidate = [...homeDoc.body.querySelectorAll('*')].find((element) => {
      const text = normalizeText(element.textContent || '');
      const aria = normalizeText(element.getAttribute('aria-label') || '');
      const title = normalizeText(element.getAttribute('title') || '');
      const onclick = normalizeText(element.getAttribute('onclick') || '');
      return text.includes('jelovnik') || text.includes('јеловник') || aria.includes('jelovnik') || aria.includes('јеловник') || title.includes('jelovnik') || title.includes('јеловник') || onclick.includes('jelovnik') || onclick.includes('јеловник');
    });

    if (!menuCandidate) {
      throw new Error('Nije pronađen element sa nazivom “Јеловник”.');
    }

    const href = menuCandidate.getAttribute('href') || menuCandidate.dataset?.href || menuCandidate.getAttribute('data-url') || menuCandidate.getAttribute('onclick') || '';
    const menuUrl = findAbsoluteUrl(href, baseUrl) || baseUrl;
    const menuHtml = await fetchHtml(menuUrl);
    if (!menuHtml) {
      throw new Error('Nije bilo moguće otvoriti stranicu sa jelovnikom.');
    }

    const menuDoc = new DOMParser().parseFromString(menuHtml, 'text/html');
    const candidates = [...menuDoc.querySelectorAll('img[src], source[srcset], a[href]')]
      .map((node) => {
        const src = node.getAttribute('src') || node.getAttribute('srcset') || node.getAttribute('href') || '';
        return src.split(/[\s,]+/)[0];
      })
      .map((src) => findAbsoluteUrl(src, menuUrl))
      .filter(Boolean)
      .filter((url) => {
        const fileName = decodeURIComponent(url.split('/').pop() || '');
        return /vrti[cć]|врти[ćc]/i.test(fileName) || /vrti[cć]|врти[ćc]/i.test(url);
      });

    const imageUrl = [...new Set(candidates)][0];
    if (!imageUrl) {
      throw new Error('Nije pronađena slika čije ime sadrži “вртић”.');
    }

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Vrtic';
    img.loading = 'lazy';
    img.className = 'menu-photo';
    wrap.innerHTML = '';
    wrap.appendChild(img);
  } catch (error) {
    wrap.innerHTML = `
      <div class="menu-photo-placeholder">
        <strong>Slika jelovnika nije pronađena.</strong><br>
        <span>${error.message || 'Nepoznata greška pri učitavanju.'}</span>
      </div>
    `;
  }
}

function init() {
  const status = document.getElementById('status');
  status.textContent = 'Učitavanje…';

  if (navigator.geolocation) {
    const timeout = setTimeout(() => {
      loadWeather(BELGRADE.lat, BELGRADE.lon, `${BELGRADE.name} (podrazumevano)`);
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        loadWeather(position.coords.latitude, position.coords.longitude, 'Vaša lokacija');
      },
      () => {
        clearTimeout(timeout);
        loadWeather(BELGRADE.lat, BELGRADE.lon, `${BELGRADE.name} (podrazumevano)`);
      },
      { timeout: 4000 }
    );
  } else {
    loadWeather(BELGRADE.lat, BELGRADE.lon, `${BELGRADE.name} (podrazumevano)`);
  }

  loadMenuImage();
}

init();
