import { HttpHandler } from "./widgets/types.ts";

const languages = new Map()
// import English from "./locales/en.json"
// languages.set("en", English)
import German from "./locales/de.json"
languages.set("de", German)

export const httpHandler: HttpHandler = {
    endpoints: [
        {
            method: 'GET',
            path: 'translate',
            handle: (ctx) => {
                const lang = ctx.request.getParameter('lang')
                ctx.response.json({translation: languages.get(lang)});
            }
        },
    ]
};
