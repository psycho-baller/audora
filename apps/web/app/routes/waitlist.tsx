import { redirect } from "react-router";
import type { Route } from "./+types/waitlist";

export async function loader({}: Route.LoaderArgs) {
  return redirect("https://rami-m.notion.site/28df55603e858168bee0c3a7f97a0fb1");
}

export default function Waitlist() {
  // This component will never render because of the redirect
  return null;
}
