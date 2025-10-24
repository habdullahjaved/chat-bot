import React from "react";

const Loading = () => {
  return (
    <div className="typing-indicator text-secondary mt-2 d-flex align-items-center gap-2">
      <div className="dots">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
      <small className="fw-medium">Afaq Tours is typing...</small>
    </div>
  );
};

export default Loading;
