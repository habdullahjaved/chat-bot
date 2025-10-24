from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import aiosqlite, asyncio, uuid, requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from config import DB_PATH
from utils.groq_client import generate_response as groq_generate_response

app = Flask(__name__)
# CORS(app, supports_credentials=True)
CORS(app, supports_credentials=True, origins=["http://localhost:3000"])

# -------------------- Async helpers --------------------
def run_async(coro):
    """Run async functions in sync context."""
    return asyncio.run(coro)

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                chat_id TEXT,
                role TEXT,
                content TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS chats (
                chat_id TEXT PRIMARY KEY,
                session_id TEXT,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()

# create DB on startup (safe to call multiple times)
run_async(init_db())

async def save_message(session_id: str, chat_id: str, role: str, content: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO messages (session_id, chat_id, role, content) VALUES (?, ?, ?, ?)",
            (session_id, chat_id, role, content),
        )
        await db.commit()

# get history for a specific chat
async def get_history(session_id: str, chat_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT role, content FROM messages WHERE session_id = ? AND chat_id = ? ORDER BY id ASC",
            (session_id, chat_id)
        )
        rows = await cursor.fetchall()
        return [{"role": r[0], "content": r[1]} for r in rows]

# get all history across all chats for a session
async def get_all_history(session_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,)
        )
        rows = await cursor.fetchall()
        return [{"role": r[0], "content": r[1]} for r in rows]

async def save_chat_title(session_id, chat_id, title):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO chats (session_id, chat_id, title) VALUES (?, ?, ?)",
            (session_id, chat_id, title),
        )
        await db.commit()

async def get_chats(session_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT chat_id, title, created_at FROM chats WHERE session_id = ? ORDER BY created_at DESC",
            (session_id,)
        )
        rows = await cursor.fetchall()
        return [{"chat_id": r[0], "title": r[1], "created_at": r[2]} for r in rows]

async def update_chat_title(chat_id, title):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE chats SET title = ? WHERE chat_id = ?", (title, chat_id))
        await db.commit()

# -------------------- Website Scraper --------------------
def get_website_content():
    url = "https://toursafaq.com/"
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Chatbot/1.0)"}
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        for tag in soup(["script", "style", "noscript", "footer", "form", "nav", "header"]):
            tag.decompose()

        content_blocks = []

        title = soup.title.string.strip() if soup.title else "Afaq Tours Dubai"
        content_blocks.append(f"Website Title: {title}")

        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            content_blocks.append(f"Meta Description: {meta_desc['content']}")

        for tag in soup.find_all(["h1", "h2", "h3", "p", "li"]):
            text = tag.get_text(strip=True)
            if len(text.split()) > 3:
                content_blocks.append(text)

        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True)
            href = urljoin(url, a["href"])
            if text and "http" in href:
                content_blocks.append(f"{text}: {href}")

        return "\n".join(content_blocks)
    except Exception as e:
        return f"Website content not available. Error: {str(e)}"

# -------------------- Afaq-specific AI wrapper --------------------
def build_system_prompt(website_context: str) -> str:
    # Tailored system prompt for Afaq Tours; concise and clear
    return f"""
You are Afaq Tours Dubai's official travel assistant.

Company Info:
- Name: Afaq Tours Dubai
- Email: info@toursafaq.com
- Phone: +971505058571
- Address: Latifa Bint Hamdan Street, Al Quoz 4 Dubai, UAE
- Specialty: Dubai tours, holiday packages, day trips, and tailored travel services.

Guidelines:
- Always prefer and cite the website information (provided below) when answering.
- Answer concisely in short paragraphs or bullet points.
- If user greets (e.g. "hi", "hello"), reply with a warm Afaq Tours welcome message and ask how to help.
- If asked about availability/pricing/booking, answer with site info where possible and include contact info or "please contact" message when unsure.
- Do not hallucinate non-existent services; if something isn't on the website, say you couldn't find it and offer to contact the company.
- When suggesting tours or packages, base your answer on the website content below.

Website Context:
{website_context}
""".strip()

def generate_response_with_context(history_messages):
    """
    history_messages: list of dict messages in the form [{"role":"user"/"assistant"/"system", "content": "..."} ...]
    This function will prepend a system prompt (Afaq-specific + scraped website) and call the groq helper.
    """
    website_context = get_website_content()
    system_prompt = build_system_prompt(website_context)

    # create conversation format expected by your groq helper
    conversation = [{"role": "system", "content": system_prompt}] + history_messages

    # call your existing groq wrapper (assumed to accept the conversation list)
    try:
        return groq_generate_response(conversation)
    except Exception as e:
        return f"Couldn't generate response: {str(e)}"

# -------------------- Session --------------------
def get_session_id():
    """Return session_id from cookie; if missing, create and return new."""
    session_id = request.cookies.get("guest_uuid")
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id

# -------------------- Routes --------------------
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "Afaq Tours Chatbot API is running."})

@app.route("/api/session", methods=["GET"])
def get_session():
    session_id = get_session_id()
    resp = make_response(jsonify({"session_id": session_id}))
    resp.set_cookie("guest_uuid", session_id, max_age=30*24*60*60, httponly=True)
    return resp

