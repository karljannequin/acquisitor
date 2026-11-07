// Vitrine ACQUISITOR (acquisitor.fr) : une seule page, servie telle quelle.
import PAGE from "./index.html";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === "www.acquisitor.fr") {
      url.hostname = "acquisitor.fr";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname !== "/") return Response.redirect(url.origin + "/", 302);
    return new Response(PAGE, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    });
  },
};
