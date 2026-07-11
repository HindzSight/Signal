import { createServer } from './server.js';

const port = Number(process.env.PORT || 8787);
const app = createServer();

app.listen(port, '127.0.0.1', () => {
  console.log(`Folder Share Dashboard listening at http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
