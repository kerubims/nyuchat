-- Summary rollback: track which message was last absorbed into global_summary.
-- Lets edit/regenerate roll the summary back instead of dropping it wholesale.

ALTER TABLE chatsession ADD COLUMN IF NOT EXISTS summary_upto_msg_id TEXT;
