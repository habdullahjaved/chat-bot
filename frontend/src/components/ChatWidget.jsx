"use client";
import {
  ArrowUp,
  History,
  MessageCircle,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import ReactMarkdown from "react-markdown";
import { API_LINK } from "@/utils/constant";
import Loading from "./atoms/Loading";
import ChatHistory from "./ChatHistory";
const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenHistory, setIsOpenHistory] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const chatEndRef = useRef(null);

  //
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  //
  //===== modal open
  const handleOpen = () => {
    setIsOpen(!isOpen);
  };

  const handleOpenHistory = () => {
    setIsOpenHistory(!isOpenHistory);
  };
  //========\\
  //==========Initialization of Chats

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

  //========

  const handleKeyDown = (e) => {
    // If Enter pressed without Shift => submit
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // prevent newline
      handleSubmit(e); // call your submit handler
    }
  };

  //====
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
  //===================
  //==================\\

  //   const handleChange = (e) => setChatInput(e.target.value);

  const handleChange = (e) => {
    const textarea = e.target;
    textarea.style.height = "auto"; // Reset
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`; // Cap at 120px
    setChatInput(textarea.value);
  };

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

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();

    // Show inline styled confirmation
    const result = await Swal.fire({
      title: "Delete this chat?",
      text: "This chat and its messages will be removed permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      background: "#fefefe",
      customClass: {
        popup: "rounded-xl shadow-lg",
        confirmButton: "px-4 py-2 rounded-md",
        cancelButton: "px-4 py-2 rounded-md",
      },
    });

    if (!result.isConfirmed) return;

    try {
      // Delete API call
      await fetch(`${API_LINK}/chat/${chatId}`, {
        method: "DELETE",
        credentials: "include",
      });

      // Refresh chat list
      const chatsRes = await fetch(`${API_LINK}/chats`, {
        credentials: "include",
      });
      const chatsData = await chatsRes.json();
      setChats(chatsData.chats);

      // If deleted active chat, clear UI
      if (currentChatId === chatId) {
        setMessages([]);
        setCurrentChatId(null);
      }

      // Toast for success
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Chat deleted",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    } catch (error) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "Failed to delete chat",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
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
    setIsOpenHistory(!isOpenHistory);
  };
  return (
    <div className="chat-popup-container">
      {!isOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          className="chat-button"
          title="Ask Afaq AI"
        >
          {/* <MessageCircle />
           */}
          <img src="/chat.svg" alt="Ask Afaq Tours" className="chat-1" />
          <img src="/chat-2.svg" alt="Ask Afaq Tours" className="chat-2" />
        </button>
      ) : (
        <div className="chat-popup">
          <div className="chat-header">
            <div className="history-and-newchat">
              <button onClick={handleOpenHistory} title="Open History">
                <History />
              </button>
              <button onClick={handleNewChat}>
                <SquarePen />
              </button>
            </div>

            <h2>Ask Afaq Tours</h2>

            <div className="d-flex close-btn" onClick={handleOpen}>
              <button>
                <X />
              </button>
            </div>
          </div>
          <div className="chat-body">
            {" "}
            <div className="chat-area">
              {messages.length === 0 ? (
                <p className="text-muted text-center mt-5">
                  AI-generated; may contain inaccuracies
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${
                      msg.from === "user" ? "user" : "bot"
                    }`}
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

              {loading && <Loading />}

              <div ref={chatEndRef}></div>
            </div>
            <div className="form-container">
              <form onSubmit={handleSubmit}>
                <div className="inputgroup">
                  <textarea
                    name="chat"
                    id="chat"
                    value={chatInput}
                    placeholder="Type a message..."
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading}>
                    <ArrowUp size={18} />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {isOpenHistory && (
            <div className={`history-panel ${isOpenHistory ? "open" : ""}`}>
              <div className="history-header">
                <p>Previous Sessions</p>
                <button onClick={handleOpenHistory}>
                  <X />
                </button>
              </div>

              <div className="history-body">
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
                        <span>{c.title || "New Chat"}</span>

                        <button
                          type="button"
                          className="trash-button"
                          onClick={(e) => handleDeleteChat(e, c.chat_id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
