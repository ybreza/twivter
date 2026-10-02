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
-- Every id below is time-sortable, exactly as `newId()` mints them in
-- `src/lib/ids.ts`: 9 base36 characters of millisecond timestamp followed by 12
-- base36 characters, for 21 characters total. The suffix is derived from the
-- row's own position rather than being random, so re-seeding is deterministic.
--
-- This is load-bearing. Every paginated query is a keyset cursor on the primary
-- key (`WHERE id < ? ORDER BY id DESC`), which is only correct if ids sort
-- chronologically. The seed used to hardcode readable ids like `n_00000000001`.
-- Because `n` sorts after `0`, those rows outranked every id the running app
-- produced, so all demo content pinned itself to the top of every feed and
-- anything the user created sank to the bottom. Never hand-write an id here.
INSERT INTO "User" (id, email, emailLower, passwordHash, username, usernameLower, displayName, bio, website, location, avatarUrl, coverUrl, role, verified, onboarded, interests, createdAt) VALUES
('0mk0xjmo00000003kni1w', 'yowanda@twivter.com', 'yowanda@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'yowanda', 'yowanda', 'Yowanda Aditya', 'Founder Twivter. believed that good technology should feel invisible. Building in public.', 'https://twivter.com', 'Jakarta, Indonesia', NULL, NULL, 'admin', 1, 1, '["Teknologi","Startup","Bisnis"]', '2026-01-05T09:00:00.000Z'),
('0mk2fnxk0000000i0v8ds', 'sara@twivter.com', 'sara@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'sara', 'sara', 'Sara Putri', 'Frontend engineer. React, TypeScript, dan garis koding yang rapi. ✨', 'https://sara.dev', 'Bandung, Indonesia', NULL, NULL, 'user', 1, 1, '["Programming","Desain","Teknologi"]', '2026-01-06T10:15:00.000Z'),
('0mk3xs8g0000000i0v8ds', 'bagus@twivter.com', 'bagus@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'bagus', 'bagus', 'Bagus Prasetyo', 'Backend & distributed systems enthusiast. Go, Rust, occasional Java.', NULL, 'Surabaya, Indonesia', NULL, NULL, 'user', 0, 1, '["Sains","Teknologi"]', '2026-01-07T11:30:00.000Z'),
('0mk5k6uw0000000i0v8ds', 'maya@twivter.com', 'maya@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'maya', 'maya', 'Maya Lestari', 'Product designer. Design systems, typography, dan obsession dengan detail.', 'https://maya.design', 'Jakarta, Indonesia', NULL, NULL, 'user', 1, 1, '["Desain","Fotografi","Seni"]', '2026-01-08T14:45:00.000Z'),
('0mk6lvlhc000000i0v8ds', 'rizki@twivter.com', 'rizki@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'rizki', 'rizki', 'Rizki Maulana', 'Streamer & content creator. Valorant ranked grind, 9 PM WIB.', NULL, 'Bali, Indonesia', NULL, NULL, 'user', 0, 1, '["Game","Musik"]', '2026-01-09T08:20:00.000Z'),
('0mk8hr0g0000000i0v8ds', 'dewi@twivter.com', 'dewi@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'dewi', 'dewi', 'Dewi Anggraini', 'Travel photographer. Flores, Raja Ampat, and everything with mountains.', 'https://dewi.photo', 'Labuan Bajo, Indonesia', NULL, NULL, 'user', 0, 1, '["Fotografi","Travel"]', '2026-01-10T16:00:00.000Z'),
('0mk9r48qo000000i0v8ds', 'arif@twivter.com', 'arif@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'arif', 'arif', 'Arif Hidayat', 'Founder, twice exited. Now building tools for small businesses.', NULL, 'Yogyakarta, Indonesia', NULL, NULL, 'user', 0, 1, '["Bisnis","Startup"]', '2026-01-11T13:10:00.000Z'),
('0mkazy6lc000000i0v8ds', 'nina@twivter.com', 'nina@twivter.com', '$2b$10$e3chccMlSGM5DapegDKrgOpBNmhQveUEbmWIPUAav46A/GZu88.D2', 'nina', 'nina', 'Nina Kusuma', 'Illustrator. Commissions open. Portrait & editorial.', 'https://ninadraws.id', 'Semarang, Indonesia', NULL, NULL, 'user', 0, 1, '["Seni","Sastra","Fotografi"]', '2026-01-12T10:05:00.000Z');

-- ── Follow graph ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO "Follow" (id, followerId, followingId, createdAt) VALUES
('0ml3ifmo0000000i0v8ds', '0mk2fnxk0000000i0v8ds', '0mk0xjmo00000003kni1w', '2026-02-01T09:00:00.000Z'),
('0ml3igwyo000001kfs0jp', '0mk3xs8g0000000i0v8ds', '0mk0xjmo00000003kni1w', '2026-02-01T09:01:00.000Z'),
('0ml3ii79c000001730tph', '0mk5k6uw0000000i0v8ds', '0mk0xjmo00000003kni1w', '2026-02-01T09:02:00.000Z'),
('0ml3ijhk00000011gmgb0', '0mk6lvlhc000000i0v8ds', '0mk0xjmo00000003kni1w', '2026-02-01T09:03:00.000Z'),
('0ml3ikruo000001cl648h', '0mk8hr0g0000000i0v8ds', '0mk0xjmo00000003kni1w', '2026-02-01T09:04:00.000Z'),
('0ml3im25c0000019y7mlm', '0mk9r48qo000000i0v8ds', '0mk0xjmo00000003kni1w', '2026-02-01T09:05:00.000Z'),
('0ml3incg0000000tqgohx', '0mkazy6lc000000i0v8ds', '0mk0xjmo00000003kni1w', '2026-02-01T09:06:00.000Z'),
('0ml3ishmo000001g5cex2', '0mk0xjmo00000003kni1w', '0mk2fnxk0000000i0v8ds', '2026-02-01T09:10:00.000Z'),
('0ml3itrxc000001nzkm84', '0mk0xjmo00000003kni1w', '0mk5k6uw0000000i0v8ds', '2026-02-01T09:11:00.000Z'),
('0ml3iv280000001abei39', '0mk0xjmo00000003kni1w', '0mk9r48qo000000i0v8ds', '2026-02-01T09:12:00.000Z'),
('0ml3j5clc000000clmz53', '0mk2fnxk0000000i0v8ds', '0mk5k6uw0000000i0v8ds', '2026-02-01T09:20:00.000Z'),
('0ml3j6mw0000001j4qtz3', '0mk5k6uw0000000i0v8ds', '0mk2fnxk0000000i0v8ds', '2026-02-01T09:21:00.000Z'),
('0ml3j7x6o000000l1kaed', '0mk3xs8g0000000i0v8ds', '0mk2fnxk0000000i0v8ds', '2026-02-01T09:22:00.000Z'),
('0ml3ji7k0000001eyica5', '0mk6lvlhc000000i0v8ds', '0mkazy6lc000000i0v8ds', '2026-02-01T09:30:00.000Z'),
('0ml3jjhuo0000016p4e0k', '0mkazy6lc000000i0v8ds', '0mk6lvlhc000000i0v8ds', '2026-02-01T09:31:00.000Z'),
('0ml3jv2io000000pm527f', '0mk8hr0g0000000i0v8ds', '0mk5k6uw0000000i0v8ds', '2026-02-01T09:40:00.000Z'),
('0ml3jwctc0000019ytoav', '0mk9r48qo000000i0v8ds', '0mk3xs8g0000000i0v8ds', '2026-02-01T09:41:00.000Z'),
('0ml3jxn400000003tw8u1', '0mk3xs8g0000000i0v8ds', '0mk9r48qo000000i0v8ds', '2026-02-01T09:42:00.000Z');

-- ── Posts ────────────────────────────────────────────────────────────────────
INSERT INTO "Post" (id, authorId, content, replyToId, quotePostId, createdAt) VALUES
('0mlgd7v6o000000i0v8ds', '0mk0xjmo00000003kni1w', 'Selamat datang di Twivter! 🎉 Tempat baru untuk terhubung, berbagi, dan menemukan hal-hal menarik. Sekarang berjalan sepenuhnya di atas Cloudflare: D1 untuk database, R2 untuk media. Coba bikin post pertama kamu sekarang!', NULL, NULL, '2026-02-10T08:55:00.000Z'),
('0mlgc5aao000001kfs0jp', '0mk0xjmo00000003kni1w', 'Kami percaya social media seharusnya terbuka, cepat, dan manusiawi. Tidak ada algoritma yang aneh-aneh. Feed kamu = postingan orang yang kamu follow, urutan waktu. Gitu aja. 🌱', NULL, NULL, '2026-02-10T08:25:00.000Z'),
('0mlgcyv40000001730tph', '0mk2fnxk0000000i0v8ds', 'Baru aja migrate project ke Next.js 16. App Router + React Server Components beneran game changer. Latency turun drastis, DX naik 10x. Recommended! ⚡ #NextJS', NULL, NULL, '2026-02-10T08:48:00.000Z'),
('0mlga6k000000011gmgb0', '0mk2fnxk0000000i0v8ds', 'Tips frontend: kalau state management kamu mulai ribet, kemungkinan besar kamu simpan state yang seharusnya di server. Pindah ke React Query atau server components. Hidupmu jadi lebih tenang. 🧘 #Programming', NULL, NULL, '2026-02-10T07:30:00.000Z'),
('0mlgbpuqo000001cl648h', '0mk3xs8g0000000i0v8ds', 'Hari ini belajar distributed tracing pake OpenTelemetry. Mind blown how powerful ini buat debug microservices. Next project wajib implement. 🕵️ #Sains', NULL, NULL, '2026-02-10T08:13:00.000Z'),
('0mlgcm05c0000019y7mlm', '0mk5k6uw0000000i0v8ds', 'Design system itu bukan cuma komponen UI. Itu cara tim berpikir tentang konsistensi, aksesibilitas, dan scale. Mulai dari token, bukan dari button. 🎨 #Desain', NULL, NULL, '2026-02-10T08:38:00.000Z'),
('0mlg6ytc0000000tqgohx', '0mk5k6uw0000000i0v8ds', 'Hot take: kebanyakan produk gagal bukan karena jelek, tapi karena tidak manusiawi. Empathy > features. Always. 💜', NULL, NULL, '2026-02-10T06:00:00.000Z'),
('0mlgd40ao000001g5cex2', '0mk6lvlhc000000i0v8ds', 'Live malam ini main Valorant! Ranked grind ke Immortal. Yuk nonton, ngobrol, dan ketawa bareng. 9 PM WIB sharp. 🎮🔥 #Game', NULL, NULL, '2026-02-10T08:52:00.000Z'),
('0mlgb94w0000001nzkm84', '0mk8hr0g0000000i0v8ds', 'Selamat pagi dari Pulau Padar 🌅 Kalau kamu belum pernah ke Flores, tambahin ke bucket list sekarang. Foto ini nggak pakai filter, segitu indahnya.', NULL, NULL, '2026-02-10T08:00:00.000Z'),
('0mlg4tnk0000001abei39', '0mk9r48qo000000i0v8ds', 'Untuk founder muda: jangan terjebak raise funding demi raise funding. Build produk yang dipakai orang, duit akan ngikuti. Saya belajar ini cara keras. 💼 #Startup', NULL, NULL, '2026-02-10T05:00:00.000Z'),
('0mlg43xmo000000clmz53', '0mk9r48qo000000i0v8ds', 'Crypto bukan investasi, crypto adalah teknologi. Pelajari underlying-nya, bukan harganya. 👀 #Crypto', NULL, NULL, '2026-02-10T04:40:00.000Z'),
('0mlgcv080000001j4qtz3', '0mkazy6lc000000i0v8ds', 'Komisi ilustrasi portrait dibuka! Slot terbatas 5 orang bulan ini. DM aja kalau berminat. Contoh hasil di profile. 🎨✨ #Seni', NULL, NULL, '2026-02-10T08:45:00.000Z'),
('0mlgdafs0000000l1kaed', '0mk0xjmo00000003kni1w', 'Q: Apa fitur Twivter yang paling kamu tunggu? Aku pribadi nunggu Communities + DM realtime. Komen di bawah 👇', NULL, NULL, '2026-02-10T08:57:00.000Z'),
-- Replies (comments are Post rows with replyToId set).
('0mlgdfkyo000001eyica5', '0mk2fnxk0000000i0v8ds', 'Komunitas dulu deh, baru DM realtime. Ruang diskusi yang publik itu susah dicari sekarang.', '0mlgdafs0000000l1kaed', NULL, '2026-02-10T09:01:00.000Z'),
('0mlgdjfuo0000016p4e0k', '0mk5k6uw0000000i0v8ds', 'Yang bikin beda tuh feed-nya chronological. Gak ada algoritma yang bikin capek.', '0mlgdafs0000000l1kaed', NULL, '2026-02-10T09:04:00.000Z'),
('0mlgdol1c000000pm527f', '0mk9r48qo000000i0v8ds', 'Setuju. Tapi yang paling penting itu kecepatan dan tidak ada iklan nyusel.', '0mlgdafs0000000l1kaed', NULL, '2026-02-10T09:08:00.000Z');

INSERT INTO "PostMedia" (id, postId, url, type, ord) VALUES
('0mlgb94w0000000i0v8ds', '0mlgb94w0000001nzkm84', 'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=1200', 'image', 0);

-- ── Interactions ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO "Like" (id, postId, userId, createdAt) VALUES
('0mlgdeao0000000i0v8ds', '0mlgd7v6o000000i0v8ds', '0mk2fnxk0000000i0v8ds', '2026-02-10T09:00:00.000Z'),
('0mlgdextc000001kfs0jp', '0mlgd7v6o000000i0v8ds', '0mk5k6uw0000000i0v8ds', '2026-02-10T09:00:30.000Z'),
('0mlgdfkyo000001730tph', '0mlgd7v6o000000i0v8ds', '0mk3xs8g0000000i0v8ds', '2026-02-10T09:01:00.000Z'),
('0mlgdgv9c0000011gmgb0', '0mlgd7v6o000000i0v8ds', '0mk9r48qo000000i0v8ds', '2026-02-10T09:02:00.000Z'),
('0mlgd1fpc000001cl648h', '0mlgcyv40000001730tph', '0mk0xjmo00000003kni1w', '2026-02-10T08:50:00.000Z'),
('0mlgd2q000000019y7mlm', '0mlgcyv40000001730tph', '0mk5k6uw0000000i0v8ds', '2026-02-10T08:51:00.000Z'),
('0mlgbyutc000000tqgohx', '0mlgbpuqo000001cl648h', '0mk0xjmo00000003kni1w', '2026-02-10T08:20:00.000Z'),
('0mlgcokqo000001g5cex2', '0mlgcm05c0000019y7mlm', '0mk2fnxk0000000i0v8ds', '2026-02-10T08:40:00.000Z'),
('0mlgbfkdc000001nzkm84', '0mlgb94w0000001nzkm84', '0mk0xjmo00000003kni1w', '2026-02-10T08:05:00.000Z'),
('0mlgcwaio000001abei39', '0mlgcv080000001j4qtz3', '0mk5k6uw0000000i0v8ds', '2026-02-10T08:46:00.000Z'),
('0mlgdbq2o000000clmz53', '0mlgdafs0000000l1kaed', '0mk2fnxk0000000i0v8ds', '2026-02-10T08:58:00.000Z'),
('0mlgdd0dc000001j4qtz3', '0mlgdafs0000000l1kaed', '0mk5k6uw0000000i0v8ds', '2026-02-10T08:59:00.000Z'),
('0mlgdeao0000000l1kaed', '0mlgdafs0000000l1kaed', '0mk9r48qo000000i0v8ds', '2026-02-10T09:00:00.000Z'),
('0mlgd5alc000001eyica5', '0mlgd40ao000001g5cex2', '0mk0xjmo00000003kni1w', '2026-02-10T08:53:00.000Z'),
('0mlgcbps00000016p4e0k', '0mlgc5aao000001kfs0jp', '0mk2fnxk0000000i0v8ds', '2026-02-10T08:30:00.000Z');

INSERT OR IGNORE INTO "Repost" (id, postId, userId, createdAt) VALUES
('0mlgdi5k0000000i0v8ds', '0mlgd7v6o000000i0v8ds', '0mk9r48qo000000i0v8ds', '2026-02-10T09:03:00.000Z'),
('0mlgdkq5c000001kfs0jp', '0mlgd7v6o000000i0v8ds', '0mkazy6lc000000i0v8ds', '2026-02-10T09:05:00.000Z'),
('0mlgd40ao000001730tph', '0mlgcyv40000001730tph', '0mk3xs8g0000000i0v8ds', '2026-02-10T08:52:00.000Z'),
('0mlgdeao00000011gmgb0', '0mlgdafs0000000l1kaed', '0mk5k6uw0000000i0v8ds', '2026-02-10T09:00:00.000Z');

INSERT OR IGNORE INTO "Bookmark" (id, postId, userId, createdAt) VALUES
('0mlgcv080000000i0v8ds', '0mlgcm05c0000019y7mlm', '0mk0xjmo00000003kni1w', '2026-02-10T08:45:00.000Z'),
('0mlgbguo0000001kfs0jp', '0mlgb94w0000001nzkm84', '0mk0xjmo00000003kni1w', '2026-02-10T08:06:00.000Z'),
('0mlgaczhc000001730tph', '0mlga6k000000011gmgb0', '0mk2fnxk0000000i0v8ds', '2026-02-10T07:35:00.000Z');

-- ── Notifications ────────────────────────────────────────────────────────────
INSERT INTO "Notification" (id, userId, actorId, type, postId, read, createdAt) VALUES
('0mlgdeao0000000i0v8ds', '0mk0xjmo00000003kni1w', '0mk2fnxk0000000i0v8ds', 'like', '0mlgd7v6o000000i0v8ds', 0, '2026-02-10T09:00:00.000Z'),
('0mlgdextc000001kfs0jp', '0mk0xjmo00000003kni1w', '0mk5k6uw0000000i0v8ds', 'like', '0mlgd7v6o000000i0v8ds', 0, '2026-02-10T09:00:30.000Z'),
('0mlgdi5k0000001730tph', '0mk0xjmo00000003kni1w', '0mk3xs8g0000000i0v8ds', 'repost', '0mlgd7v6o000000i0v8ds', 0, '2026-02-10T09:03:00.000Z'),
('0mlgdfkyo0000011gmgb0', '0mk0xjmo00000003kni1w', '0mk2fnxk0000000i0v8ds', 'comment', '0mlgdafs0000000l1kaed', 0, '2026-02-10T09:01:00.000Z'),
('0mlgdjfuo000001cl648h', '0mk0xjmo00000003kni1w', '0mk5k6uw0000000i0v8ds', 'comment', '0mlgdafs0000000l1kaed', 0, '2026-02-10T09:04:00.000Z'),
('0mlgdol1c0000019y7mlm', '0mk0xjmo00000003kni1w', '0mk9r48qo000000i0v8ds', 'comment', '0mlgdafs0000000l1kaed', 0, '2026-02-10T09:08:00.000Z'),
('0ml3ijhk0000000tqgohx', '0mk0xjmo00000003kni1w', '0mk6lvlhc000000i0v8ds', 'follow', NULL, 1, '2026-02-01T09:03:00.000Z'),
('0mlgdr5mo000001g5cex2', '0mk2fnxk0000000i0v8ds', '0mk0xjmo00000003kni1w', 'repost', '0mlga6k000000011gmgb0', 0, '2026-02-10T09:10:00.000Z'),
('0mlgdsfxc000001nzkm84', '0mk2fnxk0000000i0v8ds', '0mk0xjmo00000003kni1w', 'like', '0mlga6k000000011gmgb0', 0, '2026-02-10T09:11:00.000Z');

-- ── Communities ──────────────────────────────────────────────────────────────
INSERT INTO "Community" (id, name, slug, slugLower, description, coverUrl, ownerId, createdAt) VALUES
('0ml3kksg0000000i0v8ds', 'Twivter Builders', 'twivter-builders', 'twivter-builders', 'Tempat para builder ngobrolin cara bikin produk digital yang masuk akal. Share project, share failure, share belajar.', NULL, '0mk0xjmo00000003kni1w', '2026-02-01T10:00:00.000Z'),
('0ml525sw0000001kfs0jp', 'Desain Indonesia', 'desain-indonesia', 'desain-indonesia', 'Komunitas desainer Indonesia. Kritik konstruktif, resource, dan diskusi soal tipografi, warna, dan UX.', NULL, '0mk5k6uw0000000i0v8ds', '2026-02-02T11:00:00.000Z'),
('0ml6jqtc0000001730tph', 'Gamer Indonesia', 'gamer-indonesia', 'gamer-indonesia', 'Diskusi game, build setup, dan tempat poop bareng kalo rank jelek.', NULL, '0mk6lvlhc000000i0v8ds', '2026-02-03T12:00:00.000Z'),
('0ml81bts00000011gmgb0', 'Founder Diskusi', 'founder-diskusi', 'founder-diskusi', 'Bangun produk, jangan cuma chase funding. Bangun, jualan, iterasi.', NULL, '0mk9r48qo000000i0v8ds', '2026-02-04T13:00:00.000Z');

INSERT OR IGNORE INTO "CommunityMember" (id, communityId, userId, role, joinedAt) VALUES
('0ml3kksg0000000i0v8ds', '0ml3kksg0000000i0v8ds', '0mk0xjmo00000003kni1w', 'owner', '2026-02-01T10:00:00.000Z'),
('0ml3kr7xc000001kfs0jp', '0ml3kksg0000000i0v8ds', '0mk2fnxk0000000i0v8ds', 'admin', '2026-02-01T10:05:00.000Z'),
('0ml3kxneo000001730tph', '0ml3kksg0000000i0v8ds', '0mk3xs8g0000000i0v8ds', 'member', '2026-02-01T10:10:00.000Z'),
('0ml3l42w00000011gmgb0', '0ml3kksg0000000i0v8ds', '0mk5k6uw0000000i0v8ds', 'member', '2026-02-01T10:15:00.000Z'),
('0ml3laidc000001cl648h', '0ml3kksg0000000i0v8ds', '0mk9r48qo000000i0v8ds', 'member', '2026-02-01T10:20:00.000Z'),
('0ml525sw00000019y7mlm', '0ml525sw0000001kfs0jp', '0mk5k6uw0000000i0v8ds', 'owner', '2026-02-02T11:00:00.000Z'),
('0ml52c8dc000000tqgohx', '0ml525sw0000001kfs0jp', '0mk2fnxk0000000i0v8ds', 'member', '2026-02-02T11:05:00.000Z'),
('0ml52inuo000001g5cex2', '0ml525sw0000001kfs0jp', '0mkazy6lc000000i0v8ds', 'member', '2026-02-02T11:10:00.000Z'),
('0ml6jqtc0000001nzkm84', '0ml6jqtc0000001730tph', '0mk6lvlhc000000i0v8ds', 'owner', '2026-02-03T12:00:00.000Z'),
('0ml6jx8tc000001abei39', '0ml6jqtc0000001730tph', '0mk3xs8g0000000i0v8ds', 'member', '2026-02-03T12:05:00.000Z'),
('0ml81bts0000000clmz53', '0ml81bts00000011gmgb0', '0mk9r48qo000000i0v8ds', 'owner', '2026-02-04T13:00:00.000Z'),
('0ml81i99c000001j4qtz3', '0ml81bts00000011gmgb0', '0mk0xjmo00000003kni1w', 'member', '2026-02-04T13:05:00.000Z');

-- ── Conversations & messages ─────────────────────────────────────────────────
INSERT INTO "Conversation" (id, type, name, dmKey, createdAt, updatedAt) VALUES
('0ml9871c0000000i0v8ds', 'private', NULL, 'u_arif______01:u_yowanda0001', '2026-02-05T09:00:00.000Z', '2026-02-10T09:20:00.000Z'),
('0ml98jwao000001kfs0jp', 'private', NULL, 'u_sara______01:u_yowanda0001', '2026-02-05T09:10:00.000Z', '2026-02-10T09:15:00.000Z'),
('0ml98wr9c000001730tph', 'group', 'Tim Twivter', NULL, '2026-02-05T09:20:00.000Z', '2026-02-10T09:25:00.000Z');

INSERT OR IGNORE INTO "ConversationMember" (id, conversationId, userId, lastReadAt, joinedAt) VALUES
('0mlge40lc000000i0v8ds', '0ml9871c0000000i0v8ds', '0mk0xjmo00000003kni1w', '2026-02-10T09:20:00.000Z', '2026-02-05T09:00:00.000Z'),
('0mlge2qao000001kfs0jp', '0ml9871c0000000i0v8ds', '0mk9r48qo000000i0v8ds', '2026-02-10T09:19:00.000Z', '2026-02-05T09:00:00.000Z'),
('0mlgdxl40000001730tph', '0ml98jwao000001kfs0jp', '0mk0xjmo00000003kni1w', '2026-02-10T09:15:00.000Z', '2026-02-05T09:10:00.000Z'),
('0mlgdwatc0000011gmgb0', '0ml98jwao000001kfs0jp', '0mk2fnxk0000000i0v8ds', '2026-02-10T09:14:00.000Z', '2026-02-05T09:10:00.000Z'),
('0mlgeag2o000001cl648h', '0ml98wr9c000001730tph', '0mk0xjmo00000003kni1w', '2026-02-10T09:25:00.000Z', '2026-02-05T09:20:00.000Z'),
('0mlge95s00000019y7mlm', '0ml98wr9c000001730tph', '0mk2fnxk0000000i0v8ds', '2026-02-10T09:24:00.000Z', '2026-02-05T09:20:00.000Z'),
('0mlge7vhc000000tqgohx', '0ml98wr9c000001730tph', '0mk9r48qo000000i0v8ds', '2026-02-10T09:23:00.000Z', '2026-02-05T09:20:00.000Z');

INSERT INTO "Message" (id, conversationId, senderId, content, createdAt) VALUES
('0mlgdr5mo000000i0v8ds', '0ml9871c0000000i0v8ds', '0mk9r48qo000000i0v8ds', 'Bro, migrasi ke Cloudflare udah kelar belum? Aku excited liat hasilnya.', '2026-02-10T09:10:00.000Z'),
('0mlgdxl40000001kfs0jp', '0ml9871c0000000i0v8ds', '0mk0xjmo00000003kni1w', 'Udah! D1 buat database, R2 buat media..pages.dev kamu udah bisa dicoba.', '2026-02-10T09:15:00.000Z'),
('0mlge40lc000001730tph', '0ml9871c0000000i0v8ds', '0mk9r48qo000000i0v8ds', 'Mantap. Kirim link-nya dong biar aku bookmark.', '2026-02-10T09:20:00.000Z'),
('0mlgdkq5c0000011gmgb0', '0ml98jwao000001kfs0jp', '0mk2fnxk0000000i0v8ds', 'Halo! Compose post kamu udah bisa attach gambar lagi belum?', '2026-02-10T09:05:00.000Z'),
('0mlgdr5mo000001cl648h', '0ml98jwao000001kfs0jp', '0mk0xjmo00000003kni1w', 'Bisa. Sekarang kompres happening di browser, jadi jauh lebih ringan.', '2026-02-10T09:10:00.000Z'),
('0mlgdxl400000019y7mlm', '0ml98jwao000001kfs0jp', '0mk2fnxk0000000i0v8ds', 'Keren, sekaligus hemat bandwidth server.', '2026-02-10T09:15:00.000Z'),
('0mlgcbps0000000tqgohx', '0ml98wr9c000001730tph', '0mk0xjmo00000003kni1w', 'Selamat pagi tim! Aku push migration D1 semalam, tolong cek kalau ada yang error.', '2026-02-10T08:30:00.000Z'),
('0mlgcv080000001g5cex2', '0ml98wr9c000001730tph', '0mk2fnxk0000000i0v8ds', 'Udah aku coba, semua route jalan. Nggak ada 500 lagi. 🎉', '2026-02-10T08:45:00.000Z'),
('0mlgeag2o000001nzkm84', '0ml98wr9c000001730tph', '0mk9r48qo000000i0v8ds', 'Bagus. Aku pull latestnya malem ya, meeting jam 9.', '2026-02-10T09:25:00.000Z');

-- ── Moderation ───────────────────────────────────────────────────────────────
INSERT INTO "Report" (id, reporterId, targetUserId, targetPostId, targetType, reason, status, createdAt) VALUES
('0mlf4dxc0000000i0v8ds', '0mkazy6lc000000i0v8ds', '0mk3xs8g0000000i0v8ds', NULL, 'user', 'Spam komentar berulang di beberapa thread. Mohon ditinjau.', 'pending', '2026-02-09T12:00:00.000Z'),
('0mlf9qts0000001kfs0jp', '0mk5k6uw0000000i0v8ds', '0mk6lvlhc000000i0v8ds', '0mlgd40ao000001g5cex2', 'post', 'Konten promosi berlebihan dan tidak relevan dengan tema komunitas.', 'pending', '2026-02-09T14:30:00.000Z');

INSERT INTO "Verification" (id, userId, reason, status, note, createdAt) VALUES
('0mldknr40000000i0v8ds', '0mkazy6lc000000i0v8ds', 'Saya ilustrator independen dengan 8 tahun pengalaman, portofolio sudah konsisten dan aktif. Ingin verifikasi agar kredibilitas meningkat.', 'pending', NULL, '2026-02-08T10:00:00.000Z'),
('0mldnvhs0000001kfs0jp', '0mk8hr0g0000000i0v8ds', 'Saya fotografer perjalanan profesional. Portofolio sudah dipakai beberapa majalah dan klien rutin mem-booking sesi foto bersama saya setiap bulan.', 'pending', NULL, '2026-02-08T11:30:00.000Z');

PRAGMA foreign_keys = ON;