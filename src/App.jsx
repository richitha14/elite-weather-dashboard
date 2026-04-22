import { useEffect, useMemo, useState } from "react";
import heroImage from "../assets/weather-atmosphere.png";

const defaultCity = {
  name: "San Francisco",
  admin1: "California",
  country: "United States",
  latitude: 37.7749,
  longitude: -122.4194,
  timezone: "America/Los_Angeles",
};

const weatherCodes = {
  0: ["Clear", "sun"],
  1: ["Mostly clear", "sun"],
  2: ["Partly cloudy", "cloud"],
  3: ["Overcast", "cloud"],
  45: ["Fog", "fog"],
  48: ["Rime fog", "fog"],
  51: ["Light drizzle", "rain"],
  53: ["Drizzle", "rain"],
  55: ["Dense drizzle", "rain"],
  61: ["Light rain", "rain"],
  63: ["Rain", "rain"],
  65: ["Heavy rain", "rain"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  80: ["Rain showers", "rain"],
  81: ["Heavy showers", "rain"],
  82: ["Violent showers", "rain"],
  95: ["Thunderstorms", "storm"],
  96: ["Thunder and hail", "storm"],
  99: ["Severe storms", "storm"],
};

function describeWeather(code) {
  return weatherCodes[code] || ["Variable conditions", "cloud"];
}

function aqiLabel(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Sensitive";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}

function formatPlace(city) {
  return [city.name, city.admin1 || city.country].filter(Boolean).join(", ");
}

function formatTime(value) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDay(value, index) {
  if (index === 0) return "Today";
  return new Intl.DateTimeFormat([], { weekday: "short" }).format(new Date(`${value}T12:00:00`));
}

function getIcon(type) {
  const icons = {
    sun: "☀",
    cloud: "☁",
    rain: "☂",
    snow: "❄",
    storm: "⚡",
    fog: "≋",
  };
  return icons[type] || icons.cloud;
}

async function searchCity(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: query, count: "1", language: "en", format: "json" });

  const response = await fetch(url);
  if (!response.ok) throw new Error("City search failed.");

  const data = await response.json();
  if (!data.results?.length) throw new Error("No city found. Try another search.");

  return data.results[0];
}

async function getWeather(city) {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone || "auto",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
    ].join(","),
    forecast_days: "7",
  });

  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.search = new URLSearchParams({
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone || "auto",
    current: "us_aqi",
  });

  const [weatherResponse, airResponse] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]);
  if (!weatherResponse.ok) throw new Error("Weather data is unavailable.");

  const weather = await weatherResponse.json();
  const air = airResponse.ok ? await airResponse.json() : null;

  return { weather, air };
}

function StatCard({ label, value, detail }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="loading-grid" aria-label="Loading weather data">
      {Array.from({ length: 8 }).map((_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}

function App() {
  const [query, setQuery] = useState(defaultCity.name);
  const [city, setCity] = useState(defaultCity);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("dark");

  const current = report?.weather?.current;
  const daily = report?.weather?.daily;
  const currentAqi = report?.air?.current?.us_aqi;
  const [condition, iconType] = describeWeather(current?.weather_code);

  const tempRange = useMemo(() => {
    if (!daily) return { min: 0, max: 1 };
    return {
      min: Math.min(...daily.temperature_2m_min),
      max: Math.max(...daily.temperature_2m_max),
    };
  }, [daily]);

  async function loadCity(nextCity) {
    setIsLoading(true);
    setError("");
    try {
      const nextReport = await getWeather(nextCity);
      setCity(nextCity);
      setReport(nextReport);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError("");
    try {
      const foundCity = await searchCity(query.trim());
      await loadCity(foundCity);
    } catch (searchError) {
      setError(searchError.message);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCity(defaultCity);
  }, []);

  return (
    <main className={`app ${theme}`}>
      <section className="hero">
        <img className="hero-image" src={heroImage} alt="" />
        <div className="hero-overlay" />

        <nav className="topbar" aria-label="Main controls">
          <div className="brand">
            <span className="brand-mark">EW</span>
            <span>Elite Weather Dashboard</span>
          </div>

          <form className="search" onSubmit={handleSearch}>
            <input
              aria-label="Search city"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search city"
            />
            <button type="submit">Search</button>
          </form>

          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </nav>

        <div className="hero-content">
          <section className="current-panel">
            {isLoading && !report ? (
              <LoadingState />
            ) : (
              <>
                <p className="eyebrow">Live conditions</p>
                <h1>{formatPlace(city)}</h1>
                <div className="temperature-row">
                  <span className="weather-icon">{getIcon(iconType)}</span>
                  <strong>{Math.round(current?.temperature_2m ?? 0)}°</strong>
                  <div>
                    <p>{condition}</p>
                    <span>Feels like {Math.round(current?.apparent_temperature ?? 0)}°F</span>
                  </div>
                </div>
                {error && <p className="error">{error}</p>}
              </>
            )}
          </section>

          <section className="stats-grid" aria-label="Weather stats">
            <StatCard label="Humidity" value={`${Math.round(current?.relative_humidity_2m ?? 0)}%`} detail="Relative humidity" />
            <StatCard label="Wind" value={`${Math.round(current?.wind_speed_10m ?? 0)} mph`} detail="10 meter wind" />
            <StatCard label="AQI" value={Number.isFinite(currentAqi) ? Math.round(currentAqi) : "--"} detail={aqiLabel(currentAqi)} />
            <StatCard label="Sunrise" value={daily ? formatTime(daily.sunrise[0]) : "--"} detail={`Sunset ${daily ? formatTime(daily.sunset[0]) : "--"}`} />
          </section>
        </div>
      </section>

      <section className="forecast-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Forecast</p>
            <h2>7 day outlook</h2>
          </div>
          <span>Powered by Open-Meteo</span>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : (
          <div className="forecast-grid">
            {daily?.time.map((day, index) => {
              const high = daily.temperature_2m_max[index];
              const low = daily.temperature_2m_min[index];
              const [, dayIcon] = describeWeather(daily.weather_code[index]);
              const width = ((high - tempRange.min) / Math.max(1, tempRange.max - tempRange.min)) * 72 + 18;

              return (
                <article className="forecast-card" key={day}>
                  <span>{formatDay(day, index)}</span>
                  <div className="forecast-icon">{getIcon(dayIcon)}</div>
                  <strong>{Math.round(high)}° / {Math.round(low)}°</strong>
                  <div className="range-bar">
                    <span style={{ width: `${width}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer>
        Weather and air-quality data from Open-Meteo and CAMS.
      </footer>
    </main>
  );
}

export default App;
