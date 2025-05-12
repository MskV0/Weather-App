// API Configuration
// Using Open-Meteo API which doesn't require an API key
const BASE_URL = "https://api.open-meteo.com/v1";

// DOM Elements
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const currentLocationButton = document.getElementById("current-location-button");
const errorMessage = document.getElementById("error-message");
const searchDropdown = document.getElementById("search-dropdown");
const currentWeatherSection = document.getElementById("current-weather");
const forecastContainer = document.getElementById("forecast-container");
const hourlyForecastContainer = document.getElementById("hourly-forecast-container");
const locationName = document.getElementById("location-name");
const currentDate = document.getElementById("current-date");
const currentWeatherIcon = document.getElementById("current-weather-icon");
const currentTemp = document.getElementById("current-temp");
const weatherDescription = document.getElementById("weather-description");
const windSpeed = document.getElementById("wind-speed");
const humidity = document.getElementById("humidity");
const feelsLike = document.getElementById("feels-like");
const forecastElement = document.getElementById("forecast");
const hourlyForecastElement = document.getElementById("hourly-forecast");

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
    // Load recent searches from local storage
    loadRecentSearches();
    
    // Add event listeners
    searchButton.addEventListener("click", handleSearch);
    currentLocationButton.addEventListener("click", getCurrentLocationWeather);
    searchInput.addEventListener("input", showRecentSearches);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.classList.add("hidden");
        }
    });
});

// Handle city search
async function handleSearch() {
    const city = searchInput.value.trim();
    
    if (!city) {
        showError("Please enter a city name");
        return;
    }
    
    try {
        // Clear any previous errors
        hideError();
        
        // Fetch weather data
        const weatherData = await getWeatherByCity(city);
        
        // Save to recent searches
        saveRecentSearch(city);
        
        // Update UI with weather data
        updateWeatherUI(weatherData);
        
        // Get and display 5-day forecast and hourly forecast
        const forecastData = await getForecastByCoords(weatherData.coord.lat, weatherData.coord.lon);
        updateForecastUI(forecastData);
        
        // Get and display hourly forecast
        const hourlyData = await getHourlyForecastByCoords(weatherData.coord.lat, weatherData.coord.lon);
        updateHourlyForecastUI(hourlyData);
    } catch (error) {
        showError("City not found. Please check the spelling and try again.");
        console.error("Error fetching weather:", error);
    }
}

// Get weather by city name
async function getWeatherByCity(city) {
    // First, we need to get the coordinates for the city
    const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    
    if (!geoResponse.ok) {
        throw new Error(`Geocoding API error: ${geoResponse.status}`);
    }
    
    const geoData = await geoResponse.json();
    
    if (!geoData.results || geoData.results.length === 0) {
        throw new Error("City not found");
    }
    
    const location = geoData.results[0];
    
    // Now get the weather using the coordinates
    return await getWeatherByCoords(location.latitude, location.longitude, location.name, location.country_code);
}

