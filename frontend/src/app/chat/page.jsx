import Chatbot from "@/components/Chatbot";
import React from "react";
export const metadata = {
  title: "Afaq Tours' Ai Assistant",
  description: "Get Response from Afaq Tours on realtime bases",
};
const page = () => {
  return (
    <div>
      <Chatbot />
    </div>
  );
};

export default page;
