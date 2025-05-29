FROM node:24-alpine

WORKDIR /app

COPY package.json .
COPY yarn.lock .
COPY .yarnrc.yml .

RUN corepack enable
RUN yarn set version berry
RUN yarn install --immutable

COPY . .

RUN yarn build

CMD ["node", "dist/index.js"]