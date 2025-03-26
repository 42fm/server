import type { ChatUserstate } from "tmi.js";
import type { Responder } from "./responder.js";

export interface Context {
  responder: Responder;
  room: string;
  tags: ChatUserstate;
  manager: SongManagerI;
}

export type Args = string[];
export type Next = () => void;

type RouteMiddleware<T> = (ctx: T, args: string[], next: Next) => Promise<void> | void;

interface Route<T> {
  middlewares: RouteMiddleware<T>[];
  cb: RouteMiddleware<T>;
  router?: Router<T>;
}

export class Router<T = Context, K extends string = string> {
  routes: Map<K, Route<T>>;

  constructor() {
    this.routes = new Map();
  }

  register(name: K, ...functions: RouteMiddleware<T>[]) {
    this.routes.set(name, {
      middlewares: functions.length > 0 ? functions.slice(0, functions.length - 1) : [],
      cb: functions[functions.length - 1],
    });
  }

  registerNextRouter(name: K, nextRouter: Router<T>) {
    const router = this.routes.get(name);

    if (!router) {
      throw new Error("Router not found");
    }

    router.router = nextRouter;
  }

  async route(ctx: T, segments: K[], idx: number = 0): Promise<void> {
    if (!this.routes.has(segments[idx])) return;

    const route = this.routes.get(segments[idx])!;

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
        throw new Error("Can't invoke next in the final segment");
      });
    }
  }
}
