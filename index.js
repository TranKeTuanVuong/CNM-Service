const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const socketHandler = require("./socket/index");

const PORT = process.env.PORT || 5000;
const SOCKET_PORT = process.env.PORTSEVER || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

socketHandler(io);

server.listen(SOCKET_PORT, () =>
  console.log(`🚀 Server with Socket.IO running on port ${SOCKET_PORT}`)
);
