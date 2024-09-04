import { HttpHandler } from "./widgets/types.ts";

const languages = new Map()
// import English from "./locales/en.json"
// languages.set("en", English)

export const httpHandler: HttpHandler = {
    endpoints: [
        {
            method: "GET",
            path: "test",
            handle: (ctx) => {
                ctx.response.text("Hallo Welt");
            }
        },
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
