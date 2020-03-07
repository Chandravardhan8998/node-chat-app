const express = require("express");
const http = require("http");
const path = require("path");
const socketio = require("socket.io");
const Filter = require("bad-words");
const { generateMessage } = require("./utils/messages");
const {
  addUser,
  getUser,
  getUsersInRoom,
  removeUser
} = require("./utils/users");

const port = process.env.PORT || 3000;
const app = express();

const server = http.createServer(app);
const io = socketio(server);
const publicDir = path.join(__dirname, "../public");

app.use(express.static(publicDir));

io.on("connection", socket => {
  console.log("New websocket connection");

  socket.on("join", (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options });
    if (error) {
      return callback(error);
    }
    socket.join(user.room);

    socket.emit("message", generateMessage("Admin", "Welcome"));
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        generateMessage("Admin", `${user.username} has joined!`)
      );
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room)
    });
  });

  socket.on("sendMessage", (msg, callback) => {
    const { error, user } = getUser(socket.id);
    if (error) {
      return callback(error);
    }
    const filter = new Filter();

    if (filter.isProfane(msg)) {
      return callback("Profanity not allowed!!");
    }

    io.to(user.room).emit("message", generateMessage(user.username, msg));
    return callback();
  });

  socket.on("sendLocation", (location, callback) => {
    const { error, user } = getUser(socket.id);
    if (error) {
      return callback(error);
    }
    io.to(user.room).emit(
      "locationmessage",
      generateMessage(
        user.username,
        `https://google.com/maps?q=${location.latitude},${location.longitude}`
      )
    );
    callback();
  });
  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessage("Admin", `${user.username} has left!`)
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});
server.listen(port, () => {
  console.log("server is running");
});