// Get weather by coordinates
async function getWeatherByCoords(lat, lon, cityName = "", countryCode = "") {
    const response = await fetch(`${BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
    
    if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Format the data to match our app's expected structure
    return {
        name: cityName,
        sys: {
            country: countryCode
        },
        coord: {
            lat: lat,
            lon: lon
        },
        weather: [{
            id: data.current.weather_code,
            main: getWeatherMain(data.current.weather_code),
            description: getWeatherDescription(data.current.weather_code),
            icon: getWeatherIcon(data.current.weather_code)
        }],
        main: {
            temp: data.current.temperature_2m,
            feels_like: data.current.temperature_2m, // Approximate
            humidity: data.current.relative_humidity_2m
        },
        wind: {
            speed: data.current.wind_speed_10m
        },
        dt: Date.now() / 1000 // Current timestamp in seconds
    };
}

// Get 5-day forecast by coordinates
async function getForecastByCoords(lat, lon) {
    const response = await fetch(`${BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6`);
    
    if (!response.ok) {
        throw new Error(`Forecast API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Format the forecast data to match our app's expected structure
    const formattedForecast = {
        list: []
    };
    
    // Create a forecast for each day
    for (let i = 1; i < data.daily.time.length; i++) {
        const date = new Date(data.daily.time[i]);
        const noonIndex = i * 24 + 12; // Approximating noon time for each day
        
        formattedForecast.list.push({
            dt: date.getTime() / 1000,
            main: {
                temp: data.daily.temperature_2m_max[i],
                humidity: data.hourly.relative_humidity_2m[noonIndex]
            },
            weather: [{
                id: data.daily.weather_code[i],
                main: getWeatherMain(data.daily.weather_code[i]),
                description: getWeatherDescription(data.daily.weather_code[i]),
                icon: getWeatherIcon(data.daily.weather_code[i])
            }],
            wind: {
                speed: data.hourly.wind_speed_10m[noonIndex]
            }
        });
    }
    
    return formattedForecast;
}

// Get hourly forecast by coordinates
async function getHourlyForecastByCoords(lat, lon) {
    const response = await fetch(`${BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto&forecast_hours=24`);
    
    if (!response.ok) {
        throw new Error(`Hourly forecast API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Format the hourly forecast data
    const formattedHourlyForecast = {
        list: []
    };
    
    // Get current hour to show forecast starting from current hour
    const currentHour = new Date().getHours();
    
    // Create hourly forecast for the next 24 hours
    for (let i = 0; i < 24; i++) {
        const hourIndex = i;
        const date = new Date(data.hourly.time[hourIndex]);
        
        formattedHourlyForecast.list.push({
            dt: date.getTime() / 1000,
            main: {
                temp: data.hourly.temperature_2m[hourIndex],
                humidity: data.hourly.relative_humidity_2m[hourIndex]
            },
            weather: [{
                id: data.hourly.weather_code[hourIndex],
                main: getWeatherMain(data.hourly.weather_code[hourIndex]),
                description: getWeatherDescription(data.hourly.weather_code[hourIndex]),
                icon: getWeatherIcon(data.hourly.weather_code[hourIndex])
            }],
            wind: {
                speed: data.hourly.wind_speed_10m[hourIndex]
            }
        });
    }
    
    return formattedHourlyForecast;
}

// Get user's current location
function getCurrentLocationWeather() {
    if (navigator.geolocation) {
        hideError();
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    
                    // Get location name using reverse geocoding
                    const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`);
                    let locationName = "Your Location";
                    let countryCode = "";
                    
                    if (geoResponse.ok) {
                        const geoData = await geoResponse.json();
                        if (geoData.results && geoData.results.length > 0) {
                            locationName = geoData.results[0].name;
                            countryCode = geoData.results[0].country_code;
                        }
                    }
                    
                    // Get current weather
                    const weatherData = await getWeatherByCoords(latitude, longitude, locationName, countryCode);
                    updateWeatherUI(weatherData);
                    
                    // Get and display 5-day forecast
                    const forecastData = await getForecastByCoords(latitude, longitude);
                    updateForecastUI(forecastData);
                    
                    // Get and display hourly forecast
                    const hourlyData = await getHourlyForecastByCoords(latitude, longitude);
                    updateHourlyForecastUI(hourlyData);
                    
                    // Save to recent searches
                    if (weatherData.name) {
                        saveRecentSearch(weatherData.name);
                    }
                } catch (error) {
                    showError("Error fetching weather data for your location.");
                    console.error("Error fetching current location weather:", error);
                }
            },
            (error) => {
                showError("Unable to get your location. Please allow location access or search manually.");
                console.error("Geolocation error:", error);
            }
        );
    } else {
        showError("Geolocation is not supported by your browser.");
    }
}

// Update current weather UI
function updateWeatherUI(data) {
    // Make both sections visible
    currentWeatherSection.classList.remove("hidden");
    forecastContainer.classList.remove("hidden");
    hourlyForecastContainer.classList.remove("hidden");
    
    // Update location and date
    locationName.textContent = `${data.name}, ${data.sys.country}`;
    currentDate.textContent = formatDate(new Date());
    
    // Update weather icon
    const iconCode = data.weather[0].icon;
    currentWeatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    currentWeatherIcon.alt = data.weather[0].description;
    
    // Update temperature and description
    currentTemp.textContent = Math.round(data.main.temp);
    weatherDescription.textContent = data.weather[0].description;
    
    // Update additional info
    windSpeed.textContent = data.wind.speed;
    humidity.textContent = data.main.humidity;
    feelsLike.textContent = Math.round(data.main.feels_like);
}

// Update forecast UI
function updateForecastUI(data) {
    // Clear previous forecast
    forecastElement.innerHTML = "";
    
    // Create forecast cards directly (no need for processing with the new API format)
    data.list.slice(0, 5).forEach(forecast => {
        const card = createForecastCard(forecast);
        forecastElement.appendChild(card);
    });
}

// Update hourly forecast UI
function updateHourlyForecastUI(data) {
    // Clear previous hourly forecast
    hourlyForecastElement.innerHTML = "";
    
    // Only display next 8 hours (or whatever fits well in the UI)
    data.list.slice(0, 8).forEach(hourlyData => {
        const card = createHourlyForecastCard(hourlyData);
        hourlyForecastElement.appendChild(card);
    });
}

