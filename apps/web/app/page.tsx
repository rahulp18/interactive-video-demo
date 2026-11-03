import { redirect } from "next/navigation";

// The dashboard handles the signed-out case by sending visitors to /login.
export default function HomePage() {
  redirect("/dashboard");
}
