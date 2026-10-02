/**
 * Seeds a D1 database with demo data.
 *
 * Runs entirely through `wrangler d1 execute --file`, so it works against the
 * local emulator and against the real database with no Node/Bun dependencies and
 * no Prisma.
 *
 *   Local:  npm run db:seed
 *   Remote: npm run db:seed:remote
 *
 * Demo login: yowanda@twivter.com / password123
 *
 * Password hashes below are bcrypt (cost 10) of `password123`.
 * Regenerate with: node scripts/gen-hash.cjs password123
 */

PRAGMA foreign_keys = OFF;

-- ── Reset ────────────────────────────────────────────────────────────────────
DELETE FROM "Message";
DELETE FROM "ConversationMember";
DELETE FROM "Conversation";
DELETE FROM "Notification";
DELETE FROM "Report";
DELETE FROM "Verification";
DELETE FROM "Bookmark";
DELETE FROM "Repost";
DELETE FROM "Like";
DELETE FROM "PostMedia";
DELETE FROM "Post";
DELETE FROM "CommunityMember";
DELETE FROM "Community";
DELETE FROM "Follow";
DELETE FROM "Session";
DELETE FROM "User";

-- ── Users ────────────────────────────────────────────────────────────────────
-- Ids are time-sortable: 9 base36 chars of ms timestamp + 12 random chars.
INSERT INTO "User" (id, email, emailLower, passwordHash, username, usernameLower, displayName, bio, website, location, avatarUrl, coverUrl, role, verified, onboarded, interests, createdAt) VALUES
('u_yowanda0001', 'yowanda@twivter.com', 'yowanda@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'yowanda', 'yowanda', 'Yowanda Aditya', 'Founder Twivter. believed that good technology should feel invisible. Building in public.', 'twivter.com', 'Jakarta, Indonesia', NULL, NULL, 'admin', 1, 1, '["Teknologi","Startup","Bisnis"]', '2026-01-05T09:00:00.000Z'),
('u_sara______01', 'sara@twivter.com', 'sara@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'sara', 'sara', 'Sara Putri', 'Frontend engineer. React, TypeScript, dan garis koding yang rapi. ✨', 'sara.dev', 'Bandung, Indonesia', NULL, NULL, 'user', 1, 1, '["Programming","Desain","Teknologi"]', '2026-01-06T10:15:00.000Z'),
('u_bagus_____01', 'bagus@twivter.com', 'bagus@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'bagus', 'bagus', 'Bagus Prasetyo', 'Backend & distributed systems enthusiast. Go, Rust, occasional Java.', NULL, 'Surabaya, Indonesia', NULL, NULL, 'user', 0, 1, '["Sains","Teknologi"]', '2026-01-07T11:30:00.000Z'),
('u_maya______01', 'maya@twivter.com', 'maya@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'maya', 'maya', 'Maya Lestari', 'Product designer. Design systems, typography, dan obsession dengan detail.', 'maya.design', 'Jakarta, Indonesia', NULL, NULL, 'user', 1, 1, '["Desain","Fotografi","Seni"]', '2026-01-08T14:45:00.000Z'),
('u_rizki_____01', 'rizki@twivter.com', 'rizki@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'rizki', 'rizki', 'Rizki Maulana', 'Streamer & content creator. Valorant ranked grind, 9 PM WIB.', NULL, 'Bali, Indonesia', NULL, NULL, 'user', 0, 1, '["Game","Musik"]', '2026-01-09T08:20:00.000Z'),
('u_dewi______01', 'dewi@twivter.com', 'dewi@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'dewi', 'dewi', 'Dewi Anggraini', 'Travel photographer. Flores, Raja Ampat, and everything with mountains.', 'dewi.photo', 'Labuan Bajo, Indonesia', NULL, NULL, 'user', 0, 1, '["Fotografi","Travel"]', '2026-01-10T16:00:00.000Z'),
('u_arif______01', 'arif@twivter.com', 'arif@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'arif', 'arif', 'Arif Hidayat', 'Founder, twice exited. Now building tools for small businesses.', NULL, 'Yogyakarta, Indonesia', NULL, NULL, 'user', 0, 1, '["Bisnis","Startup"]', '2026-01-11T13:10:00.000Z'),
('u_nina______01', 'nina@twivter.com', 'nina@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'nina', 'nina', 'Nina Kusuma', 'Illustrator. Commissions open. Portrait & editorial.', 'ninadraws.id', 'Semarang, Indonesia', NULL, NULL, 'user', 0, 1, '["Seni","Sastra","Fotografi"]', '2026-01-12T10:05:00.000Z');

-- ── Follow graph ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO "Follow" (id, followerId, followingId, createdAt) VALUES
('f_00000000001', 'u_sara______01', 'u_yowanda0001', '2026-02-01T09:00:00.000Z'),
('f_00000000002', 'u_bagus_____01', 'u_yowanda0001', '2026-02-01T09:01:00.000Z'),
('f_00000000003', 'u_maya______01', 'u_yowanda0001', '2026-02-01T09:02:00.000Z'),
('f_00000000004', 'u_rizki_____01', 'u_yowanda0001', '2026-02-01T09:03:00.000Z'),
('f_00000000005', 'u_dewi______01', 'u_yowanda0001', '2026-02-01T09:04:00.000Z'),
('f_00000000006', 'u_arif______01', 'u_yowanda0001', '2026-02-01T09:05:00.000Z'),
('f_00000000007', 'u_nina______01', 'u_yowanda0001', '2026-02-01T09:06:00.000Z'),
('f_00000000008', 'u_yowanda0001', 'u_sara______01', '2026-02-01T09:10:00.000Z'),
('f_00000000009', 'u_yowanda0001', 'u_maya______01', '2026-02-01T09:11:00.000Z'),
('f_00000000010', 'u_yowanda0001', 'u_arif______01', '2026-02-01T09:12:00.000Z'),
('f_00000000011', 'u_sara______01', 'u_maya______01', '2026-02-01T09:20:00.000Z'),
('f_00000000012', 'u_maya______01', 'u_sara______01', '2026-02-01T09:21:00.000Z'),
('f_00000000013', 'u_bagus_____01', 'u_sara______01', '2026-02-01T09:22:00.000Z'),
('f_00000000014', 'u_rizki_____01', 'u_nina______01', '2026-02-01T09:30:00.000Z'),
('f_00000000015', 'u_nina______01', 'u_rizki_____01', '2026-02-01T09:31:00.000Z'),
('f_00000000016', 'u_dewi______01', 'u_maya______01', '2026-02-01T09:40:00.000Z'),
('f_00000000017', 'u_arif______01', 'u_bagus_____01', '2026-02-01T09:41:00.000Z'),
('f_00000000018', 'u_bagus_____01', 'u_arif______01', '2026-02-01T09:42:00.000Z');

-- ── Posts ────────────────────────────────────────────────────────────────────
INSERT INTO "Post" (id, authorId, content, replyToId, quotePostId, createdAt) VALUES
('p_00000000001', 'u_yowanda0001', 'Selamat datang di Twivter! 🎉 Tempat baru untuk terhubung, berbagi, dan menemukan hal-hal menarik. Sekarang berjalan sepenuhnya di atas Cloudflare: D1 untuk database, R2 untuk media. Coba bikin post pertama kamu sekarang!', NULL, NULL, '2026-02-10T08:55:00.000Z'),
('p_00000000002', 'u_yowanda0001', 'Kami percaya social media seharusnya terbuka, cepat, dan manusiawi. Tidak ada algoritma yang aneh-aneh. Feed kamu = postingan orang yang kamu follow, urutan waktu. Gitu aja. 🌱', NULL, NULL, '2026-02-10T08:25:00.000Z'),
('p_00000000003', 'u_sara______01', 'Baru aja migrate project ke Next.js 16. App Router + React Server Components beneran game changer. Latency turun drastis, DX naik 10x. Recommended! ⚡ #NextJS', NULL, NULL, '2026-02-10T08:48:00.000Z'),
('p_00000000004', 'u_sara______01', 'Tips frontend: kalau state management kamu mulai ribet, kemungkinan besar kamu simpan state yang seharusnya di server. Pindah ke React Query atau server components. Hidupmu jadi lebih tenang. 🧘 #Programming', NULL, NULL, '2026-02-10T07:30:00.000Z'),
('p_00000000005', 'u_bagus_____01', 'Hari ini belajar distributed tracing pake OpenTelemetry. Mind blown how powerful ini buat debug microservices. Next project wajib implement. 🕵️ #Sains', NULL, NULL, '2026-02-10T08:13:00.000Z'),
('p_00000000006', 'u_maya______01', 'Design system itu bukan cuma komponen UI. Itu cara tim berpikir tentang konsistensi, aksesibilitas, dan scale. Mulai dari token, bukan dari button. 🎨 #Desain', NULL, NULL, '2026-02-10T08:38:00.000Z'),
('p_00000000007', 'u_maya______01', 'Hot take: kebanyakan produk gagal bukan karena jelek, tapi karena tidak manusiawi. Empathy > features. Always. 💜', NULL, NULL, '2026-02-10T06:00:00.000Z'),
('p_00000000008', 'u_rizki_____01', 'Live malam ini main Valorant! Ranked grind ke Immortal. Yuk nonton, ngobrol, dan ketawa bareng. 9 PM WIB sharp. 🎮🔥 #Game', NULL, NULL, '2026-02-10T08:52:00.000Z'),
('p_00000000009', 'u_dewi______01', 'Selamat pagi dari Pulau Padar 🌅 Kalau kamu belum pernah ke Flores, tambahin ke bucket list sekarang. Foto ini nggak pakai filter, segitu indahnya.', NULL, NULL, '2026-02-10T08:00:00.000Z'),
('p_00000000010', 'u_arif______01', 'Untuk founder muda: jangan terjebak raise funding demi raise funding. Build produk yang dipakai orang, duit akan ngikuti. Saya belajar ini cara keras. 💼 #Startup', NULL, NULL, '2026-02-10T05:00:00.000Z'),
('p_00000000011', 'u_arif______01', 'Crypto bukan investasi, crypto adalah teknologi. Pelajari underlying-nya, bukan harganya. 👀 #Crypto', NULL, NULL, '2026-02-10T04:40:00.000Z'),
('p_00000000012', 'u_nina______01', 'Komisi ilustrasi portrait dibuka! Slot terbatas 5 orang bulan ini. DM aja kalau berminat. Contoh hasil di profile. 🎨✨ #Seni', NULL, NULL, '2026-02-10T08:45:00.000Z'),
('p_00000000013', 'u_yowanda0001', 'Q: Apa fitur Twivter yang paling kamu tunggu? Aku pribadi nunggu Communities + DM realtime. Komen di bawah 👇', NULL, NULL, '2026-02-10T08:57:00.000Z'),
-- Replies (comments are Post rows with replyToId set).
('p_00000000014', 'u_sara______01', 'Komunitas dulu deh, baru DM realtime. Ruang diskusi yang publik itu susah dicari sekarang.', 'p_00000000013', NULL, '2026-02-10T09:01:00.000Z'),
('p_00000000015', 'u_maya______01', 'Yang bikin beda tuh feed-nya chronological. Gak ada algoritma yang bikin capek.', 'p_00000000013', NULL, '2026-02-10T09:04:00.000Z'),
('p_00000000016', 'u_arif______01', 'Setuju. Tapi yang paling penting itu kecepatan dan tidak ada iklan nyusel.', 'p_00000000013', NULL, '2026-02-10T09:08:00.000Z');

INSERT INTO "PostMedia" (id, postId, url, type, ord) VALUES
('m_00000000001', 'p_00000000009', 'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=1200', 'image', 0);

-- ── Interactions ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO "Like" (id, postId, userId, createdAt) VALUES
('l_00000000001', 'p_00000000001', 'u_sara______01', '2026-02-10T09:00:00.000Z'),
('l_00000000002', 'p_00000000001', 'u_maya______01', '2026-02-10T09:00:30.000Z'),
('l_00000000003', 'p_00000000001', 'u_bagus_____01', '2026-02-10T09:01:00.000Z'),
('l_00000000004', 'p_00000000001', 'u_arif______01', '2026-02-10T09:02:00.000Z'),
('l_00000000005', 'p_00000000003', 'u_yowanda0001', '2026-02-10T08:50:00.000Z'),
('l_00000000006', 'p_00000000003', 'u_maya______01', '2026-02-10T08:51:00.000Z'),
('l_00000000007', 'p_00000000005', 'u_yowanda0001', '2026-02-10T08:20:00.000Z'),
('l_00000000008', 'p_00000000006', 'u_sara______01', '2026-02-10T08:40:00.000Z'),
('l_00000000009', 'p_00000000009', 'u_yowanda0001', '2026-02-10T08:05:00.000Z'),
('l_00000000010', 'p_00000000012', 'u_maya______01', '2026-02-10T08:46:00.000Z'),
('l_00000000011', 'p_00000000013', 'u_sara______01', '2026-02-10T08:58:00.000Z'),
('l_00000000012', 'p_00000000013', 'u_maya______01', '2026-02-10T08:59:00.000Z'),
('l_00000000013', 'p_00000000013', 'u_arif______01', '2026-02-10T09:00:00.000Z'),
('l_00000000014', 'p_00000000008', 'u_yowanda0001', '2026-02-10T08:53:00.000Z'),
('l_00000000015', 'p_00000000002', 'u_sara______01', '2026-02-10T08:30:00.000Z');

INSERT OR IGNORE INTO "Repost" (id, postId, userId, createdAt) VALUES
('r_00000000001', 'p_00000000001', 'u_arif______01', '2026-02-10T09:03:00.000Z'),
('r_00000000002', 'p_00000000001', 'u_nina______01', '2026-02-10T09:05:00.000Z'),
('r_00000000003', 'p_00000000003', 'u_bagus_____01', '2026-02-10T08:52:00.000Z'),
('r_00000000004', 'p_00000000013', 'u_maya______01', '2026-02-10T09:00:00.000Z');

INSERT OR IGNORE INTO "Bookmark" (id, postId, userId, createdAt) VALUES
('b_00000000001', 'p_00000000006', 'u_yowanda0001', '2026-02-10T08:45:00.000Z'),
('b_00000000002', 'p_00000000009', 'u_yowanda0001', '2026-02-10T08:06:00.000Z'),
('b_00000000003', 'p_00000000004', 'u_sara______01', '2026-02-10T07:35:00.000Z');

-- ── Notifications ────────────────────────────────────────────────────────────
INSERT INTO "Notification" (id, userId, actorId, type, postId, read, createdAt) VALUES
('n_00000000001', 'u_yowanda0001', 'u_sara______01', 'like', 'p_00000000001', 0, '2026-02-10T09:00:00.000Z'),
('n_00000000002', 'u_yowanda0001', 'u_maya______01', 'like', 'p_00000000001', 0, '2026-02-10T09:00:30.000Z'),
('n_00000000003', 'u_yowanda0001', 'u_bagus_____01', 'repost', 'p_00000000001', 0, '2026-02-10T09:03:00.000Z'),
('n_00000000004', 'u_yowanda0001', 'u_sara______01', 'comment', 'p_00000000013', 0, '2026-02-10T09:01:00.000Z'),
('n_00000000005', 'u_yowanda0001', 'u_maya______01', 'comment', 'p_00000000013', 0, '2026-02-10T09:04:00.000Z'),
('n_00000000006', 'u_yowanda0001', 'u_arif______01', 'comment', 'p_00000000013', 0, '2026-02-10T09:08:00.000Z'),
('n_00000000007', 'u_yowanda0001', 'u_rizki_____01', 'follow', NULL, 1, '2026-02-01T09:03:00.000Z'),
('n_00000000008', 'u_sara______01', 'u_yowanda0001', 'repost', 'p_00000000004', 0, '2026-02-10T09:10:00.000Z'),
('n_00000000009', 'u_sara______01', 'u_yowanda0001', 'like', 'p_00000000004', 0, '2026-02-10T09:11:00.000Z');

-- ── Communities ──────────────────────────────────────────────────────────────
INSERT INTO "Community" (id, name, slug, slugLower, description, coverUrl, ownerId, createdAt) VALUES
('c_00000000001', 'Twivter Builders', 'twivter-builders', 'twivter-builders', 'Tempat para builder ngobrolin cara bikin produk digital yang masuk akal. Share project, share failure, share belajar.', NULL, 'u_yowanda0001', '2026-02-01T10:00:00.000Z'),
('c_00000000002', 'Desain Indonesia', 'desain-indonesia', 'desain-indonesia', 'Komunitas desainer Indonesia. Kritik konstruktif, resource, dan diskusi soal tipografi, warna, dan UX.', NULL, 'u_maya______01', '2026-02-02T11:00:00.000Z'),
('c_00000000003', 'Gamer Indonesia', 'gamer-indonesia', 'gamer-indonesia', 'Diskusi game, build setup, dan tempat poop bareng kalo rank jelek.', NULL, 'u_rizki_____01', '2026-02-03T12:00:00.000Z'),
('c_00000000004', 'Founder Diskusi', 'founder-diskusi', 'founder-diskusi', 'Bangun produk, jangan cuma chase funding. Bangun, jualan, iterasi.', NULL, 'u_arif______01', '2026-02-04T13:00:00.000Z');

INSERT OR IGNORE INTO "CommunityMember" (id, communityId, userId, role, joinedAt) VALUES
('cm_00000000001', 'c_00000000001', 'u_yowanda0001', 'owner', '2026-02-01T10:00:00.000Z'),
('cm_00000000002', 'c_00000000001', 'u_sara______01', 'admin', '2026-02-01T10:05:00.000Z'),
('cm_00000000003', 'c_00000000001', 'u_bagus_____01', 'member', '2026-02-01T10:10:00.000Z'),
('cm_00000000004', 'c_00000000001', 'u_maya______01', 'member', '2026-02-01T10:15:00.000Z'),
('cm_00000000005', 'c_00000000001', 'u_arif______01', 'member', '2026-02-01T10:20:00.000Z'),
('cm_00000000006', 'c_00000000002', 'u_maya______01', 'owner', '2026-02-02T11:00:00.000Z'),
('cm_00000000007', 'c_00000000002', 'u_sara______01', 'member', '2026-02-02T11:05:00.000Z'),
('cm_00000000008', 'c_00000000002', 'u_nina______01', 'member', '2026-02-02T11:10:00.000Z'),
('cm_00000000009', 'c_00000000003', 'u_rizki_____01', 'owner', '2026-02-03T12:00:00.000Z'),
('cm_00000000010', 'c_00000000003', 'u_bagus_____01', 'member', '2026-02-03T12:05:00.000Z'),
('cm_00000000011', 'c_00000000004', 'u_arif______01', 'owner', '2026-02-04T13:00:00.000Z'),
('cm_00000000012', 'c_00000000004', 'u_yowanda0001', 'member', '2026-02-04T13:05:00.000Z');

-- ── Conversations & messages ─────────────────────────────────────────────────
INSERT INTO "Conversation" (id, type, name, dmKey, createdAt, updatedAt) VALUES
('v_00000000001', 'private', NULL, 'u_arif______01:u_yowanda0001', '2026-02-05T09:00:00.000Z', '2026-02-10T09:20:00.000Z'),
('v_00000000002', 'private', NULL, 'u_sara______01:u_yowanda0001', '2026-02-05T09:10:00.000Z', '2026-02-10T09:15:00.000Z'),
('v_00000000003', 'group', 'Tim Twivter', NULL, '2026-02-05T09:20:00.000Z', '2026-02-10T09:25:00.000Z');

INSERT OR IGNORE INTO "ConversationMember" (id, conversationId, userId, lastReadAt, joinedAt) VALUES
('vm_00000000001', 'v_00000000001', 'u_yowanda0001', '2026-02-10T09:20:00.000Z', '2026-02-05T09:00:00.000Z'),
('vm_00000000002', 'v_00000000001', 'u_arif______01', '2026-02-10T09:19:00.000Z', '2026-02-05T09:00:00.000Z'),
('vm_00000000003', 'v_00000000002', 'u_yowanda0001', '2026-02-10T09:15:00.000Z', '2026-02-05T09:10:00.000Z'),
('vm_00000000004', 'v_00000000002', 'u_sara______01', '2026-02-10T09:14:00.000Z', '2026-02-05T09:10:00.000Z'),
('vm_00000000005', 'v_00000000003', 'u_yowanda0001', '2026-02-10T09:25:00.000Z', '2026-02-05T09:20:00.000Z'),
('vm_00000000006', 'v_00000000003', 'u_sara______01', '2026-02-10T09:24:00.000Z', '2026-02-05T09:20:00.000Z'),
('vm_00000000007', 'v_00000000003', 'u_arif______01', '2026-02-10T09:23:00.000Z', '2026-02-05T09:20:00.000Z');

INSERT INTO "Message" (id, conversationId, senderId, content, createdAt) VALUES
('g_00000000001', 'v_00000000001', 'u_arif______01', 'Bro, migrasi ke Cloudflare udah kelar belum? Aku excited liat hasilnya.', '2026-02-10T09:10:00.000Z'),
('g_00000000002', 'v_00000000001', 'u_yowanda0001', 'Udah! D1 buat database, R2 buat media..pages.dev kamu udah bisa dicoba.', '2026-02-10T09:15:00.000Z'),
('g_00000000003', 'v_00000000001', 'u_arif______01', 'Mantap. Kirim link-nya dong biar aku bookmark.', '2026-02-10T09:20:00.000Z'),
('g_00000000004', 'v_00000000002', 'u_sara______01', 'Halo! Compose post kamu udah bisa attach gambar lagi belum?', '2026-02-10T09:05:00.000Z'),
('g_00000000005', 'v_00000000002', 'u_yowanda0001', 'Bisa. Sekarang kompres happening di browser, jadi jauh lebih ringan.', '2026-02-10T09:10:00.000Z'),
('g_00000000006', 'v_00000000002', 'u_sara______01', 'Keren, sekaligus hemat bandwidth server.', '2026-02-10T09:15:00.000Z'),
('g_00000000007', 'v_00000000003', 'u_yowanda0001', 'Selamat pagi tim! Aku push migration D1 semalam, tolong cek kalau ada yang error.', '2026-02-10T08:30:00.000Z'),
('g_00000000008', 'v_00000000003', 'u_sara______01', 'Udah aku coba, semua route jalan. Nggak ada 500 lagi. 🎉', '2026-02-10T08:45:00.000Z'),
('g_00000000009', 'v_00000000003', 'u_arif______01', 'Bagus. Aku pull latestnya malem ya, meeting jam 9.', '2026-02-10T09:25:00.000Z');

-- ── Moderation ───────────────────────────────────────────────────────────────
INSERT INTO "Report" (id, reporterId, targetUserId, targetPostId, targetType, reason, status, createdAt) VALUES
('r_00000000001', 'u_nina______01', 'u_bagus_____01', NULL, 'user', 'Spam komentar berulang di beberapa thread. Mohon ditinjau.', 'pending', '2026-02-09T12:00:00.000Z'),
('r_00000000002', 'u_maya______01', 'u_rizki_____01', 'p_00000000008', 'post', 'Konten promosi berlebihan dan tidak relevan dengan tema komunitas.', 'pending', '2026-02-09T14:30:00.000Z');

INSERT INTO "Verification" (id, userId, reason, status, note, createdAt) VALUES
('vf_00000000001', 'u_nina______01', 'Saya ilustrator independen dengan 8 tahun pengalaman, portofolio sudah konsisten dan aktif. Ingin verifikasi agar kredibilitas meningkat.', 'pending', NULL, '2026-02-08T10:00:00.000Z'),
('vf_00000000002', 'u_dewi______01', 'Saya fotografer perjalanan profesional. Portofolio sudah dipakai beberapa majalah dan klien rutin mem-booking sesi foto bersama saya setiap bulan.', 'pending', NULL, '2026-02-08T11:30:00.000Z');

PRAGMA foreign_keys = ON;