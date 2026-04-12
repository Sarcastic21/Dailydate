require("dotenv").config(); // Load environment variables
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const compression = require("compression");

// Routes
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const datingRoutes = require("./routes/dating");
const chatRoutes = require("./routes/chat");
const imagekitRoutes = require("./routes/imagekit");
const fcmRoutes = require("./routes/fcm");
const notificationRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");
const { sendChatMessagePush } = require("./services/fcmPush");
const { createStoredNotification } = require("./services/storedNotification");
require("./workers/botWorker");
const { startCleanupLoop } = require("./services/redisCleanupService");
const {
    ensureUsageDay,
    canSendMessage,
    recordMessageRecipientIfNeeded,
    getEffectiveTier,
} = require("./services/subscription");
const botInteractionService = require("./services/botInteractionService");

// Start Redis cleanup service for 30MB free tier optimization
startCleanupLoop();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// MongoDB


mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ MongoDB error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dating", datingRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/imagekit", imagekitRoutes);
app.use("/api", fcmRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payment", require("./routes/payment"));
app.use("/api/admin", adminRoutes);

app.get("/health", (req, res) => res.json({ status: "OK" }));

// ─── Socket.IO Real-time Status & Chat ──────────────────────
const redisClient = require("./config/redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

const Match = require("./models/Match");
const Message = require("./models/Message");
const User = require("./models/User");
const { emitToUserSockets } = require("./utils/socketEmit");

// Setup Redis Adapter
pubClient.on("error", (err) => console.error("❌ Redis PubClient Error:", err));
subClient.on("error", (err) => console.error("❌ Redis SubClient Error:", err));

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("✅ Socket.io Redis Adapter connected");
});

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Register user
    socket.on("register", async (userId) => {
        if (!userId || userId === "null") {
            console.error("❌ Invalid userId in socket register:", userId);
            return;
        }

        const uid = String(userId);
        socket.userId = uid;

        const socketKey = `user:sockets:${uid}`;

        try {
            // Check if user is a bot - prevent bot users from using sockets
            const user = await User.findById(uid);
            if (user && user.userType === "bot") {
                console.log(`⚠️ Bot user ${uid} attempted to register socket - blocked`);
                return;
            }

            // Remove any stale socket IDs for this user before adding the new one.
            // Stale entries accumulate when the server restarts or connections drop ungracefully.
            const existingIds = await redisClient.sMembers(socketKey);
            for (const sid of existingIds) {
                // Check if the socket is actually connected in this server instance
                const activeSockets = await io.fetchSockets();
                const isActive = activeSockets.some(s => s.id === sid);
                if (!isActive) {
                    await redisClient.sRem(socketKey, sid);
                }
            }

            await redisClient.sAdd(socketKey, socket.id);
            await redisClient.expire(socketKey, 14400); // 4 hours (was 24h)

            console.log(`User ${uid} registered socket ${socket.id}`);

            await User.findByIdAndUpdate(uid, {
                lastActive: new Date(),
                isOnline: true
            });
        } catch (err) {
            console.error("Socket register error:", err);
        }
    });

    // Join conversation room (string id so all clients share the same Socket.IO room)
    socket.on("joinRoom", (matchId) => {
        const room = String(matchId);
        socket.join(room);
    });

    socket.on("leaveRoom", (matchId) => {
        socket.leave(String(matchId));
    });

    // Send message
    socket.on("sendMessage", async ({ matchId, senderId, receiverId, content }) => {
        try {
            const room = String(matchId);
            if (!senderId || !receiverId) {
                console.error("sendMessage missing senderId/receiverId");
                return;
            }
            // Save message
            const message = await Message.create({
                matchId: room,
                senderId,
                receiverId,
                content,
            });

            // Bump match so conversation list sorts by recent activity (last message comes from Message collection)
            await Match.findByIdAndUpdate(room, { $set: { updatedAt: new Date() } });

            // Emit to room (same string id as joinRoom)
            io.to(room).emit("newMessage", {
                _id: message._id,
                matchId: room,
                senderId,
                receiverId,
                content,
                createdAt: message.createdAt,
            });

            let receiverInThisChat = false;
            try {
                const inRoom = await io.in(room).fetchSockets();
                receiverInThisChat = inRoom.some((s) => String(s.userId) === String(receiverId));
            } catch {
                receiverInThisChat = false;
            }

            const socketKeyRecv = `user:sockets:${String(receiverId)}`;
            let receiverHasSocket = false;
            try {
                const ids = await redisClient.sMembers(socketKeyRecv);
                receiverHasSocket = ids && ids.length > 0;
            } catch {
                receiverHasSocket = false;
            }

            const senderDoc = await User.findById(senderId).select("name profilePhotos").lean();
            const preview = String(content || "").slice(0, 200);
            const receiverDoc = await User.findById(receiverId).select("accountType subscriptionExpiresAt").lean();
            const receiverTier = getEffectiveTier(receiverDoc);
            const isPremiumReceiver = receiverTier === "gold" || receiverTier === "platinum";

            const senderName = senderDoc?.name || "Someone";
            const senderPhoto = senderDoc?.profilePhotos?.[0]?.url;

            let finalTitle = `Message from ${senderName}`;
            let finalBody = preview;
            let finalSenderName = senderName;
            let finalSenderPhoto = senderPhoto;

            if (!isPremiumReceiver) {
                finalTitle = "Someone sent you a message";
                finalBody = "Unlock Premium to read the message";
                finalSenderName = "Someone";
                finalSenderPhoto = senderPhoto;
            }

            const notifPayload = {
                matchId: room,
                senderId: String(senderId),
                senderName: finalSenderName,
                senderPhoto: finalSenderPhoto,
                content: finalBody,
                isLocked: !isPremiumReceiver,
            };

            if (!receiverInThisChat) {
                // Always persist to DB so unread count is always accurate.
                // createStoredNotification also sends FCM internally.
                await createStoredNotification(receiverId, {
                    type: "message",
                    title: finalTitle,
                    body: finalBody,
                    data: {
                        type: "message",
                        matchId: room,
                        senderId: String(senderId),
                        senderName: finalSenderName,
                        senderPhoto: finalSenderPhoto,
                        content: finalBody,
                    },
                });

                await emitToUserSockets(io, redisClient, receiverId, "messageNotification", notifPayload);
            }

            // --- BOT AUTO-REPLY LOGIC ---
            if (receiverDoc && receiverDoc.userType === "bot") {
                // Schedule a simple "Hy/Hello" reply after 2-3 mins
                await botInteractionService.handleBotReply(senderId, receiverId, room);
            }
            // ----------------------------

        } catch (err) {
            console.error("Socket send message error:", err);
        }
    });

    // Typing indicator
    socket.on("typing", ({ matchId, userId }) => {
        socket.to(String(matchId)).emit("userTyping", { userId });
    });

    socket.on("stopTyping", ({ matchId }) => {
        socket.to(String(matchId)).emit("userStoppedTyping");
    });

    socket.on("disconnect", async () => {
        const userId = socket.userId;
        if (userId) {
            const socketKey = `user:sockets:${userId}`;
            try {
                // 1. Remove this specific socket
                await redisClient.sRem(socketKey, socket.id);

                // 2. Check if anything remains BEFORE doing the expensive io.fetchSockets()
                const countAfterRem = await redisClient.sCard(socketKey);

                let liveRemaining = 0;
                if (countAfterRem > 0) {
                    // There are potentially other sockets, let's validate them
                    const remainingIds = await redisClient.sMembers(socketKey);
                    const activeSockets = await io.fetchSockets();
                    const activeIds = new Set(activeSockets.map(s => s.id));

                    for (const sid of remainingIds) {
                        if (!activeIds.has(sid)) {
                            await redisClient.sRem(socketKey, sid);
                        }
                    }
                    liveRemaining = remainingIds.filter(sid => activeIds.has(sid)).length;
                }

                console.log(`User ${userId} disconnected socket ${socket.id}. Live remaining: ${liveRemaining}`);

                if (liveRemaining === 0) {
                    // Explicitly delete the key to save memory instead of leaving an empty set
                    await redisClient.del(socketKey);

                    await User.findByIdAndUpdate(userId, {
                        isOnline: false,
                        lastActive: new Date()
                    });
                    console.log(`User ${userId} marked offline and key deleted`);
                }
            } catch (err) {
                console.error("Socket disconnect error:", err);
            }
        }
        console.log("Socket disconnected:", socket.id);
    });
});

// Export io so it can be used in routes for notifications
app.set("io", io);
app.set("redisClient", redisClient);

const PORT = process.env.PORT || 5000;
// Listen on all interfaces so physical phones on LAN can reach your machine
server.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT} (0.0.0.0)`));