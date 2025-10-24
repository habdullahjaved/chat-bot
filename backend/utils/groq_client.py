from groq import Groq
from config import GROQ_API_KEY

groq_client = Groq(api_key=GROQ_API_KEY)

def generate_response(messages):
    """
    Send messages to Groq and return the response.
    messages: list of dicts [{role: "user", content: "..."}]
    """
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=600,
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        return f"Couldn't generate response. Error: {str(e)}"
