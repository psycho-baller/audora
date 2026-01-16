import { redirect } from "react-router";
import type { Route } from "./+types/survey";

export async function loader({}: Route.LoaderArgs) {
  return redirect("https://app.formbricks.com/s/cmikz8vnu8hxlad01g9gp707t");
}

export default function Survey() {
  // This component will never render because of the redirect
  return null;
}
