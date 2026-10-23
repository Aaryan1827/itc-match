import { createFileRoute } from "@tanstack/react-router";

import { handleReconcile } from "@/lib/server/handler";

/** Thin route: all logic lives in lib/server so it can be tested without the framework. */
export const Route = createFileRoute("/api/reconcile")({
  server: {
    handlers: {
      POST: ({ request }) => handleReconcile(request, process.env),
    },
  },
});
