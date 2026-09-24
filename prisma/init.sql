-- uChat schema init (mirrors prisma/schema.prisma; vector 1024-dim per PRD BGE-M3)
CREATE TABLE IF NOT EXISTS "userprofile" (
    "id"             TEXT NOT NULL,
    "display_name"   TEXT NOT NULL DEFAULT 'User',
    "gender"         TEXT NOT NULL DEFAULT 'Not specified',
    "persona"        TEXT NOT NULL,
    "response_style" TEXT NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "userprofile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "character" (
    "id"                  TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "avatar_url"          TEXT,
    "gender"              TEXT NOT NULL DEFAULT 'Not specified',
    "persona"             TEXT NOT NULL,
    "greeting"            TEXT NOT NULL,
    "backstory"           TEXT NOT NULL,
    "key_memories"        TEXT NOT NULL,
    "scenario"            TEXT NOT NULL,
    "response_directives" TEXT NOT NULL,
    "example_dialogue"    TEXT NOT NULL,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "character_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chatsession" (
    "id"               TEXT NOT NULL,
    "character_id"     TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "global_summary"   TEXT,
    "current_state"    TEXT,
    "msg_since_summary" INTEGER NOT NULL DEFAULT 0,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chatsession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chatmessage" (
    "id"             TEXT NOT NULL,
    "chat_session_id" TEXT NOT NULL,
    "sender"         TEXT NOT NULL,
    "content"        TEXT NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chatmessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_facts" (
    "id"           TEXT NOT NULL,
    "user_id"      TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "subject"      TEXT NOT NULL,
    "predicate"    TEXT NOT NULL,
    "object"       TEXT NOT NULL,
    "raw_fact"     TEXT NOT NULL,
    "embedding"    vector(1024),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_facts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chatsession" ADD CONSTRAINT "chatsession_character_id_fkey"
    FOREIGN KEY ("character_id") REFERENCES "character"("id") ON DELETE CASCADE;
ALTER TABLE "chatmessage" ADD CONSTRAINT "chatmessage_chat_session_id_fkey"
    FOREIGN KEY ("chat_session_id") REFERENCES "chatsession"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "chatsession_character_id_idx" ON "chatsession"("character_id");
CREATE INDEX IF NOT EXISTS "chatmessage_chat_session_id_idx" ON "chatmessage"("chat_session_id");
CREATE INDEX IF NOT EXISTS "user_facts_user_id_character_id_idx" ON "user_facts"("user_id", "character_id");

-- RAG: HNSW dense index + GIN lexical index (2-stage hybrid search, PRD §1.8)
CREATE INDEX IF NOT EXISTS "user_facts_embedding_hnsw"
    ON "user_facts" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS "user_facts_raw_fact_trgm"
    ON "user_facts" USING gin ("raw_fact" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_facts_object_trgm"
    ON "user_facts" USING gin ("object" gin_trgm_ops);
