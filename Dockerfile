FROM node:18-alpine

WORKDIR /app

# Install server dependencies
COPY package*.json ./
RUN npm install --production

# Install client dependencies and build
COPY client/package*.json ./client/
RUN cd client && npm install

COPY . .
RUN cd client && npm run build

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server/index.js"]
