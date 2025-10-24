import { Trash2, X } from "lucide-react";
import React from "react";

const ChatHistory = ({
  isOpenHistory,
  handleOpenHistory,
  chats,
  handleDeleteChat,
}) => {
  return (
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
  );
};

export default ChatHistory;
