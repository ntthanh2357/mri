# Seed-data cleanup and recovery (local test databases only)

Seed, cleanup, and restore commands are restricted to MongoDB hosts on loopback
and database names ending in `_test`. Remote hosts, `mongodb+srv` URIs, ambiguous
URIs, and production mode are refused. Do not weaken the guard or use a
production/shared database for validation.

## Review before cleanup

1. Set `MONGO_URI` to one local MongoDB test database, such as
   `mongodb://127.0.0.1:27017/neuroscan_test`.
2. Run `npm run db:cleanup-demo` without `SEED_CLEANUP_APPLY=true`.
3. Review every listed `_id`, criterion, collection count, and manual-review
   candidate. The cleanup uses only full legacy fixture identities or explicit
   `isTestAccount: true` patient markers; uncertain and orphaned documents are
   retained for manual review. `--purge-seed` is deliberately rejected because no
   trustworthy marker identifies all legacy seed documents.
4. Create an encrypted database backup with `npm run db:backup`. Each run
   creates a unique directory containing one verified encrypted file per
   collection and a full-database restore bundle. Use the printed bundle path
   and SHA-256 for cleanup. Test restoration into a separate empty local `_test`
   database before authorizing cleanup.
5. Re-run the dry-run and compare the plan digest. Cleanup requires the exact
   database name, digest, verified backup file/hash, and explicit restore-test
   confirmation. Cleanup runs only inside a MongoDB transaction; standalone
   servers are rejected.

## Restore or recovery

`npm run db:restore-isolated` restores a verified encrypted backup into a
different, empty local `_test` database. Set `DB_RESTORE_URI` to the isolated
target, `DB_BACKUP_FILE` to an absolute backup path, `DB_BACKUP_SHA256` to the
verified file hash, `FILE_ENCRYPTION_KEY` to the key used for the backup, and
`DB_RESTORE_CONFIRM_ISOLATED=true` only after verifying the target. The restore
checks the local MongoDB topology and never overwrites an existing document.
Identical `_id` documents are skipped; a conflicting `_id` stops restoration
and reports collection progress. A restore failure can leave a partially
populated target; inspect or discard that isolated target and retry into a new,
empty `_test` database.

For cleanup failures, first inspect the reported transaction status and
collection progress. A failed transaction callback should abort all staged
deletes; if the driver reports an unknown commit result, do not retry blindly.
Verify the target against the backup in a separate local `_test` database.
Never use the recovery procedure to write into a production/shared database.
