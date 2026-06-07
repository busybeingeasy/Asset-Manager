import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";

const port = Number(process.env.PORT) || 8080;

app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  startScheduler();
});
