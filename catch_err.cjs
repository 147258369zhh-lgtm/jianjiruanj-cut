const fs = require('fs');
const http = require('http');

const indexHtmlPath = 'index.html';
const originalHtml = fs.readFileSync(indexHtmlPath, 'utf8');

if (!originalHtml.includes('http://localhost:9999')) {
  const injected = `<script>
    window.addEventListener('error', function(event) {
      fetch('http://localhost:9999/log', {
        method: 'POST',
        body: event.error ? event.error.stack : event.message
      }).catch(console.error);
    });
    window.addEventListener('unhandledrejection', function(event) {
      fetch('http://localhost:9999/log', {
        method: 'POST',
        body: event.reason ? event.reason.stack || event.reason : 'Unhandled Promise Rejection'
      }).catch(console.error);
    });
    // Optional: catch console.error to be extremely thorough
    const origError = console.error;
    console.error = function() {
      fetch('http://localhost:9999/log', {
        method: 'POST',
        body: Array.from(arguments).join(' ')
      }).catch(() => {});
      origError.apply(console, arguments);
    };
  </script>`;
  fs.writeFileSync(indexHtmlPath, originalHtml.replace('<head>', '<head>' + injected));
}

let logs = 0;
const server = http.createServer((req, res) => {
  if (req.url === '/log' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      console.log('\n--- BROWSER ERROR CAUGHT ---');
      console.log(body);
      console.log('----------------------------\n');
      res.end('ok');
      logs++;
      if (logs >= 1) { // Exit after getting an error
          setTimeout(() => {
              fs.writeFileSync(indexHtmlPath, originalHtml);
              server.close();
              process.exit(0);
          }, 500);
      }
    });
  } else {
    res.end('ok');
  }
});

server.listen(9999, () => {
  console.log('Listening for browser errors on port 9999...');
  // Force vite to hot reload
  const touchTime = new Date();
  fs.utimesSync(indexHtmlPath, touchTime, touchTime);
});

setTimeout(() => {
  console.log("No error reported within 10 seconds. Restoring html...");
  fs.writeFileSync(indexHtmlPath, originalHtml);
  server.close();
  process.exit(0);
}, 10000);