// Create forecast card
function createForecastCard(forecast) {
    const card = document.createElement("div");
    card.className = "bg-white bg-opacity-20 rounded-lg p-4 shadow-lg text-center weather-card";
    
    const date = new Date(forecast.dt * 1000);
    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    const dayMonth = date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    
    card.innerHTML = `
        <h4 class="font-bold text-white text-lg">${dayName}</h4>
        <p class="text-white text-opacity-80 text-sm">${dayMonth}</p>
        <img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png" 
             alt="${forecast.weather[0].description}" 
             class="w-16 h-16 mx-auto">
        <p class="text-2xl font-bold text-white">${Math.round(forecast.main.temp)}°C</p>
        <div class="flex justify-between mt-2 text-white text-opacity-90 text-sm">
            <div>
                <i class="fas fa-wind"></i> ${forecast.wind.speed} km/h
            </div>
            <div>
                <i class="fas fa-tint"></i> ${forecast.main.humidity}%
            </div>
        </div>
    `;
    
    return card;
}

// Create hourly forecast card
function createHourlyForecastCard(hourlyData) {
    const card = document.createElement("div");
    card.className = "bg-white bg-opacity-20 rounded-lg p-4 shadow-lg text-center hourly-weather-card";
    
    const date = new Date(hourlyData.dt * 1000);
    const hour = date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    
    card.innerHTML = `
        <h4 class="font-bold text-white text-lg">${hour}</h4>
        <img src="https://openweathermap.org/img/wn/${hourlyData.weather[0].icon}@2x.png" 
             alt="${hourlyData.weather[0].description}" 
             class="w-12 h-12 mx-auto">
        <p class="text-xl font-bold text-white">${Math.round(hourlyData.main.temp)}°C</p>
        <div class="flex justify-between mt-2 text-white text-opacity-90 text-xs">
            <div>
                <i class="fas fa-wind"></i> ${hourlyData.wind.speed} km/h
            </div>
            <div>
                <i class="fas fa-tint"></i> ${hourlyData.main.humidity}%
            </div>
        </div>
    `;
    
    return card;
}

// Recent searches functionality
function saveRecentSearch(city) {
    // Get existing searches
    let recentSearches = JSON.parse(localStorage.getItem("recentSearches")) || [];
    
    // Add current search if not already in the list
    if (!recentSearches.includes(city)) {
        // Add to beginning of array
        recentSearches.unshift(city);
        
        // Limit to 5 recent searches
        recentSearches = recentSearches.slice(0, 5);
        
        // Save to local storage
        localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
    } else {
        // Move to top if already exists
        recentSearches = recentSearches.filter(item => item !== city);
        recentSearches.unshift(city);
        localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
    }
    
    // Update dropdown
    loadRecentSearches();
}

function loadRecentSearches() {
    const recentSearches = JSON.parse(localStorage.getItem("recentSearches")) || [];
    
    // Clear dropdown
    searchDropdown.innerHTML = "";
    
    if (recentSearches.length === 0) {
        return;
    }
    
    // Add searches to dropdown
    recentSearches.forEach(city => {
        const item = document.createElement("div");
        item.className = "px-4 py-2 hover:bg-gray-100 cursor-pointer";
        item.textContent = city;
        
        item.addEventListener("click", () => {
            searchInput.value = city;
            searchDropdown.classList.add("hidden");
            handleSearch();
        });
        
        searchDropdown.appendChild(item);
    });
}

function showRecentSearches() {
    const recentSearches = JSON.parse(localStorage.getItem("recentSearches")) || [];
    
    if (recentSearches.length > 0) {
        searchDropdown.classList.remove("hidden");
    }
}

// Error handling
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

function hideError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
}

// Helper functions
function formatDate(date) {
    const options = { 
        weekday: "long", 
        year: "numeric", 
        month: "long", 
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    };
    return date.toLocaleDateString("en-US", options);
}

function formatHourTime(date) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// Weather code mapping functions
function getWeatherMain(code) {
    if (code <= 3) return "Clear";
    if (code <= 48) return "Clouds";
    if (code <= 67) return "Rain";
    if (code <= 77) return "Snow";
    if (code <= 82) return "Rain";
    if (code <= 86) return "Snow";
    if (code <= 99) return "Thunderstorm";
    return "Unknown";
}

function getWeatherDescription(code) {
    if (code === 0) return "clear sky";
    if (code <= 3) return "partly cloudy";
    if (code <= 48) return "cloudy";
    if (code <= 55) return "drizzle";
    if (code <= 57) return "freezing drizzle";
    if (code <= 65) return "rain";
    if (code <= 67) return "freezing rain";
    if (code <= 77) return "snow";
    if (code <= 82) return "rain showers";
    if (code <= 86) return "snow showers";
    if (code <= 99) return "thunderstorm";
    return "unknown";
}

function getWeatherIcon(code) {
    // Map WMO codes to OpenWeatherMap icon codes for compatibility
    // Add time-of-day suffix based on current time
    const isDay = new Date().getHours() >= 6 && new Date().getHours() < 18;
    const daySuffix = isDay ? "d" : "n";
    
    if (code === 0) return `01${daySuffix}`; // Clear sky
    if (code <= 3) return `02${daySuffix}`; // Partly cloudy
    if (code <= 48) return `03${daySuffix}`; // Cloudy
    if (code <= 55) return `09${daySuffix}`; // Drizzle
    if (code <= 57) return `13${daySuffix}`; // Freezing drizzle
    if (code <= 65) return `10${daySuffix}`; // Rain
    if (code <= 67) return `13${daySuffix}`; // Freezing rain
    if (code <= 77) return `13${daySuffix}`; // Snow
    if (code <= 82) return `09${daySuffix}`; // Rain showers
    if (code <= 86) return `13${daySuffix}`; // Snow showers
    if (code <= 99) return `11${daySuffix}`; // Thunderstorm
    return `50${daySuffix}`; // Mist/unknown
}

let debounceTimer;

document.addEventListener("DOMContentLoaded", () => {
    searchInput.addEventListener("input", debounceSearch);
    
});

function debounceSearch() {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    
    if (!query) {
        searchDropdown.classList.add("hidden");
        return;
    }
    
    debounceTimer = setTimeout(() => {
        fetchCitySuggestions(query);
    }, 300); 
}

async function fetchCitySuggestions(query) {
    try {
        searchDropdown.innerHTML = '<div class="px-4 py-2 text-gray-500">Loading suggestions...</div>';
        searchDropdown.classList.remove("hidden");
        
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            displayCitySuggestions(data.results);
        } else {
            searchDropdown.innerHTML = '<div class="px-4 py-2 text-gray-500">No cities found</div>';
        }
    } catch (error) {
        console.error("Error fetching city suggestions:", error);
        searchDropdown.innerHTML = '<div class="px-4 py-2 text-red-500">Error loading suggestions</div>';
    }
}

function displayCitySuggestions(cities) {
    searchDropdown.innerHTML = '';
        cities.forEach(city => {
        const item = document.createElement("div");
        item.className = "px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center";
        
        const cityName = `${city.name}, ${city.country}`;
        
        item.innerHTML = `
            <i class="fas fa-map-marker-alt text-gray-400 mr-2"></i>
            <div>
                <div class="font-medium">${city.name}</div>
                <div class="text-sm text-gray-500">${city.country}${city.admin1 ? ` - ${city.admin1}` : ''}</div>
            </div>
        `;
        
        item.addEventListener("click", () => {
            searchInput.value = cityName;
            searchDropdown.classList.add("hidden");
            handleSearch();
        });
        
        searchDropdown.appendChild(item);
    });
    
    searchDropdown.classList.remove("hidden");
}

// Modify the howRecentSearches function to handle both recent searches and suggestions
function showRecentSearches() {
    const query = searchInput.value.trim();
    const recentSearches = JSON.parse(localStorage.getItem("recentSearches")) || [];
    
    // If there's a query, fetch suggestions instead of showing recent searches
    if (query.length > 0) {
        return; // debounceSearch will handle this
    }
    
    // If no query but there are recent searches, show them
    if (recentSearches.length > 0) {
        searchDropdown.innerHTML = '';
        
        // Add a header for recent searches
        const header = document.createElement("div");
        header.className = "px-4 py-2 text-xs text-gray-500 bg-gray-100";
        header.textContent = "RECENT SEARCHES";
        searchDropdown.appendChild(header);
        
        // Add recent searches
        recentSearches.forEach(city => {
            const item = document.createElement("div");
            item.className = "px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center";
            
            item.innerHTML = `
                <i class="fas fa-history text-gray-400 mr-2"></i>
                <span>${city}</span>
            `;
            
            item.addEventListener("click", () => {
                searchInput.value = city;
                searchDropdown.classList.add("hidden");
                handleSearch();
            });
            
            searchDropdown.appendChild(item);
        });
        
        searchDropdown.classList.remove("hidden");
    }
}

// Add click away listener to close dropdown if user clicks outside
document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.add("hidden");
    }
});

// Additional enhancements for the search input
searchInput.addEventListener("focus", () => {
    // When input is focused, show recent searches if we have any and no query
    if (searchInput.value.trim() === '') {
        showRecentSearches();
    }
});