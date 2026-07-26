import {
  ControlEvent,
  TikTokLiveConnection,
  WebcastEvent,
} from "tiktok-live-connector";

// Quản lý kết nối TikTok theo socket
const tiktokConnections = {};

function tiktokConnection() {
  return Object.keys(tiktokConnections).map((key) => `${key}`);
}

// Hàm khởi tạo kết nối TikTok
function connectToTikTok(io, socket, roomId, username) {
  if (!username) return;
  if (tiktokConnections[username]) {
    const message = `${username} Đã kết nối. Ngắt kết nối để kết nối mới`;
    sendReceiveData(io, roomId, false, message);
    return;
  }

  // Tạo kết nối TikTok
  const configConnect = {
    processInitialData: true,
    // Không bật enableExtendedGiftInfo: endpoint danh sách quà yêu cầu
    // Euler Stream Business. Dữ liệu giftDetails trong event đã đủ cho UI.
    enableExtendedGiftInfo: false,
    webClientOptions: {
      timeout: { request: 50000 },
    },
    wsClientOptions: {
      handshakeTimeout: 50000,
    },
  };
  const tiktokLiveConnection = new TikTokLiveConnection(
    username,
    configConnect
  );
  //TODO nếu dùng socket
  //socket.id
  tiktokConnections[username] = tiktokLiveConnection;

  tiktokLiveConnection
    .connect()
    .then(() => {
      const message = `Đã kết nối tới TikTok: ${username}`;
      sendReceiveData(io, roomId, true, message);
    })
    .catch((err) => {
      const message = `Không thể kết nối với TikTok: ${err}`;
      delete tiktokConnections[username];
      sendReceiveData(io, roomId, false, message);
    });

  let joinedUsers = {}; // Lưu trạng thái người dùng đã join

  function imageUrl(image) {
    if (!image) return null;
    if (typeof image === "string") return image;
    if (Array.isArray(image)) {
      return image.find((url) => typeof url === "string" && url.length) || null;
    }
    const urls = image.urlList || image.url || image.urls;
    if (Array.isArray(urls)) {
      return urls.find((url) => typeof url === "string" && url.length) || null;
    }
    return typeof urls === "string" ? urls : image.uri || null;
  }

  function eventUser(data) {
    return data?.user || data || {};
  }

  function eventUniqueId(data) {
    const user = eventUser(data);
    return user.uniqueId || user.displayId;
  }

  function tiktokDataSend(type, data, dataEx = {}) {
    const user = eventUser(data);
    const uniqueId = eventUniqueId(data);
    const nickname = user.nickname;
    const profilePictureUrl =
      imageUrl(user.avatarLarge) ||
      imageUrl(user.avatarMedium) ||
      imageUrl(user.avatarThumb) ||
      imageUrl(user.profilePicture) ||
      imageUrl(user.profilePictureUrl);
    const displayType =
      data.displayType || data.common?.displayText?.displayType;
    io.to(roomId).emit("tiktok_data", {
      username: uniqueId,
      type: type,
      data: { nickname, profilePictureUrl, displayType },
      dataEx,
    });
  }

  function joinRoom(data) {
    const uniqueId = eventUniqueId(data);
    if (!uniqueId || joinedUsers[uniqueId]) return;

    joinedUsers[uniqueId] = true;
    tiktokDataSend("join_room", data, {
      memberCount: data.memberCount,
    });
  }

  // Người xem mới vào phòng. Schema v3 phát event MEMBER thay cho "viewer".
  tiktokLiveConnection.on(WebcastEvent.MEMBER, (data) => {
    joinRoom(data);
  });

  // Bình luận
  tiktokLiveConnection.on(WebcastEvent.CHAT, (data) => {
    // Một số phòng không phát MEMBER ổn định, nên dùng tương tác làm fallback.
    joinRoom(data);
    // Schema v3 đổi tên trường nội dung từ `comment` thành `content`.
    // Giữ fallback để vẫn tương thích nếu TikTok trả schema v2.
    tiktokDataSend("new_comment", data, {
      comment: data.content ?? data.comment ?? "",
    });
  });

  // Quà tặng
  tiktokLiveConnection.on(WebcastEvent.GIFT, (data) => {
    const uniqueId = eventUniqueId(data);
    joinRoom(data);

    const giftType = data.gift?.type ?? data.giftDetails?.giftType;
    const repeatCount = Number(data.repeatCount || 1);
    const repeatEnd = Boolean(data.repeatEnd);
    const giftDiamondCount = Number(
      data.gift?.diamondCount ??
      data.giftDetails?.diamondCount ??
      data.extendedGiftInfo?.diamondCount ??
      0
    );

    // Gift dạng streak được phát nhiều lần với repeatCount tăng dần.
    // Chỉ gửi lần cuối để UI không chạy hiệu ứng và cộng coin trùng.
    if (giftType === 1 && !repeatEnd) return;

    tiktokDataSend("new_gift", data, {
      // Schema v3 trả ID dạng string, trong khi frontend đang so với number.
      giftId: Number(data.giftId || data.gift?.id || 0),
      giftType,
      giftName:
        data.gift?.name ||
        data.giftDetails?.giftName ||
        data.extendedGiftInfo?.name,
      diamondCount: giftDiamondCount * repeatCount,
      giftPictureUrl:
        imageUrl(data.gift?.image) ||
        imageUrl(data.giftDetails?.giftImage) ||
        imageUrl(data.extendedGiftInfo?.picture),
      repeatCount,
      repeatEnd,
    });

    console.log(
      "Quà tặng:",
      `${uniqueId}: ${data.gift?.name || data.giftDetails?.giftName || data.giftId}`
    );
  });

  // Like
  tiktokLiveConnection.on(WebcastEvent.LIKE, (data) => {
    joinRoom(data);

    tiktokDataSend("new_like", data, {
      likeCount: data.count ?? data.likeCount,
      totalLikeCount: Number(data.total ?? data.totalLikeCount ?? 0),
    });
  });

  // Viewer mới
  // Tổng số người xem
  tiktokLiveConnection.on(WebcastEvent.ROOM_USER, (data) => {
    tiktokDataSend("viewer", data, {
      viewerCount: Number(
        data.totalUser ?? data.viewerCount ?? data.total ?? data.popularity ?? 0
      ),
    });
  });

  // Livestream kết thúc
  tiktokLiveConnection.on(WebcastEvent.STREAM_END, () => {
    delete tiktokConnections[username];
    sendReceiveData(io, roomId, false, `TikTok LIVE đã kết thúc: ${username}`);
  });

  // Theo dõi hoặc chia sẻ
  tiktokLiveConnection.on(WebcastEvent.SOCIAL, (data) => {
    joinRoom(data);
    tiktokDataSend("new_social_event", data, {
      eventType: data.action || data.shareType,
      followCount: Number(data.followCount || 0),
      shareCount: data.shareCount,
    });
  });

  // Biểu cảm
  tiktokLiveConnection.on(WebcastEvent.EMOTE, (data) => {
    joinRoom(data);
    tiktokDataSend("new_emote", data, {
      emoteName: data.emoteList?.[0]?.emoteId,
      emoteImageUrl: imageUrl(data.emoteList?.[0]?.image),
    });
  });

  tiktokLiveConnection.on(ControlEvent.ERROR, ({ info, exception }) => {
    console.error(`Lỗi kết nối TikTok ${username}:`, info, exception || "");
  });
}

function sendReceiveData(io, roomId, status, message) {
  io.to(roomId).emit("receive-data", {
    tiktokLive: {
      status,
      message,
    },
    tiktokConnection: tiktokConnection()
  });
}

// Hàm ngắt kết nối TikTok
function disconnectTikTok(io, roomId, username) {
  let message = `Không có kết nối`;
  if (tiktokConnections[username]) {
    tiktokConnections[username].disconnect();
    delete tiktokConnections[username];
    message = `Đã ngắt kết nối TikTok của socket: ${username}`;
  }
  sendReceiveData(io, roomId, false, message);
}

export {
  connectToTikTok,
  disconnectTikTok,
  tiktokConnection,
};
