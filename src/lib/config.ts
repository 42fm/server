import { redisClient } from "@db/redis";
import { logger } from "@utils/loggers";

export class Config<T> {
  private settings: T;

  constructor(settings: T) {
    this.settings = settings;
  }

  async init() {
    try {
      let raw = await redisClient.get("config");

      if (!raw) {
        await redisClient.set("config", JSON.stringify(this.settings));
        raw = JSON.stringify(this.settings);
      }

      const config = JSON.parse(raw) as T;

      if (!config) return;

      for (const key in config) {
        if (Object.prototype.hasOwnProperty.call(config, key)) {
          const element = config[key];
          this.settings[key] = element;
        }
      }

      await redisClient.set("config", JSON.stringify(this.settings));
    } catch (e) {
      logger.error(e);
    }
  }

  async set<K extends keyof T>(key: K, value: T[K]) {
    this.settings[key] = value;
    return await this.sync();
  }

  get<K extends keyof T>(key: K) {
    return this.settings[key];
  }

  async sync() {
    return await redisClient.set("config", JSON.stringify(this.settings));
  }
}
