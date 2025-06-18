import React, { memo, useCallback } from "react";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import { host } from "../../lib/youTrackApp.ts";

const AppComponent: React.FunctionComponent = () => {
    const callBackend = useCallback(async () => {
        const result = await host.fetchApp("backend/debug", { query: { test: "123" } });
        console.log("request result", result);
    }, []);

    return (
        <div className="widget">
            <Button primary onClick={callBackend}>{"Make HTTP Request"}</Button>
        </div>
    );
};

export const App = memo(AppComponent);
