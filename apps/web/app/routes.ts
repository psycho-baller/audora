import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

const isProduction = process.env.NODE_ENV === "production";

const authRoutes = isProduction
  ? []
  : [
      route("sign-in/*", "routes/sign-in.tsx"),
      route("sign-up/*", "routes/sign-up.tsx"),
      route("pricing", "routes/pricing.tsx"),
      route("success", "routes/success.tsx"),
      route("subscription-required", "routes/subscription-required.tsx"),
      route("join/:id", "routes/join.$id.tsx"),
      layout("routes/dashboard/layout.tsx", [
        route("dashboard", "routes/dashboard/index.tsx"),
        route("dashboard/conversations", "routes/record.tsx"),
        route("dashboard/conversations/:id", "routes/record.$id.tsx"),
        route("dashboard/import", "routes/dashboard/import.tsx"),
        route("dashboard/analytics", "routes/dashboard/analytics.tsx"),
        route("dashboard/chat", "routes/dashboard/chat.tsx"),
        route("dashboard/settings", "routes/dashboard/settings.tsx"),
        route("dashboard/network", "routes/dashboard/network.tsx"),
        route("dashboard/network/:userId", "routes/dashboard/network/$userId.tsx"),
      ]),
    ];

export default [
  index("routes/home.tsx"),
  route("waitlist", "routes/waitlist.tsx"),
  route("manifesto", "routes/manifesto.tsx"),
  ...authRoutes,
] satisfies RouteConfig;
