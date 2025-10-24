import React from "react";
import Loading from "./atoms/Loading";
import ReactMarkdown from "react-markdown";
const ChatArea = ({ loading, messages, chatEndRef }) => {
  return (
    <div className="chat-area">
      {messages.length === 0 ? (
        <p className="text-muted text-center mt-5">
          AI-generated; may contain inaccuracies
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

      {loading && <Loading />}

      <div ref={chatEndRef}></div>
    </div>
  );
};

export default ChatArea;
