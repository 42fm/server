import { ChatUserstate } from "tmi.js";
import { Responder } from "./responder";

export interface Context {
  responder: Responder;
  room: string;
  tags: ChatUserstate;
}

type RouteMiddleware = (ctx: Context, args: string[], next?: () => void) => void;

interface Route {
  middlewares: RouteMiddleware[];
  cb: RouteMiddleware;
  router?: Router;
}

export class Router<K extends string = any> {
  routes: Map<K, Route>;

  constructor() {
    this.routes = new Map();
  }

  register(name: K, ...functions: RouteMiddleware[]) {
    this.routes.set(name, {
      middlewares: functions.length > 0 ? functions.slice(0, functions.length - 1) : [],
      cb: functions.at(-1),
    });
  }

  registerNextRouter(name: K, nextRouter: Router) {
    const router = this.routes.get(name);
    router.router = nextRouter;
  }

  route(ctx: Context, segments: K[], idx: number): void {
    if (!this.routes.has(segments[idx])) return;

    let { middlewares, cb, router } = this.routes.get(segments[idx]);

    for (const middleware of middlewares) {
      let calledBack = false;
      const callback = () => (calledBack = true);
      middleware(ctx, segments, callback);
      if (!calledBack) return;
    }

    if (router !== undefined && idx !== segments.length - 1 && router.routes.has(segments[idx + 1])) {
      router.route(ctx, segments, idx + 1);
    } else {
      cb(ctx, segments.slice(idx + 1, segments.length));
    }
  }
}
