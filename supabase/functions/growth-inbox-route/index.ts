Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: {
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Headers":"authorization, apikey, content-type",
      "Access-Control-Allow-Methods":"POST, OPTIONS"
    }});
  }
  return new Response(JSON.stringify({ok:true}), {
    headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}
  });
});