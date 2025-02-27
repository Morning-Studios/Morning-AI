from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import datetime
import random
import json
import uvicorn

app = FastAPI(title="AI Morning Assistant API")

class WeatherData(BaseModel):
    temperature: float
    condition: str
    humidity: int
    wind_speed: float

class NewsItem(BaseModel):
    title: str
    summary: str
    source: str
    url: Optional[str] = None

class CalendarEvent(BaseModel):
    title: str
    start_time: datetime.datetime
    end_time: Optional[datetime.datetime] = None
    location: Optional[str] = None

class MorningBriefing(BaseModel):
    greeting: str
    date: str
    weather: WeatherData
    news: List[NewsItem]
    events: List[CalendarEvent]
    quote_of_the_day: str

# Mock data storage
quotes = [
    "The best way to predict the future is to create it.",
    "Life is what happens when you're busy making other plans.",
    "The only limit to our realization of tomorrow is our doubts of today.",
    "The purpose of our lives is to be happy.",
    "You are never too old to set another goal or to dream a new dream."
]

weather_conditions = ["Sunny", "Cloudy", "Rainy", "Snowy", "Partly Cloudy", "Clear"]

# Helper functions
def get_current_weather():
    # In a real app, you would call a weather API here
    return WeatherData(
        temperature=random.uniform(40.0, 85.0),
        condition=random.choice(weather_conditions),
        humidity=random.randint(30, 90),
        wind_speed=random.uniform(0.0, 15.0)
    )

def get_news():
    # In a real app, you would call a news API here
    return [
        NewsItem(
            title="New Breakthrough in AI Technology",
            summary="Researchers have developed a new AI model that can understand context better than ever before.",
            source="Tech Daily",
            url="https://example.com/tech-news"
        ),
        NewsItem(
            title="Global Climate Initiative Launched",
            summary="World leaders announce new initiative to combat climate change with ambitious goals.",
            source="World News",
            url="https://example.com/world-news"
        ),
        NewsItem(
            title="Health Experts Recommend New Morning Routine",
            summary="A study shows that a specific morning routine can improve productivity by 40%.",
            source="Health Today",
            url="https://example.com/health-news"
        )
    ]

def get_calendar_events():
    # In a real app, you would connect to a calendar API here
    today = datetime.datetime.now()
    return [
        CalendarEvent(
            title="Team Meeting",
            start_time=today.replace(hour=10, minute=0, second=0),
            end_time=today.replace(hour=11, minute=0, second=0),
            location="Conference Room A"
        ),
        CalendarEvent(
            title="Project Deadline",
            start_time=today.replace(hour=17, minute=0, second=0)
        ),
        CalendarEvent(
            title="Lunch with Client",
            start_time=today.replace(hour=12, minute=30, second=0),
            end_time=today.replace(hour=13, minute=30, second=0),
            location="Downtown Cafe"
        )
    ]

def get_personalized_greeting(name=None):
    hour = datetime.datetime.now().hour
    if hour < 12:
        greeting = "Good morning"
    elif hour < 18:
        greeting = "Good afternoon"
    else:
        greeting = "Good evening"
    
    if name:
        greeting += f", {name}"
    
    return greeting + "!"

# API Endpoints
@app.get("/")
def read_root():
    return {"message": "Welcome to AI Morning Assistant API"}

@app.get("/briefing", response_model=MorningBriefing)
def get_morning_briefing(name: Optional[str] = None):
    now = datetime.datetime.now()
    return MorningBriefing(
        greeting=get_personalized_greeting(name),
        date=now.strftime("%A, %B %d, %Y"),
        weather=get_current_weather(),
        news=get_news(),
        events=get_calendar_events(),
        quote_of_the_day=random.choice(quotes)
    )

@app.get("/weather", response_model=WeatherData)
def get_weather():
    return get_current_weather()

@app.get("/news", response_model=List[NewsItem])
def get_daily_news():
    return get_news()

@app.get("/calendar", response_model=List[CalendarEvent])
def get_daily_calendar():
    return get_calendar_events()

@app.get("/quote", response_model=dict)
def get_quote():
    return {"quote": random.choice(quotes)}

@app.post("/customize")
def customize_preferences(preferences: dict):
    # In a real app, you would store these preferences
    return {"message": "Preferences updated successfully", "preferences": preferences}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
