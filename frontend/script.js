"use strict";

// DOM Elements
const weatherForm = document.querySelector("#weather-form");
const cityInput = document.querySelector("#city-input");

const chatForm = document.querySelector("#chat-form");
const questionInput = document.querySelector("#question-input");
const chatArea = document.querySelector("#chat-area");

const toast = document.querySelector("#toast");

let toastTimer;


// Toast notification
function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}


// Add message to chat
function addMessage(text, who = "ai") {

    const wrap = document.createElement("div");

    wrap.className =
        who === "user" ? "user-message" : "ai-message";

    if (who === "ai") {

        const mark = document.createElement("span");

        mark.className = "message-mark";
        mark.textContent = "✦";

        wrap.appendChild(mark);
    }

    const paragraph = document.createElement("p");

    paragraph.textContent = String(text);

    wrap.appendChild(paragraph);

    chatArea.appendChild(wrap);

    chatArea.scrollTop = chatArea.scrollHeight;
}


// Weather emoji
function getWeatherEmoji(description = "") {

    const text = description.toLowerCase();

    if (text.includes("thunder")) return "⛈️";

    if (text.includes("snow")) return "❄️";

    if (text.includes("rain")) return "🌧️";

    if (text.includes("drizzle")) return "🌦️";

    if (text.includes("fog") || text.includes("mist")) return "🌫️";

    if (text.includes("cloud")) return "☁️";

    if (text.includes("sunny")) return "☀️";

    if (text.includes("clear")) return "🌙";

    if (text.includes("wind")) return "💨";

    return "🌤️";
}


// Display weather
function setWeather(data) {

    const current = data.current || {};
    const location = data.location || {};

    const cityName = location.name || "Unknown location";
    const country = location.country || "";

    // Location
    document.querySelector("#location").textContent =
        country ? `${cityName}, ${country}` : cityName;

    // Local time
    document.querySelector("#local-time").textContent =
        location.localtime || "Current conditions";

    // Temperature
    document.querySelector("#temperature").innerHTML =
        `${current.temperature ?? "--"}<span>°C</span>`;

    // Weather condition
    const description =
        current.weather_descriptions?.[0] || "Unknown condition";

    document.querySelector("#condition").textContent =
        description;

    // Weather icon
    document.querySelector("#weather-icon").textContent =
        getWeatherEmoji(description);

    // Feels like
    document.querySelector("#feels-like").textContent =
        `Feels like ${current.feelslike ?? "--"}°C`;

    // Humidity
    document.querySelector("#humidity").textContent =
        `${current.humidity ?? "--"}%`;

    // Wind
    document.querySelector("#wind").textContent =
        `${current.wind_speed ?? "--"} km/h`;

    // Pressure
    document.querySelector("#pressure").textContent =
        `${current.pressure ?? "--"} mb`;

    // Visibility
    document.querySelector("#visibility").textContent =
        `${current.visibility ?? "--"} km`;
}


// Fetch weather
async function fetchWeather(city) {

    city = city.trim();

    if (!city) {
        showToast("Please enter a city name.");
        return;
    }

    const searchButton =
        weatherForm.querySelector('button[type="submit"]');

    searchButton.disabled = true;

    showToast(`Fetching weather for ${city}...`);

    try {

        const response = await fetch(
            `/api/weather?city=${encodeURIComponent(city)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error?.info ||
                data.error ||
                "Weather request failed."
            );
        }

        if (data.error) {
            throw new Error(
                data.error.info ||
                "Unable to find weather for this city."
            );
        }

        setWeather(data);

        showToast(`Weather loaded for ${city}`);

    } catch (error) {

        console.error("Weather error:", error);

        showToast(
            error.message ||
            "Unable to fetch weather. Check your backend."
        );

    } finally {

        searchButton.disabled = false;
    }
}


// Weather form
weatherForm.addEventListener("submit", function (event) {

    event.preventDefault();

    fetchWeather(cityInput.value);

});


// Quick city buttons
document.querySelectorAll(".city-chip").forEach(button => {

    button.addEventListener("click", function () {

        const city = this.dataset.city;

        cityInput.value = city;

        fetchWeather(city);

    });

});


// Ask AI
async function askAI(question) {

    question = question.trim();

    if (!question) return;

    addMessage(question, "user");

    questionInput.value = "";

    // Loading message
    const loading = document.createElement("div");

    loading.className = "ai-message";
    loading.id = "ai-loading";

    const mark = document.createElement("span");

    mark.className = "message-mark";
    mark.textContent = "✦";

    const paragraph = document.createElement("p");

    paragraph.textContent = "Thinking...";

    loading.appendChild(mark);
    loading.appendChild(paragraph);

    chatArea.appendChild(loading);

    chatArea.scrollTop = chatArea.scrollHeight;

    const sendButton =
        chatForm.querySelector('button[type="submit"]');

    sendButton.disabled = true;

    try {

        const response = await fetch("/api/ask", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                question: question
            })

        });

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.answer ||
                data.error ||
                "AI request failed."
            );
        }

        loading.remove();

        addMessage(
            data.answer ||
            data.output ||
            "No response received."
        );

    } catch (error) {

        console.error("AI error:", error);

        loading.remove();

        addMessage(
            error.message ||
            "Unable to connect to the AI assistant. Please check whether Flask is running."
        );

    } finally {

        sendButton.disabled = false;
    }
}


// Chat form
chatForm.addEventListener("submit", function (event) {

    event.preventDefault();

    askAI(questionInput.value);

});


// Suggested questions
document.querySelectorAll("[data-question]").forEach(button => {

    button.addEventListener("click", function () {

        askAI(this.dataset.question);

    });

});