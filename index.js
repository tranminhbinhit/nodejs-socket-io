const {
  connectToTikTok,
  disconnectTikTok,
  tiktokConnection,
} = require("./tiktokHandler");
const express = require("express");
const cors = require("cors");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

let roomUserInfo = {}; // Lưu trữ thông tin người dùng trong từng room và page

let roomStreamInfo = {};

let roomConfigDefault = {
  isShowThankLike: false,
  isShowTopLike: false,
  isShowGiftInteract: false,
  showLiveText: '',  
  isLiveGroup: false,
  isLivePk: false,
};

// Test khong dung socket TODO
//connectToTikTok('khanhly_gl1986', io);//binhkolofficial | gacon_dangiuqua

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  let currentRoom = null;
  let currentPage = null;

  // Khi client yêu cầu tham gia phòng
  socket.on("join-room", (data) => {
    const { roomId, pageId } = data;

    // Nếu client đã tham gia phòng trước đó, rời khỏi phòng cũ
    if (currentRoom) {
      socket.leave(currentRoom);
      console.log(`Client ${socket.id} left room: ${currentRoom}`);
      roomUserInfo[currentRoom][currentPage] = roomUserInfo[currentRoom][
        currentPage
      ].filter((client) => client.socketId !== socket.id);
    }

    // Tham gia phòng mới
    socket.join(roomId);
    currentRoom = roomId;
    currentPage = pageId;
    console.log(
      `Client ${socket.id} joined room: ${roomId} from page: ${currentPage}`
    );

    // Thêm thông tin người dùng vào room
    if (!roomUserInfo[roomId]) {
      roomUserInfo[roomId] = {}; // Tạo object cho room nếu chưa có
    }

    if (!roomUserInfo[roomId][pageId]) {
      roomUserInfo[roomId][pageId] = []; // Tạo danh sách người dùng cho pageId nếu chưa có
    }

    if (!roomUserInfo[roomId]['roomConfig']) {
      roomUserInfo[roomId]['roomConfig'] = roomConfigDefault;
    }

    roomUserInfo[roomId][pageId].push({ socketId: socket.id });

    // Phát lại thông tin về số lượng người dùng từ từng trang
    const roomInfo = {
      roomInfo: roomUserInfo[roomId],
      tiktokConnection: tiktokConnection(),
    };
    io.to(roomId).emit("update-room-info", roomInfo);

    // Phát sự kiện cho tất cả các client trong phòng về người mới tham gia
    io.to(roomId).emit("user-joined", {
      userId: socket.id,
      pageId: currentPage,
    });
  });

  socket.on("set-room-info", (data) => {
    const { roomId, roomConfig } = data;

    if (roomUserInfo[roomId]) {
      roomUserInfo[roomId]['roomConfig'] = roomConfig; // Tạo danh sách người dùng cho pageId nếu chưa có
    }

    // Phát lại thông tin về số lượng người dùng từ từng trang
    const roomInfo = {
      roomInfo: roomUserInfo[roomId],
      tiktokConnection: tiktokConnection(),
    };
    io.to(roomId).emit("update-room-info", roomInfo);
  });

  // Nhận tin nhắn và phát lại cho các client khác trong cùng phòng
  socket.on("send-data", (data) => {
    const { roomId, message } = data;
    socket.to(roomId).emit("receive-data", { message, senderId: socket.id });
    console.log(`Message from ${socket.id} to room ${roomId}: ${message}`);
  });

  // Giả lập tiktok message
  socket.on("send_tiktok_data", (dataValue) => {
    const { roomId, type, data, dataEx = {} } = dataValue;
    const { uniqueId, nickname, profilePictureUrl, displayType } = data;
    console.log(
      `Message from send_tiktok_data`,
      uniqueId,
      nickname,
      profilePictureUrl,
      displayType
    );
    io.to(roomId).emit("tiktok_data", {
      username: uniqueId,
      type: type,
      data: { nickname, profilePictureUrl, displayType },
      dataEx,
    });
  });

  // Nhận tin nhắn và phát lại video các client khác trong cùng phòng
  socket.on("send-video", (data) => {
    const { roomId, message } = data;
    socket.to(roomId).emit("receive-video", { message, senderId: socket.id });
    console.log(`Message from ${socket.id} to room ${roomId}: ${message}`);
  });

  // Lắng nghe các sự kiện điều khiển (pause, play, stop, clear)
  socket.on("control", ({ roomId, action }) => {
    console.log(
      `Control action "${action}" from ${socket.id} in room ${roomId}`
    );
    io.to(roomId).emit("control", { action, userId: socket.id });
  });

  // Xử lý khi client ngắt kết nối
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    if (currentRoom) {
      roomUserInfo[currentRoom][currentPage] = roomUserInfo[currentRoom][
        currentPage
      ].filter((client) => client.socketId !== socket.id);

      // Phát lại số lượng người dùng trong phòng khi client ngắt kết nối
      io.to(currentRoom).emit("update-room-info", roomUserInfo[currentRoom]);
    }
  });

  // Nhận username TikTok từ client
  socket.on("connect_tiktok", (data) => {
    const { roomId, username } = data;
    // if (!roomStreamInfo[username]) {
    //   roomStreamInfo[username] = {}; // Tạo object cho room nếu chưa có
    // }
    connectToTikTok(io, socket, roomId, username);
    //socket.to(roomId).emit("receive-data", { message, senderId: socket.id });
  });

  // // Ngắt kết nối
  socket.on("disconnect_tiktok", (data) => {
    const { roomId, username } = data;
    console.log(`User disconnected: ${username}`);
    disconnectTikTok(io, roomId, username);
  });
});

/* ========================================= Giả lập client kết nối để test tiktok ========================================= */

/* ========================================= Trang chủ diễn giải ========================================= */
app.get("/", (req, res) => {
  return res.status(200).send("Welcome to Socket IO");
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
