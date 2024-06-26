import { ChatUserstate } from "tmi.js";
import { Responder } from "./responder.js";

export interface Context {
  responder: Responder;
  room: string;
  tags: ChatUserstate;
}

export type Args = string[];
export type Next = () => void;

type RouteMiddleware = (ctx: Context, args: string[], next: Next) => Promise<void> | void;

interface Route {
  middlewares: RouteMiddleware[];
  cb: RouteMiddleware;
  router?: Router;
}

export class Router<K extends string = string> {
  routes: Map<K, Route>;

  constructor() {
    this.routes = new Map();
  }

  register(name: K, ...functions: RouteMiddleware[]) {
    this.routes.set(name, {
      middlewares: functions.length > 0 ? functions.slice(0, functions.length - 1) : [],
      cb: functions[functions.length - 1],
    });
  }

  registerNextRouter(name: K, nextRouter: Router) {
    const router = this.routes.get(name);

    if (!router) {
      throw new Error("Router not found");
    }

    router.router = nextRouter;
  }

  async route(ctx: Context, segments: K[], idx: number): Promise<void> {
    if (!this.routes.has(segments[idx])) return;

    const route = this.routes.get(segments[idx]);

    if (!route) {
      throw new Error("Route not found");
    }

    const { middlewares, cb, router } = route;

    for (const middleware of middlewares) {
      let calledBack = false;
      const callback = () => (calledBack = true);
      await middleware(ctx, segments, callback);
      if (!calledBack) return;
    }

    if (router !== undefined && idx !== segments.length - 1 && router.routes.has(segments[idx + 1])) {
      router.route(ctx, segments, idx + 1);
    } else {
      cb(ctx, segments.slice(idx + 1, segments.length), () => {
        throw new Error("Route not found");
      });
    }
  }
}
