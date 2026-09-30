-- Branching feature: parent link for forked sessions.
-- NULL = root session; non-NULL = this session was forked from another.

ALTER TABLE chatsession ADD COLUMN IF NOT EXISTS parent_session_id TEXT;
ALTER TABLE chatsession ADD COLUMN IF NOT EXISTS branch_label TEXT;

CREATE INDEX IF NOT EXISTS chatsession_parent_session_id_idx
  ON chatsession (parent_session_id);
