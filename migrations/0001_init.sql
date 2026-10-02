-- Twivter — Cloudflare D1 schema (SQLite dialect)
--
-- Design notes
--  * Every timestamp is a TEXT ISO-8601 UTC string with millisecond precision
--    (`2026-10-02T10:27:12.345Z`). The format is fixed width, so lexicographic
--    order equals chronological order: `ORDER BY createdAt DESC` is correct and
--    the text indexes are usable directly.
--  * Primary keys are text ids produced by `src/lib/ids.ts`, whose first 9 chars
--    are a base36 millisecond timestamp. Ids therefore increase in creation
--    order, which lets every paginated query use a plain keyset cursor
--    (`WHERE id < ? ORDER BY id DESC`). The old code paginated on `createdAt`,
--    which is not unique and silently skipped/duplicated rows on page 2+.
--  * Booleans are INTEGER 0/1; the D1 layer maps them back to JS booleans.
--  * `PRAGMA foreign_keys` is ON by default on D1.

-- ─────────────────────────────────────────────────────────────
-- Users & profiles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE User (
  id            TEXT PRIMARY KEY NOT NULL,
  email         TEXT NOT NULL,
  emailLower    TEXT NOT NULL,
  passwordHash  TEXT NOT NULL,
  username      TEXT NOT NULL,
  usernameLower TEXT NOT NULL,
  displayName   TEXT NOT NULL,
  bio           TEXT,
  website       TEXT,
  location      TEXT,
  avatarUrl     TEXT,
  coverUrl      TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  verified      INTEGER NOT NULL DEFAULT 0,
  onboarded     INTEGER NOT NULL DEFAULT 0,
  interests     TEXT,
  createdAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Case-insensitive uniqueness. The Prisma schema only had a plain UNIQUE on
-- `username`, which under SQLite's BINARY collation let "Alice" and "alice"
-- coexist and made profile lookups return whichever row came first.
CREATE UNIQUE INDEX User_emailLower_key     ON User (emailLower);
CREATE UNIQUE INDEX User_usernameLower_key ON User (usernameLower);
CREATE INDEX User_createdAt_idx ON User (createdAt DESC);
CREATE INDEX User_role_idx       ON User (role);

-- Server-side sessions. The previous implementation issued a stateless JWT that
-- remained valid for 30 days even after logout. Now every login has a row,
-- logout deletes it, and authenticated requests verify it.
CREATE TABLE Session (
  token     TEXT PRIMARY KEY NOT NULL,
  userId    TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX Session_userId_idx    ON Session (userId);
CREATE INDEX Session_expiresAt_idx ON Session (expiresAt);

-- ─────────────────────────────────────────────────────────────
-- Posts & interactions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Post (
  id          TEXT PRIMARY KEY NOT NULL,
  authorId    TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  replyToId   TEXT,
  quotePostId TEXT,
  createdAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (authorId)    REFERENCES User (id) ON DELETE CASCADE,
  FOREIGN KEY (replyToId)   REFERENCES Post (id) ON DELETE CASCADE,
  FOREIGN KEY (quotePostId) REFERENCES Post (id) ON DELETE SET NULL
);
CREATE INDEX Post_authorId_idx    ON Post (authorId, id DESC);
CREATE INDEX Post_replyToId_idx   ON Post (replyToId, id);
CREATE INDEX Post_createdAt_idx   ON Post (createdAt DESC);
CREATE INDEX Post_quotePostId_idx ON Post (quotePostId);
-- Partial index for the two hot feeds (root posts only), which is what the
-- home/explore/bookmarks queries always ask for.
CREATE INDEX Post_root_idx        ON Post (id DESC) WHERE replyToId IS NULL;

CREATE TABLE PostMedia (
  id     TEXT PRIMARY KEY NOT NULL,
  postId TEXT NOT NULL,
  url    TEXT NOT NULL,
  type   TEXT NOT NULL DEFAULT 'image',
  ord    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (postId) REFERENCES Post (id) ON DELETE CASCADE
);
CREATE INDEX PostMedia_postId_idx ON PostMedia (postId, ord);

-- Interaction tables. Each row has its own sortable id so the per-user feeds
-- (bookmarks, likes) can paginate with a keyset cursor; the UNIQUE pair
-- replaces Prisma's @@unique([postId, userId]) and makes "did I like this?"
-- a single index seek.
CREATE TABLE Like (
  id        TEXT PRIMARY KEY NOT NULL,
  postId    TEXT NOT NULL,
  userId    TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (postId, userId),
  FOREIGN KEY (postId) REFERENCES Post (id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX Like_userId_idx ON Like (userId, id DESC);

CREATE TABLE Bookmark (
  id        TEXT PRIMARY KEY NOT NULL,
  postId    TEXT NOT NULL,
  userId    TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (postId, userId),
  FOREIGN KEY (postId) REFERENCES Post (id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX Bookmark_userId_idx ON Bookmark (userId, id DESC);

CREATE TABLE Repost (
  id        TEXT PRIMARY KEY NOT NULL,
  postId    TEXT NOT NULL,
  userId    TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (postId, userId),
  FOREIGN KEY (postId) REFERENCES Post (id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX Repost_userId_idx ON Repost (userId, id DESC);

-- NOTE: there is deliberately no `Comment` table. Replies are `Post` rows with
-- `replyToId` set. The old Prisma schema had both, the `Comment` table was never
-- written to, and the two being conflated is what produced the "comment count
-- doesn't increase" bug that was patched in one place and missed elsewhere.

-- ─────────────────────────────────────────────────────────────
-- Social graph
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Follow (
  id          TEXT PRIMARY KEY NOT NULL,
  followerId  TEXT NOT NULL,
  followingId TEXT NOT NULL,
  createdAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (followerId, followingId),
  FOREIGN KEY (followerId)  REFERENCES User (id) ON DELETE CASCADE,
  FOREIGN KEY (followingId) REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX Follow_followingId_idx ON Follow (followingId);
CREATE INDEX Follow_followerId_idx  ON Follow (followerId, id DESC);

-- ─────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────
-- `postId` is a real foreign key now. Previously it was a bare string with no
-- relation, so deleting a post orphaned the row and `serializeNotification`
-- dereferenced null => GET /api/notifications returned 500 for that user
-- permanently.
CREATE TABLE Notification (
  id        TEXT PRIMARY KEY NOT NULL,
  userId    TEXT NOT NULL,
  actorId   TEXT NOT NULL,
  type      TEXT NOT NULL,
  postId    TEXT,
  read      INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (userId)  REFERENCES User (id) ON DELETE CASCADE,
  FOREIGN KEY (actorId) REFERENCES User (id) ON DELETE CASCADE,
  FOREIGN KEY (postId)  REFERENCES Post (id) ON DELETE CASCADE
);
CREATE INDEX Notification_userId_idx ON Notification (userId, id DESC);
CREATE INDEX Notification_unread_idx ON Notification (userId) WHERE read = 0;

-- ─────────────────────────────────────────────────────────────
-- Messaging
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Conversation (
  id        TEXT PRIMARY KEY NOT NULL,
  type      TEXT NOT NULL DEFAULT 'private',
  name      TEXT,
  -- For 1:1 chats this is "<smallerUserId>:<largerUserId>". The partial UNIQUE
  -- index makes concurrent "open a DM with this person" requests idempotent at
  -- the database level, which the old check-then-insert code was not.
  dmKey     TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX Conversation_dmKey_key ON Conversation (dmKey) WHERE dmKey IS NOT NULL;
CREATE INDEX Conversation_updatedAt_idx ON Conversation (updatedAt DESC);

CREATE TABLE ConversationMember (
  id             TEXT PRIMARY KEY NOT NULL,
  conversationId TEXT NOT NULL,
  userId         TEXT NOT NULL,
  lastReadAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  joinedAt       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (conversationId, userId),
  FOREIGN KEY (conversationId) REFERENCES Conversation (id) ON DELETE CASCADE,
  FOREIGN KEY (userId)         REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX ConversationMember_userId_idx         ON ConversationMember (userId);
CREATE INDEX ConversationMember_conversationId_idx ON ConversationMember (conversationId, userId);

CREATE TABLE Message (
  id             TEXT PRIMARY KEY NOT NULL,
  conversationId TEXT NOT NULL,
  senderId       TEXT NOT NULL,
  content        TEXT NOT NULL,
  createdAt      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (conversationId) REFERENCES Conversation (id) ON DELETE CASCADE,
  FOREIGN KEY (senderId)       REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX Message_conversationId_idx ON Message (conversationId, id DESC);
-- Drives the unread badge: count messages in a conversation newer than lastReadAt.
CREATE INDEX Message_unread_idx ON Message (conversationId, senderId, id);

-- ─────────────────────────────────────────────────────────────
-- Communities
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Community (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  slugLower   TEXT NOT NULL,
  description TEXT,
  coverUrl    TEXT,
  ownerId     TEXT NOT NULL,
  createdAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (ownerId) REFERENCES User (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX Community_slugLower_key ON Community (slugLower);
CREATE INDEX Community_createdAt_idx ON Community (createdAt DESC);

CREATE TABLE CommunityMember (
  id          TEXT PRIMARY KEY NOT NULL,
  communityId TEXT NOT NULL,
  userId      TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  joinedAt    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (communityId, userId),
  FOREIGN KEY (communityId) REFERENCES Community (id) ON DELETE CASCADE,
  FOREIGN KEY (userId)      REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX CommunityMember_userId_idx ON CommunityMember (userId);

-- ─────────────────────────────────────────────────────────────
-- Moderation
-- ─────────────────────────────────────────────────────────────
-- `targetUserId` is the user being reported. `targetPostId` was added because the
-- old schema overloaded `targetId` with either a user id or a post id but only
-- ever resolved it as a user id — so reports filed against a post could not be
-- acted on by a moderator.
CREATE TABLE Report (
  id           TEXT PRIMARY KEY NOT NULL,
  reporterId   TEXT NOT NULL,
  targetUserId TEXT NOT NULL,
  targetPostId TEXT,
  targetType   TEXT NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  createdAt    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (reporterId)   REFERENCES User (id) ON DELETE CASCADE,
  FOREIGN KEY (targetUserId) REFERENCES User (id) ON DELETE CASCADE,
  FOREIGN KEY (targetPostId) REFERENCES Post (id) ON DELETE SET NULL
);
-- Covers both the admin status filter and the "you already reported this"
-- rate-limit lookup, which previously full-scanned the table.
CREATE INDEX Report_status_idx                ON Report (status, id DESC);
CREATE INDEX Report_reporter_target_status_idx ON Report (reporterId, targetUserId, status);

CREATE TABLE Verification (
  id        TEXT PRIMARY KEY NOT NULL,
  userId    TEXT NOT NULL,
  reason    TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'pending',
  note      TEXT,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (userId),
  FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE
);
CREATE INDEX Verification_status_idx ON Verification (status, id DESC);