# Return all messages for session across chats (useful for legacy behavior)
@app.route("/api/history", methods=["GET"])
def get_all_chat_history():
    session_id = request.cookies.get("guest_uuid")
    if not session_id:
        session_id = str(uuid.uuid4())
        resp = make_response(jsonify({"session_id": session_id, "messages": []}))
        resp.set_cookie("guest_uuid", session_id, max_age=30*24*60*60, httponly=True)
        return resp

    history = run_async(get_all_history(session_id))
    resp = make_response(jsonify({"session_id": session_id, "messages": history}))
    resp.set_cookie("guest_uuid", session_id, max_age=30*24*60*60, httponly=True)
    return resp

# History for a specific chat id
@app.route("/api/history/<chat_id>", methods=["GET"])
def get_chat_history_by_id(chat_id):
    session_id = request.cookies.get("guest_uuid")
    if not session_id:
        return jsonify({"error": "No session"}), 400

    history = run_async(get_history(session_id, chat_id))
    return jsonify({
        "session_id": session_id,
        "chat_id": chat_id,
        "messages": history
    })

@app.route("/api/chats", methods=["GET"])
def list_chats():
    session_id = request.cookies.get("guest_uuid")
    if not session_id:
        return jsonify({"chats": []})
    chats = run_async(get_chats(session_id))
    return jsonify({"chats": chats})

# new-chat returns a temporary chat_id (not saved) — you create DB entry only when the first message is sent
@app.route("/api/new-chat", methods=["POST"])
def new_chat():
    chat_id = str(uuid.uuid4())
    return jsonify({"chat_id": chat_id})

@app.route("/api/message", methods=["POST"])
def send_message():
    session_id = get_session_id()
    chat_id = request.form.get("chat_id")
    message = request.form.get("message")

    if not message:
        return jsonify({"error": "Message cannot be empty"}), 400

    # Fetch existing chats for session
    chats = run_async(get_chats(session_id))
    chat_exists = any(c["chat_id"] == chat_id for c in chats)

    # Only create chat row when a real (non-empty) message is sent
    if not chat_id or not chat_exists:
        # create new chat and save title using user's first message
        chat_id = str(uuid.uuid4())
        title = (message[:40] + "...") if len(message) > 40 else message
        title = title.strip() or "New Chat"
        run_async(save_chat_title(session_id, chat_id, title))
    else:
        # if the chat exists but still has placeholder title, update it using first meaningful user message
        chat = next((c for c in chats if c["chat_id"] == chat_id), None)
        if chat and (not chat["title"] or chat["title"].strip().lower() == "new chat"):
            title = (message[:40] + "...") if len(message) > 40 else message
            title = title.strip() or "New Chat"
            run_async(update_chat_title(chat_id, title))

    # Save user message
    run_async(save_message(session_id, chat_id, "user", message))

    # Build last N messages for context (assistant/user)
    history = run_async(get_history(session_id, chat_id))
    conversation = [{"role": h["role"], "content": h["content"]} for h in history[-10:]]
    conversation.append({"role": "user", "content": message})

    # Generate Afaq-specific reply
    bot_reply = generate_response_with_context(conversation)
    run_async(save_message(session_id, chat_id, "assistant", bot_reply))

    resp = make_response(jsonify({
        "reply": bot_reply,
        "chat_id": chat_id,
        "session_id": session_id
    }))
    resp.set_cookie("guest_uuid", session_id, max_age=30*24*60*60, httponly=True)
    return resp


# ==========Clear History ========== #
@app.route("/api/chats", methods=["DELETE"])
def clear_all_chats():
    session_id = request.cookies.get("guest_uuid")
    if not session_id:
        return jsonify({"error": "No session found"}), 400

    async def delete_session_data(session_id):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            await db.execute("DELETE FROM chats WHERE session_id = ?", (session_id,))
            await db.commit()

    run_async(delete_session_data(session_id))
    return jsonify({"message": "All chat history cleared for this session."})
# ==========Clear History ========== #
# ==============

@app.route("/api/chat/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    session_id = request.cookies.get("guest_uuid")
    if not session_id:
        return jsonify({"error": "No session"}), 400

    async def _delete_for_session(session_id, chat_id):
        async with aiosqlite.connect(DB_PATH) as db:
            # Delete messages for this chat & session
            await db.execute(
                "DELETE FROM messages WHERE session_id = ? AND chat_id = ?",
                (session_id, chat_id),
            )
            # Delete the chat row for this session
            await db.execute(
                "DELETE FROM chats WHERE session_id = ? AND chat_id = ?",
                (session_id, chat_id),
            )
            await db.commit()

    run_async(_delete_for_session(session_id, chat_id))

    # Return updated chat list
    chats = run_async(get_chats(session_id))
    resp = make_response(jsonify({
        "message": "Chat deleted",
        "chat_id": chat_id,
        "chats": chats
    }))
    resp.set_cookie("guest_uuid", session_id, max_age=30*24*60*60, httponly=True)
    return resp


# ==============
@app.route("/api/website-content", methods=["GET"])
def website_content():
    content = get_website_content()
    return jsonify({"content": content})

# -------------------- WSGI --------------------
application = app

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
