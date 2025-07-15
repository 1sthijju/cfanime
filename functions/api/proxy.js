export async function onRequest({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  
  if (!target) {
    return new Response("No URL provided", { status: 400 });
  }

  try {
    const response = await fetch(target, {
      headers: {
        "Referer": "https://megacloud.blog",
      },
    });

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Headers", "*");

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response("Failed to fetch target URL", { status: 502 });
  }
}
