import { host } from "./youTrackApp.ts";
import { useTranslation } from "react-i18next";

export default function App({}: {}) {
    const { t } = useTranslation()

    host.fetchApp("backend/test", {}).then(console.log).catch(console.error);

    return (
        <div>
            Hallo {t("example")}
        </div>
    );
}
