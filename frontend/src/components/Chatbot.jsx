"use client";
import React, { useState, useEffect, useRef } from "react";
import { ArrowUp, Plus, SquarePen, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { API_LINK } from "@/utils/constant";
import Swal from "sweetalert2";

const Chatbot = () => {
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const chatEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize session and fetch chats
  useEffect(() => {
    const init = async () => {
      try {
        await fetch(`${API_LINK}/session`, {
          method: "GET",
          credentials: "include",
        });

        const chatsRes = await fetch(`${API_LINK}/chats`, {
          credentials: "include",
        });
        const chatsData = await chatsRes.json();
        setChats(chatsData.chats || []);

        // Auto-select first chat
        if (chatsData.chats?.length > 0) {
          const firstChat = chatsData.chats[0];
          setCurrentChatId(firstChat.chat_id);
          fetchChatHistory(firstChat.chat_id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, []);

  const fetchChatHistory = async (chatId) => {
    try {
      const res = await fetch(`${API_LINK}/history/${chatId}`, {
        credentials: "include",
      });
      const data = await res.json();
      setMessages(
        (data.messages || []).map((m, i) => ({
          id: i,
          from: m.role === "assistant" ? "bot" : "user",
          text: m.content,
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => setChatInput(e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "user", text: chatInput },
    ]);

    setLoading(true);

    const formData = new FormData();
    formData.append("message", chatInput);
    if (currentChatId) formData.append("chat_id", currentChatId);

    try {
      const res = await fetch(`${API_LINK}/message`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      setCurrentChatId(data.chat_id);

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, from: "bot", text: data.reply },
      ]);

      // Refresh chat list
      const chatsRes = await fetch(`${API_LINK}/chats`, {
        credentials: "include",
      });
      const chatsData = await chatsRes.json();
      setChats(chatsData.chats);
    } catch (err) {
      console.error(err);
    } finally {
      setChatInput("");
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    // Clear messages and reset current chat id
    setMessages([]);
    setCurrentChatId(null); // <-- important: let backend create chat ID on first message
  };

  const handleDeleteChat = async (chatId) => {
    if (!confirm("Delete this chat?")) return;
    await fetch(`${API_LINK}/chat/${chatId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const chatsRes = await fetch(`${API_LINK}/chats`, {
      credentials: "include",
    });
    const chatsData = await chatsRes.json();
    setChats(chatsData.chats);
    if (currentChatId === chatId) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  const handleClearAllChats = async () => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete all chat history.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete all!",
    });

    if (result.isConfirmed) {
      try {
        await fetch(`${API_LINK}/chats`, {
          method: "DELETE",
          credentials: "include",
        });

        setChats([]);
        setMessages([]);
        setCurrentChatId(null);

        Swal.fire({
          title: "Deleted!",
          text: "All chats have been cleared successfully.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (error) {
        Swal.fire({
          title: "Error",
          text: "Something went wrong while clearing chats.",
          icon: "error",
        });
      }
    }
  };

  const handleSelectChat = (chatId) => {
    setCurrentChatId(chatId);
    fetchChatHistory(chatId);
  };

  return (
    <div className="chat-page container-fluid">
      <div className="row h-100">
        {/* Sidebar */}
        <div className="col-md-3 sidebar border-end p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5>Chats</h5>
            <div className="d-flex gap-2">
              <button
                className="btn btn-sm btn-light"
                onClick={handleNewChat}
                title="New Chat"
              >
                {/* <Plus size={16} /> New */}
                <SquarePen />
              </button>
              {chats.length > 0 && (
                <button
                  className="btn btn-sm btn-light"
                  onClick={handleClearAllChats}
                  title="Clear History"
                >
                  <Trash2 />
                </button>
              )}
            </div>
          </div>

          <ul className="list-unstyled chat-list">
            {chats.length === 0 ? (
              <p className="empty text-light">No chats yet</p>
            ) : (
              chats.map((c) => (
                <li
                  key={c.chat_id}
                  className={`chat-item ${
                    currentChatId === c.chat_id ? "active" : ""
                  }`}
                  onClick={() => handleSelectChat(c.chat_id)}
                >
                  {c.title || "New Chat"}
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Chat area */}
        <div className="col-md-9 chat-container">
          <div className="chat-area">
            {messages.length === 0 ? (
              <p className="text-muted text-center mt-5">
                Start a new conversation...
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${msg.from === "user" ? "user" : "bot"}`}
                >
                  <div className="bubble">
                    {msg.from === "bot" ? (
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))
            )}
            {/* {loading && <p className="typing">Bot is typing...</p>} */}

            {loading && (
              <div className="typing-indicator text-secondary mt-2 d-flex align-items-center gap-2">
                <div className="dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
                <small className="fw-medium">Afaq Tours is typing...</small>
              </div>
            )}

            <div ref={chatEndRef}></div>
          </div>

          <div className="form-container">
            <form onSubmit={handleSubmit}>
              <div className="inputgroup">
                <input
                  type="text"
                  value={chatInput}
                  placeholder="Type a message..."
                  onChange={handleChange}
                  disabled={loading}
                />
                <button type="submit" disabled={loading}>
                  <ArrowUp size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
