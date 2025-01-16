const config = {
  no_ref: "on", // Control the HTTP referrer header, hide the HTTP Referer header if set to "on".
  theme: "", // Homepage theme, use empty value for default theme. For "urlcool" theme, set to "theme/urlcool".
  cors: "on", // Allow Cross-origin resource sharing for API requests.
  unique_link: true, // If true, the same long URL will shorten into the same short URL.
  custom_link: false, // Allow users to customize the short URL.
  safe_browsing_api_key: "", // Enter Google Safe Browsing API Key to enable URL safety checks before redirecting.
};

const html404 = `<!DOCTYPE html>
<body>
  <h1>404 Not Found</h1>
  <p>The URL you visited is not found.</p>
</body>`;

let response_header = {
  "content-type": "text/html;charset=UTF-8",
};

if (config.cors === "on") {
  response_header = {
    "content-type": "text/html;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
  };
}

async function randomString(len = 6) {
  const chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
  const maxPos = chars.length;
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return result;
}

async function sha512(url) {
  const encoder = new TextEncoder();
  const encodedUrl = encoder.encode(url);
  const digest = await crypto.subtle.digest("SHA-512", encodedUrl);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkURL(URL) {
  const expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-.\/?%&=]*)?/;
  const objExp = new RegExp(expression);
  return objExp.test(URL) && URL.startsWith("http");
}

async function save_url(URL) {
  const encodedURL = btoa(URL); // Encode URL in Base64
  const random_key = await randomString();
  const is_exist = await LINKS.get(random_key);
  if (is_exist === null) {
    await LINKS.put(random_key, encodedURL); // Save encoded URL
    return [undefined, random_key];
  }
  return save_url(URL);
}

async function is_url_exist(url_sha512) {
  const is_exist = await LINKS.get(url_sha512);
  return is_exist || false;
}

async function is_url_safe(url) {
  const raw = JSON.stringify({
    client: { clientId: "Url-Shorten-Worker", clientVersion: "1.0.7" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "POTENTIALLY_HARMFUL_APPLICATION", "UNWANTED_SOFTWARE"],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url }],
    },
  });

  const requestOptions = {
    method: "POST",
    body: raw,
    redirect: "follow",
  };

  const response = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${config.safe_browsing_api_key}`,
    requestOptions
  );
  const result = await response.json();
  return Object.keys(result).length === 0;
}

async function handleRequest(request) {
  const requestURL = new URL(request.url);

  if (request.method === "POST") {
    const req = await request.json();
    if (!(await checkURL(req.url))) {
      return new Response(`{"status":500,"key":": Error: URL illegal."}`, {
        headers: response_header,
      });
    }

    let stat, random_key;
    if (config.unique_link) {
      const url_sha512 = await sha512(req.url);
      const url_key = await is_url_exist(url_sha512);
      if (url_key) {
        random_key = url_key;
      } else {
        [stat, random_key] = await save_url(req.url);
        if (stat === undefined) {
          await LINKS.put(url_sha512, random_key);
        }
      }
    } else {
      [stat, random_key] = await save_url(req.url);
    }

    if (stat === undefined) {
      const fullUrl = `/${random_key}`;
      return new Response(`{"status":200,"key":"${fullUrl}"}`, {
        headers: response_header,
      });
    } else {
      return new Response(`{"status":200,"key":": Error: Reach the KV write limitation."}`, {
        headers: response_header,
      });
    }
  } else if (request.method === "OPTIONS") {
    return new Response("", { headers: response_header });
  }

  const path = requestURL.pathname.split("/")[1];
  const params = requestURL.search;

  if (!path) {
    const html = await fetch(
      "https://raw.githubusercontent.com/dorothaxutonukuv/url-shortener-assets/refs/heads/main/index.html"
    );
    return new Response(await html.text(), {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  }

  const value = await LINKS.get(path);
  if (value) {
    const decodedURL = atob(value); // Декодируем URL из базы данных
    const location = params ? decodedURL + params : decodedURL;
  
    if (config.no_ref === "on") {
      const no_ref = await fetch("https://raw.githubusercontent.com/dorothaxutonukuv/url-shortener-assets/refs/heads/main/no_ref1.html");
      // Кодируем ссылку перед передачей в шаблон
      const encodedLocation = btoa(location); // Кодируем в Base64
      const no_refText = (await no_ref.text()).replace(/{Replace}/gm, encodedLocation);
      
      return new Response(no_refText, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    } else {
      return Response.redirect(location, 302);
    }
  }

  return new Response(html404, {
    headers: { "content-type": "text/html;charset=UTF-8" },
    status: 404,
  });
}

addEventListener("fetch", async (event) => {
  event.respondWith(handleRequest(event.request));
});
