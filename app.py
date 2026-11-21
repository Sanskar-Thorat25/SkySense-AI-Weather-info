
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import os
import requests

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langsmith import Client
from langchain_classic.agents import create_react_agent, AgentExecutor


# =========================
# Load Environment Variables
# =========================

load_dotenv()

app = Flask(__name__, static_folder="frontend")

weather_api_key = os.getenv("WEATHERSTACK_API_KEY")
google_api_key = os.getenv("GOOGLE_API_KEY")


# =========================
# Search Tool
# =========================

wrap = DuckDuckGoSearchAPIWrapper(
    region="in-en",
    max_results=5
)

search = DuckDuckGoSearchRun(
    api_wrapper=wrap
)


# =========================
# Weather Tool
# =========================

@tool
def weather_data(city: str) -> dict:
    """Fetch current weather data for a given city using Weatherstack."""

    if not weather_api_key:
        return {
            "error": "Weatherstack API key is missing. Please configure WEATHERSTACK_API_KEY in your .env file."
        }

    url = "http://api.weatherstack.com/current"

    params = {
        "access_key": weather_api_key,
        "query": city,
        "units": "m"
    }

    try:
        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        if "error" in data:
            return {
                "error": data["error"].get(
                    "info",
                    "Unable to fetch weather data."
                )
            }

        return data

    except requests.exceptions.Timeout:
        return {
            "error": "Weather API request timed out. Please try again."
        }

    except requests.exceptions.RequestException as e:
        return {
            "error": f"Weather API connection failed: {str(e)}"
        }

    except ValueError:
        return {
            "error": "Invalid response received from Weather API."
        }


# =========================
# Gemini LLM
# =========================

if not google_api_key:
    raise ValueError(
        "GOOGLE_API_KEY is missing. Please add it to your .env file."
    )

llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    google_api_key=google_api_key,
    temperature=0.3
)


# =========================
# Agent Setup
# =========================

tools = [search, weather_data]

clt = Client()

prompt = clt.pull_prompt(
    "hwchase17/react",
    dangerously_pull_public_prompt=True
)

agent = create_react_agent(
    llm=llm,
    tools=tools,
    prompt=prompt
)

ext = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    handle_parsing_errors=True,
    max_iterations=5
)


# =========================
# Frontend Route
# =========================

@app.route("/")
def home():
    return app.send_static_file("index.html")


# =========================
# Weather API Route
# =========================

@app.route("/api/weather", methods=["GET"])
def get_weather():

    city = request.args.get("city", "").strip()

    if not city:
        return jsonify({
            "error": "Please enter a city name."
        }), 400

    try:
        result = weather_data.invoke({
            "city": city
        })

        if isinstance(result, dict) and "error" in result:
            return jsonify(result), 400

        return jsonify(result), 200

    except Exception as e:
        print("Weather Error:", str(e))

        return jsonify({
            "error": "Something went wrong while fetching weather."
        }), 500


# =========================
# AI Chat API Route
# =========================

@app.route("/api/ask", methods=["POST"])
def ask_ai():

    data = request.get_json(silent=True) or {}

    question = data.get("question", "").strip()

    if not question:
        return jsonify({
            "error": "Please enter a question."
        }), 400

    try:
        response = ext.invoke({
            "input": question
        })

        return jsonify({
            "answer": response.get("output", "No response received.")
        }), 200

    except Exception as e:
        print("AI Error:", str(e))

        return jsonify({
            "answer": "Sorry, something went wrong. Please try again."
        }), 500


# =========================
# Run Flask Server
# =========================

if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )