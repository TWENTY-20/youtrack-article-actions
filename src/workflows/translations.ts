//import English from "./locales/en.json"

import German from "../locales/de.json";
import { HttpHandler } from "../lib/types";

const languages = new Map();
languages.set("de", German);

export const httpHandler: HttpHandler = {
    endpoints: [
        {
            method: "GET",
            path: "translate",
            handle: (ctx) => {
                const lang = ctx.request.getParameter("lang");
                ctx.response.json({ translation: languages.get(lang) });
            }
        },
    ]
};
