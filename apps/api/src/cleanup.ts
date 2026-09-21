import { ArchiveRepository } from "./repository";
export async function cleanupPhotos(env: WorkerBindings) {
  const repo = new ArchiveRepository(env.HYPERDRIVE.connectionString);
  try {
    const jobs = await repo.sql`SELECT * FROM claim_cleanup_jobs()`;
    for (const job of jobs) {
      try {
        if (job.object_keys) await env.PHOTOS.delete(job.object_keys);
        else {
          let cursor: string | undefined;
          do {
            const objects = await env.PHOTOS.list({
              prefix: `${job.user_id}/`,
              cursor,
              limit: 1000,
            });
            if (objects.objects.length)
              await env.PHOTOS.delete(objects.objects.map((o) => o.key));
            cursor = objects.truncated ? objects.cursor : undefined;
          } while (cursor);
        }
        await repo.sql`SELECT finish_cleanup_job(${job.id})`;
      } catch {
        console.error(JSON.stringify({ event: "photo.cleanup.failed" }));
      }
    }
  } finally {
    await repo.close();
  }
}
