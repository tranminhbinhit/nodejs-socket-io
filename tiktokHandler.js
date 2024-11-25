const { WebcastPushConnection } = require("tiktok-live-connector");

// Quản lý kết nối TikTok theo socket
const tiktokConnections = {};

// Hàm khởi tạo kết nối TikTok
function connectToTikTok(io, socket, roomId, username) {
  if (!username) return;
  if (tiktokConnections[socket.id]) {
    const message = `${socket.id} Đã kết nối. Ngắt kết nối để kết nối mới`;
    sendReceiveData(false, message);
    return;
  }
  console.log(
    `========> Room ${roomId} đang thực hiện kết nối tiktok: ${socket.id}`
  );
  // Tạo kết nối TikTok
  const configConnect = {
    processInitialData: true,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
    requestOptions: {
      timeout: 50000,
    },
    websocketOptions: {
      timeout: 50000,
    },
  };
  const tiktokLiveConnection = new WebcastPushConnection(username);
  //TODO nếu dùng socket
  //socket.id
  tiktokConnections[socket.id] = tiktokLiveConnection;

  tiktokLiveConnection
    .connect()
    .then(() => {
      const message = `Đã kết nối tới TikTok: ${username}`;
      sendReceiveData(true, message);
    })
    .catch((err) => {
      const message = `Không thể kết nối với TikTok: ${err}`;
      sendReceiveData(false, message);
    });

  let joinedUsers = {}; // Lưu trạng thái người dùng đã join

  function tiktokDataSend(type, data, dataEx = {}) {
    const { uniqueId, nickname, profilePictureUrl, displayType } = data;
    io.to(roomId).emit("tiktok_data", {
      username: uniqueId,
      type: type,
      data: { nickname, profilePictureUrl, displayType },
      dataEx,
    });
  }

  function sendReceiveData(status, message) {
    console.log(`${socket.id} ============ ${message}`);
    io.to(roomId).emit("receive-data", {
      tiktokLive: {
        status,
        message,
      },
    });
  }

  function joinRoom(data) {
    tiktokDataSend("join_room", data);
    console.log(`${data.uniqueId} đã tham gia room! =====================`);
  }

  // Bình luận
  tiktokLiveConnection.on("chat", (data) => {
    if (!joinedUsers[data.uniqueId]) {
      joinedUsers[data.uniqueId] = true;

      // Phát sự kiện join room
      joinRoom(data);
    }
    tiktokDataSend("new_comment", data, { comment: data.comment });

    console.log(`Bình luận:`, `${data.uniqueId}: ${data.comment}`);
  });

  // Quà tặng
  tiktokLiveConnection.on("gift", (data) => {
    if (!joinedUsers[data.uniqueId]) {
      joinedUsers[data.uniqueId] = true;

      joinRoom(data);
    }

    tiktokDataSend("new_gift", data, {
      giftName: data.giftName,
      repeatCount: data.repeatCount,
      diamondCount: data.diamondCount,
    });

    console.log(
      `Quà tặng:`,
      `${data.uniqueId}: ${data.giftName} - ${data.diamondCount}`
    );
  });

  // Like
  tiktokLiveConnection.on("like", (data) => {
    if (!joinedUsers[data.uniqueId]) {
      joinedUsers[data.uniqueId] = true;

      joinRoom(data);
    }
    console.log(`like:`, `${data.uniqueId}: ${data.nickname}`);
    tiktokDataSend("new_like", data, {
      likeCount: data.likeCount,
      totalLikeCount: data.totalLikeCount,
    });
  });

  // Viewer mới
  tiktokLiveConnection.on("viewer", (data) => {
    tiktokDataSend("viewer", data);
  });

  // Tổng số người xem
  tiktokLiveConnection.on("roomUser", (data) => {
    //{ viewerCount: data.viewerCount }
  });

  // Livestream kết thúc
  tiktokLiveConnection.on("streamEnd", () => {
    //{ message: 'Livestream đã kết thúc.' }
  });

  // Theo dõi hoặc chia sẻ
  tiktokLiveConnection.on("social", (data) => {
    console.log(
      `Theo dõi hoặc chia sẻ:`,
      `${data.uniqueId}: ${data.displayType}`
    );
    tiktokDataSend("new_social_event", data, {
      eventType: data.eventType,
    });
  });

  // Biểu cảm
  tiktokLiveConnection.on("emote", (data) => {
    tiktokDataSend("new_emote", data, {
      emoteName: data.emoteName,
    });

    console.log(`Biểu cảm:`, `${data.uniqueId}: ${data.emoteName}`);
  });
}

// Hàm ngắt kết nối TikTok
function disconnectTikTok(io, socket, roomId) {
  let message = `Không có kết nối`;
  if (tiktokConnections[socket.id]) {
    tiktokConnections[socket.id].disconnect();
    delete tiktokConnections[socket.id];
    message = `Đã ngắt kết nối TikTok của socket: ${socket.id}`;
  }
  io.to(roomId).emit("receive-data", {
    tiktokLive: {
      status: false,
      message,
    },
  });
}

module.exports = {
  connectToTikTok,
  disconnectTikTok,
};
