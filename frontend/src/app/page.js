import Image from "next/image";
import styles from "./page.module.css";
import Chatbot from "@/components/Chatbot";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="container">
        <h1>Welcome to Afaq Tours</h1>
        <p>Afaq Tours is a Leading tour operator in Dubai</p>

        <p>See Chat Full Screen view</p>
        <Link href={"/chat"}>Chat</Link>
      </div>
    </>
  );
}
