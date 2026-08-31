# syntax=docker/dockerfile:1.7

FROM pgvector/pgvector:0.8.6-pg18-trixie@sha256:78bf48b801e792f99e3ac62b5036fd3876e9be48afda16c1e331af1c75ceb2ff AS database

COPY --chmod=755 ops/postgres/init/01-create-roles.sh /docker-entrypoint-initdb.d/01-create-roles.sh

FROM pgvector/pgvector:0.8.6-pg18-trixie@sha256:78bf48b801e792f99e3ac62b5036fd3876e9be48afda16c1e331af1c75ceb2ff AS backup

COPY --chmod=755 ops/postgres/backup-entrypoint.sh /usr/local/bin/qinglang-backup
COPY --chmod=755 ops/postgres/verify-restore.sh /usr/local/bin/qinglang-verify-restore

USER postgres
ENTRYPOINT ["/usr/local/bin/qinglang-backup"]
