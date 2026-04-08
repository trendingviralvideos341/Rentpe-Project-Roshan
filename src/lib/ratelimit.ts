import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const rateLimits = {
    auth:    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  "1 m"), prefix: "rl:auth",    analytics: true }),
    api:     new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "rl:api",     analytics: true }),
    lookup:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 m"), prefix: "rl:lookup",  analytics: true }),
    payment: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "rl:payment", analytics: true }),
};
