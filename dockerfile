FROM node:17

WORKDIR /base

COPY package.json . 
COPY yarn.lock .
COPY . .

RUN git submodule update --init --recursive
RUN yarn install
RUN yarn build 

ENV PORT 8080

EXPOSE 8080

CMD ["node", "./dist/src/index.js"]