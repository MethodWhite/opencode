import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260806162833_whole_the_hand",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`task\` (
          \`id\` text PRIMARY KEY,
          \`session_id\` text NOT NULL,
          \`parent_id\` text,
          \`title\` text NOT NULL,
          \`description\` text DEFAULT '',
          \`status\` text DEFAULT 'pending' NOT NULL,
          \`priority\` text DEFAULT 'medium' NOT NULL,
          \`category\` text DEFAULT 'general' NOT NULL,
          \`rice_reach\` integer DEFAULT 1,
          \`rice_impact\` integer DEFAULT 1,
          \`rice_confidence\` real DEFAULT 0.8,
          \`rice_effort\` integer DEFAULT 3,
          \`tags\` text DEFAULT '',
          \`depends_on\` text DEFAULT '',
          \`estimated_hours\` real,
          \`due_date\` integer,
          \`position\` integer DEFAULT 0 NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          CONSTRAINT \`fk_task_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`task_session_idx\` ON \`task\` (\`session_id\`);`)
      yield* tx.run(`CREATE INDEX \`task_parent_idx\` ON \`task\` (\`parent_id\`);`)
      yield* tx.run(`CREATE INDEX \`task_status_idx\` ON \`task\` (\`status\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
