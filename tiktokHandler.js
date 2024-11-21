const { WebcastPushConnection } = require('tiktok-live-connector');

// Quản lý kết nối TikTok theo socket
const tiktokConnections = {};

// Hàm khởi tạo kết nối TikTok
function connectToTikTok(username, socket) {
    if (!username) return;

    // Tạo kết nối TikTok
    const tiktokLiveConnection = new WebcastPushConnection(username);
    //TODO nếu dùng socket 
    // tiktokConnections[socket.id] = tiktokLiveConnection;

    tiktokLiveConnection.connect()
        .then(() => {
            console.log(`Đã kết nối tới TikTok Live của: ${username}`);
        })
        .catch(err => {
            console.error(`Không thể kết nối với TikTok: ${err}`);
            socket.emit('error', 'Kết nối thất bại. Vui lòng thử lại.');
        });

    let joinedUsers = {}; // Lưu trạng thái người dùng đã join

    function joinRoom(data) {
        // socket.emit('tiktok_data', {
        //     username: data.uniqueId,
        //     type: 'join_room',
        //     data: `${data.uniqueId} đã tham gia room!`
        // });
        console.log(`${data.uniqueId} đã tham gia room! =====================`);
    }

    // Bình luận
    tiktokLiveConnection.on('chat', data => {

        if (!joinedUsers[data.uniqueId]) {
            joinedUsers[data.uniqueId] = true;

            // Phát sự kiện join room
            joinRoom(data);
        }

        //socket.emit('new_comment', { username: data.uniqueId, comment: data.comment });
        // socket.emit('tiktok_data', {
        //     username: data.uniqueId,
        //     type: 'new_comment',
        //     data: data.comment
        // });

        console.log(`Bình luận:`, `${data.uniqueId}: ${data.comment}`);
    });

    // Quà tặng
    tiktokLiveConnection.on('gift', data => {
        if (!joinedUsers[data.uniqueId]) {
            joinedUsers[data.uniqueId] = true;

            joinRoom(data);
        }
        socket.emit('new_gift', {
            username: data.uniqueId,
            giftName: data.giftName,
            repeatCount: data.repeatCount,
            diamondCount: data.diamondCount
        });

        console.log(`Quà tặng:`, `${data.uniqueId}: ${data.giftName} - ${data.diamondCount}`);
    });

    // Like
    tiktokLiveConnection.on('like', data => {
        if (!joinedUsers[data.uniqueId]) {
            joinedUsers[data.uniqueId] = true;

            joinRoom(data);
        }
        socket.emit('new_like', {
            username: data.uniqueId,
            likeCount: data.likeCount,
            totalLikeCount: data.totalLikeCount
        });
        console.log(`like:`, `${data.uniqueId}: ${data.nickname}`);
        /*
        uniqueId: 'ngchu0027',
  nickname: '🌺Mỹ Ngà🌺',
  profilePictureUrl: 'https://p16-sign-sg.tiktokcdn.com/aweme/100x100/tos-alisg-avt-0068/1d0b17ec9b7b3b19706267c1cbb5e07e.webp?lk3s=a5d48078&nonce=14339&refresh_token=37e7f1d73a27a4c81c2bdc9bc160b350&x-expires=1732291200&x-signature=Zyk2Xsb8Q9Qgw6UHmdVeMvtoSIc%3D&shp=a5d48078&shcp=fdd36af4',
   displayType: 'pm_mt_msg_viewer',
        */

    });

    // Viewer mới
    tiktokLiveConnection.on('viewer', data => {
        socket.emit('new_viewer', {
            username: data.uniqueId,
            profilePicture: data.profilePictureUrl
        });
    });

    // Tổng số người xem
    tiktokLiveConnection.on('roomUser', data => {
        socket.emit('viewer_count', { viewerCount: data.viewerCount });
    });

    // Livestream kết thúc
    tiktokLiveConnection.on('streamEnd', () => {
        socket.emit('stream_ended', { message: 'Livestream đã kết thúc.' });
    });

    // Theo dõi hoặc chia sẻ
    tiktokLiveConnection.on('social', data => {
        socket.emit('new_social_event', {
            username: data.uniqueId,
            eventType: data.eventType // "follow" hoặc "share"
        });
        console.log(`Theo dõi hoặc chia sẻ:`, `${data.uniqueId}: ${data.displayType}`);

        /*
        uniqueId: 'duy.iu.v',
  nickname: 'Duy điều Võ',
  profilePictureUrl: 'https://p16-sign-sg.tiktokcdn.com/aweme/100x100/tos-alisg-avt-0068/cc1df7704a86416afd1b1f91cd719ea8.webp?lk3s=a5d48078&nonce=19410&refresh_token=c51c11d5838d03e3c77747d5f34052e8&x-expires=1732291200&x-signature=9X%2FlVfNSLxIQh2fDXc1%2Br76qAjM%3D&shp=a5d48078&shcp=fdd36af4',
  displayType: 'pm_main_follow_message_viewer_2',
  label: '{0:user} followed the LIVE creator'
        */
    });

    // Biểu cảm
    tiktokLiveConnection.on('emote', data => {
        socket.emit('new_emote', {
            username: data.uniqueId,
            emoteName: data.emoteName
        });

        console.log(`Biểu cảm:`, `${data.uniqueId}: ${data.emoteName}`);
    });
}

// Hàm ngắt kết nối TikTok
function disconnectTikTok(socketId) {
    if (tiktokConnections[socketId]) {
        tiktokConnections[socketId].disconnect();
        delete tiktokConnections[socketId];
        console.log(`Đã ngắt kết nối TikTok của socket: ${socketId}`);
    }
}

module.exports = {
    connectToTikTok,
    disconnectTikTok
};
