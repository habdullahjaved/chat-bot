import os
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, os.getenv("DATABASE_PATH", "database/chatbot.db"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
