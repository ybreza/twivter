// Seed script for Twivter demo data
// Run: bun run seed
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Twivter database...')

  // Clean
  await db.message.deleteMany()
  await db.conversationMember.deleteMany()
  await db.conversation.deleteMany()
  await db.notification.deleteMany()
  await db.report.deleteMany()
  await db.verification.deleteMany()
  await db.communityMember.deleteMany()
  await db.community.deleteMany()
  await db.comment.deleteMany()
  await db.repost.deleteMany()
  await db.bookmark.deleteMany()
  await db.like.deleteMany()
  await db.postMedia.deleteMany()
  await db.post.deleteMany()
  await db.follow.deleteMany()
  await db.session.deleteMany()
  await db.user.deleteMany()

  // ── Users ────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10)

  const users = [
    { username: 'yowanda', displayName: 'Yowanda Riski', email: 'yowanda@twivter.com', role: 'admin', verified: true, bio: 'Founder @Twivter. Membangun masa depan social media. 🚀', website: 'https://twivter.com', location: 'Jakarta, ID', avatarColor: '#3B82F6', interests: ['Teknologi','AI','Bisnis','Startup'] },
    { username: 'sara_dev', displayName: 'Sara Putri', email: 'sara@twivter.com', role: 'user', verified: true, bio: 'Frontend engineer • React & Next.js enthusiast • Coffee driven dev ☕', website: 'https://sara.dev', location: 'Bandung, ID', avatarColor: '#8B5CF6', interests: ['Programming','Desain','Teknologi'] },
    { username: 'baguscode', displayName: 'Bagus Pratama', email: 'bagus@twivter.com', role: 'user', verified: false, bio: 'Backend dev @ stealth startup. Go, Rust, distributed systems.', location: 'Surabaya, ID', avatarColor: '#10B981', interests: ['Programming','Crypto','Sains'] },
    { username: 'mayaph', displayName: 'Maya Hartono', email: 'maya@twivter.com', role: 'user', verified: true, bio: 'Product designer 🎨 • Membuat produk yang manusiawi', website: 'https://maya.design', location: 'Yogyakarta, ID', avatarColor: '#F59E0B', interests: ['Desain','Fotografi','Film'] },
    { username: 'rizkigaming', displayName: 'Rizki Nugroho', email: 'rizki@twivter.com', role: 'user', verified: false, bio: 'Pro gamer & streamer. Live setiap malam!', location: 'Medan, ID', avatarColor: '#EF4444', interests: ['Game','Musik','Film'] },
    { username: 'dewi_travel', displayName: 'Dewi Lestari', email: 'dewi@twivter.com', role: 'user', verified: false, bio: 'Travel blogger 🌍 30+ negara & counting', website: 'https://dewitravels.com', location: 'Bali, ID', avatarColor: '#06B6D4', interests: ['Travel','Fotografi','Kuliner'] },
    { username: 'arif_business', displayName: 'Arif Wibowo', email: 'arif@twivter.com', role: 'user', verified: true, bio: 'CEO @ multiple startups. Investor. Mentor.', website: 'https://arif.vc', location: 'Jakarta, ID', avatarColor: '#EC4899', interests: ['Bisnis','Startup','Crypto'] },
    { username: 'nina_art', displayName: 'Nina Kusuma', email: 'nina@twivter.com', role: 'user', verified: false, bio: 'Digital artist & illustrator ✏️ Komisi terbuka!', location: 'Semarang, ID', avatarColor: '#A855F7', interests: ['Desain','Seni','Film'] },
  ]

  const createdUsers = []
  for (const u of users) {
    const user = await db.user.create({
      data: {
        email: u.email,
        passwordHash,
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        website: u.website ?? null,
        location: u.location,
        role: u.role,
        verified: u.verified,
        onboarded: true,
        interests: JSON.stringify(u.interests),
        avatarUrl: null,
      },
    })
    createdUsers.push({ ...user, _color: u.avatarColor })
  }

  const [yowanda, sara, bagus, maya, rizki, dewi, arif, nina] = createdUsers
  const followPairs: [string, string][] = [
    [sara.id, yowanda.id], [bagus.id, yowanda.id], [maya.id, yowanda.id],
    [rizki.id, yowanda.id], [dewi.id, yowanda.id], [arif.id, yowanda.id],
    [nina.id, yowanda.id],
    [yowanda.id, sara.id], [yowanda.id, maya.id], [yowanda.id, arif.id],
    [sara.id, maya.id], [maya.id, sara.id], [bagus.id, sara.id],
    [rizki.id, nina.id], [nina.id, rizki.id], [dewi.id, maya.id],
    [arif.id, bagus.id], [bagus.id, arif.id],
  ]
  for (const [followerId, followingId] of followPairs) {
    await db.follow.create({ data: { followerId, followingId } })
  }

  const now = Date.now()
  const minsAgo = (m: number) => new Date(now - m * 60_000)

  const postsData = [
    { author: yowanda, content: 'Selamat datang di Twivter! 🎉 Tempat baru untuk terhubung, berbagi, dan menemukan hal-hal menarik. Built with Next.js 16, realtime, dan cepat. Coba bikin post pertama kamu sekarang!', mins: 5 },
    { author: yowanda, content: 'Kami percaya social media seharusnya terbuka, cepat, dan manusiawi. Tidak ada algoritma yang aneh-aneh. Feed kamu = postingan orang yang kamu follow, urutan waktu. Gitu aja. 🌱', mins: 35 },
    { author: sara, content: 'Baru aja migrate project ke Next.js 16. App Router + React Server Components beneran game changer. Latency turun drastis, DX naik 10x. Recommended! ⚡ #NextJS', mins: 12 },
    { author: sara, content: 'Tips frontend: kalau state management kamu mulai ribet, kemungkinan besar kamu simpan state yang seharusnya di server. Pindah ke React Query / server components. Hidupmu jadi lebih tenang. 🧘', mins: 90 },
    { author: bagus, content: 'Hari ini belajar distributed tracing pake OpenTelemetry. Mind blown how powerful ini buat debug microservices. Next project wajib implement. 🕵️', mins: 47 },
    { author: maya, content: 'Design system itu bukan cuma komponen UI. Itu cara tim berpikir tentang konsistensi, aksesibilitas, dan scale. Mulai dari token, bukan dari button. 🎨', mins: 22 },
    { author: maya, content: 'Hot take: kebanyakan produk gagal bukan karena jelek, tapi karena tidak manusiawi. Empathy > features. Always. 💜', mins: 120 },
    { author: rizki, content: 'Live malam ini main Valorant! Ranked grind ke Immortal. Yuk nonton, ngobrol, dan ketawa bareng. 9 PM WIB sharp. 🎮🔥', mins: 8 },
    { author: dewi, content: 'Selamat pagi dari Pulau Padar 🌅 Kalau kamu belum pernah ke Flores, tambahin ke bucket list sekarang. Foto ini nggak pakai filter, segitu indahnya.', mins: 60, hasMedia: true, mediaType: 'image' },
    { author: arif, content: 'Untuk founder muda: jangan terjebak raise funding demi raise funding. Build produk yang dipakai orang, duit akan ngikuti. Saya belajar ini cara keras. 💼', mins: 180 },
    { author: arif, content: 'Crypto bukan investasi, crypto adalah teknologi. Pelajari underlying-nya, bukan harganya. 👀', mins: 200 },
    { author: nina, content: 'Komisi ilustrasi portrait dibuka! Slot terbatas 5 orang bulan ini. DM aja kalau berminat. Contoh hasil di profile. 🎨✨', mins: 15 },
    { author: yowanda, content: 'Q: Apa fitur Twivter yang paling kamu tunggu? Aku pribadi nunggu Communities + DM realtime. Komen di bawah 👇', mins: 3 },
  ]

  for (const p of postsData) {
    const post = await db.post.create({
      data: {
        authorId: p.author.id,
        content: p.content,
        createdAt: minsAgo(p.mins),
      },
    })
    if (p.hasMedia) {
      await db.postMedia.create({
        data: {
          postId: post.id,
          url: 'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=800',
          type: p.mediaType ?? 'image',
          order: 0,
        },
      })
    }
  }

  const allPosts = await db.post.findMany()
  const firstPost = allPosts[0]
  for (const u of createdUsers) {
    if (u.id !== firstPost.authorId) {
      await db.like.create({ data: { postId: firstPost.id, userId: u.id } })
    }
  }
  const mayaPosts = allPosts.filter((p) => p.authorId === maya.id)
  for (const p of mayaPosts) {
    await db.like.create({ data: { postId: p.id, userId: sara.id } })
  }
  await db.repost.create({ data: { postId: firstPost.id, userId: arif.id } })
  await db.repost.create({ data: { postId: mayaPosts[1].id, userId: yowanda.id } })

  await db.comment.create({ data: { postId: firstPost.id, userId: sara.id, content: 'Akhirnya! Udah nungguin ini lama. Mantap tim 🙌' } })
  await db.comment.create({ data: { postId: firstPost.id, userId: bagus.id, content: 'Onboarding-nya mulus banget. Good job!' } })
  await db.comment.create({ data: { postId: firstPost.id, userId: maya.id, content: 'UI-nya cakep. Coba dark mode dong 😍' } })

  for (const u of createdUsers) {
    if (u.id !== firstPost.authorId) {
      await db.notification.create({
        data: { userId: firstPost.authorId, actorId: u.id, type: 'like', postId: firstPost.id }
      })
    }
  }
  await db.notification.create({ data: { userId: yowanda.id, actorId: sara.id, type: 'comment', postId: firstPost.id } })
  await db.notification.create({ data: { userId: yowanda.id, actorId: arif.id, type: 'repost', postId: firstPost.id } })
  await db.notification.create({ data: { userId: yowanda.id, actorId: maya.id, type: 'follow' } })
  await db.notification.create({ data: { userId: yowanda.id, actorId: arif.id, type: 'follow' } })

  const communities = [
    { name: 'Next.js Indonesia', slug: 'nextjs-id', description: 'Komunitas developer Next.js Indonesia. Sharing tips, project, dan lowongan.', owner: yowanda, members: [sara, bagus, maya] },
    { name: 'UI/UX Designers', slug: 'uiux-designers', description: 'Tempat designer berkumpul, critique, dan sharing resource.', owner: maya, members: [sara, nina, dewi] },
    { name: 'Indie Hackers ID', slug: 'indie-hackers-id', description: 'Bootstrap startup. Build in public. Revenue > funding.', owner: arif, members: [yowanda, bagus] },
    { name: 'Gaming Lounge', slug: 'gaming-lounge', description: 'Semua tentang game. Esports, review, dan sesi main bareng.', owner: rizki, members: [nina, bagus] },
  ]

  for (const c of communities) {
    const community = await db.community.create({
      data: { name: c.name, slug: c.slug, description: c.description, ownerId: c.owner.id, coverUrl: null },
    })
    await db.communityMember.create({ data: { communityId: community.id, userId: c.owner.id, role: 'owner' } })
    for (const m of c.members) {
      await db.communityMember.create({ data: { communityId: community.id, userId: m.id, role: 'member' } })
    }
  }

  const conv1 = await db.conversation.create({ data: { type: 'private' } })
  await db.conversationMember.create({ data: { conversationId: conv1.id, userId: yowanda.id } })
  await db.conversationMember.create({ data: { conversationId: conv1.id, userId: sara.id } })
  await db.message.create({ data: { conversationId: conv1.id, senderId: sara.id, content: 'Hai Yowanda! Kerja bagus di Twivter 🙌', createdAt: minsAgo(10) } })
  await db.message.create({ data: { conversationId: conv1.id, senderId: yowanda.id, content: 'Makasih Sara! Kamu yang design system-nya keren 😍', createdAt: minsAgo(9) } })
  await db.message.create({ data: { conversationId: conv1.id, senderId: sara.id, content: 'Btw aku ada ide buat fitur Communities. Bisa call?', createdAt: minsAgo(8) } })

  const conv2 = await db.conversation.create({ data: { type: 'private' } })
  await db.conversationMember.create({ data: { conversationId: conv2.id, userId: yowanda.id } })
  await db.conversationMember.create({ data: { conversationId: conv2.id, userId: arif.id } })
  await db.message.create({ data: { conversationId: conv2.id, senderId: arif.id, content: 'Yow, aku mau invest di Twivter. Bisa diskusi?', createdAt: minsAgo(60) } })
  await db.message.create({ data: { conversationId: conv2.id, senderId: yowanda.id, content: 'Wow serius? Boleh. Kapan?', createdAt: minsAgo(55) } })

  const conv3 = await db.conversation.create({ data: { type: 'group', name: 'Tim Twivter' } })
  for (const u of [yowanda, sara, bagus, maya]) {
    await db.conversationMember.create({ data: { conversationId: conv3.id, userId: u.id } })
  }
  await db.message.create({ data: { conversationId: conv3.id, senderId: yowanda.id, content: 'Standup mingguan: update progress masing-masing ya!', createdAt: minsAgo(120) } })
  await db.message.create({ data: { conversationId: conv3.id, senderId: bagus.id, content: 'Backend DM realtime udah 80%. Estimasi weekend kelar.', createdAt: minsAgo(115) } })
  await db.message.create({ data: { conversationId: conv3.id, senderId: maya.id, content: 'Aku lagi finalize dark mode tokens. Nanti review bareng.', createdAt: minsAgo(110) } })

  await db.report.create({ data: { reporterId: sara.id, targetId: rizki.id, targetType: 'user', reason: 'Spam promosi stream berlebihan', status: 'pending' } })
  await db.report.create({ data: { reporterId: nina.id, targetId: bagus.id, targetType: 'user', reason: 'Komentar tidak relevan', status: 'pending' } })

  await db.verification.create({ data: { userId: sara.id, reason: 'Software engineer public figure', status: 'pending' } })
  await db.verification.create({ data: { userId: bagus.id, reason: 'Tech content creator', status: 'pending' } })

  console.log('✅ Seed complete!')
  console.log(`   ${createdUsers.length} users, ${allPosts.length} posts, ${communities.length} communities`)
  console.log('   Demo login: yowanda@twivter.com / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
