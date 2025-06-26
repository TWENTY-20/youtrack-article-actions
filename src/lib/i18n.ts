import i18next, { ResourceLanguage } from "i18next";
import { initReactI18next } from "react-i18next";
import YTApp, { host } from "./youTrackApp.ts";
import English from "../locales/en.json";

let translations: ResourceLanguage | undefined;
if (YTApp.locale !== "en") {
    translations =
        await host.fetchApp(`translations/translate?lang=${YTApp.locale}`, {})
            .then((it: any) => it.translation as ResourceLanguage)
            .catch(() => undefined);
}

await i18next
    .use(initReactI18next)
    .init({
        lng: YTApp.locale,
        fallbackLng: "en",
        resources: {
            en: {
                translation: English
            },
            ...(translations && {
                [YTApp.locale]: {
                    translation: translations
                }
            })
        },
        // debug: true,
        supportedLngs: ["en"].concat(translations ? [YTApp.locale] : []),
        nonExplicitSupportedLngs: true,
        interpolation: {
            escapeValue: false,
        }
    });

export default i18next;
