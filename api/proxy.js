export default {
  async fetch(request) {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("url");
    if (!target) return new Response("No URL provided", { status: 400 });

    const res = await fetch(target, {
      headers: {
        "Referer": "https://megacloud.blog",
      },
    });

    const newHeaders = new Headers(res.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Headers", "*");

    return new Response(res.body, {
      status: res.status,
      headers: newHeaders,
    });
  },
};
