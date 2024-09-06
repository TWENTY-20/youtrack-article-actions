import { useEffect, useState } from "react";
import { APIError, Article, Project } from "./types.ts";
import Select from "@jetbrains/ring-ui-built/components/select/select";
import { useTranslation } from "react-i18next";
import {
    copyArticle,
    copyChildArticle,
    loadAndCopyAttachmentsToArticle,
    loadArticle,
    loadProjects,
    moveArticle
} from "./api.ts";
import Loader from "@jetbrains/ring-ui-built/components/loader/loader";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import { Input, Size } from "@jetbrains/ring-ui-built/components/input/input";
import ButtonSet from "@jetbrains/ring-ui-built/components/button-set/button-set";
import YTApp, { host } from "./youTrackApp.ts";
import i18n from "./i18n.ts";
import { AlertType } from "@jetbrains/ring-ui-built/components/alert/alert";
import Checkbox from "@jetbrains/ring-ui-built/components/checkbox/checkbox";
import Tooltip from "@jetbrains/ring-ui-built/components/tooltip/tooltip";

//todo: permissions
//todo: hide widget in draft menu - currently not possible
//todo: change parent article
export default function App() {
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [buttonsLoading, setButtonsLoading] = useState(false);

    const [article, setArticle] = useState<Article>();
    const [projects, setProjects] = useState<Project[]>();
    const [includeDescendents, setIncludeDescendents] = useState<boolean>(true);

    useEffect(() => {
        loadArticle(YTApp.entity.id).then((res: Article) => {
            setArticle(res);
        }).catch((err: APIError) => {
            if (err.status === 500) {
                setError(t("errorDraft"));
                return;
            }
            setError(t("errorGeneral"));
        }).finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex justify-center items-center">
            <Loader message={t("loading")}/>
        </div>
    );

    //todo: error
    if (!article) return (
        <div className="w-full flex justify-center mt-12 text-base font-bold text-wrap">
            <span>{error}</span>
        </div>
    );

    return (
        <form className="w-full flex flex-col ring-form">
            <div className="ring-form__group">
                <label htmlFor="titleInput" className="ring-form__label">{t("titleInputLabel")}</label>
                <div className="ring-form__control">
                    <Input
                        id="titleInput"
                        defaultValue={article.summary ?? ""}
                        size={Size.FULL}
                        onChange={(event) => {
                            setArticle((article) =>
                                article && {
                                    ...article,
                                    summary: event.currentTarget.value
                                });
                        }}
                    />
                </div>
            </div>
            <div className="ring-form__group">
                <label htmlFor="projectSelection" className="ring-form__label">{t("projectSelectionLabel")}</label>
                <div className="ring-form__control">
                    <Select
                        id="projectSelection"
                        filter={{ placeholder: t("filterItems") }}
                        loading={projects == undefined}
                        loadingMessage={t("loading")}
                        notFoundMessage={t("noOptionsFound")}
                        onOpen={() => {
                            if (projects) return;
                            loadProjects().then(setProjects);
                        }}
                        data={projects?.map(toSelectItem)}
                        onSelect={(item) => {
                            if (!item) return;
                            setArticle({
                                ...article,
                                project: item.model
                            });
                        }}
                        selected={toSelectItem(article.project)}
                        size={Size.FULL}
                    />
                </div>
            </div>
            <div className="ring-form__group pl-4">
                <Checkbox
                    id="includeDescendentsCheckbox"
                    defaultChecked={includeDescendents}
                    onChange={(event) => setIncludeDescendents(event.target.checked)}
                />
                <Tooltip title={t("includeDescendentsInfo")}>
                    <label htmlFor="includeDescendentsCheckbox"
                           className="font-bold">{t("includeDescendentsCheckboxLabel")}*</label>
                </Tooltip>
            </div>
            <ButtonSet className="ring-form__group">
                <Button primary loader={buttonsLoading} onClick={() => {
                    setButtonsLoading(true);
                    handleArticleCopy(article, includeDescendents).then((newArticleId) => {
                        redirectToArticle(newArticleId);
                    }).catch(() => {
                        host.alert(t("errorCopyArticle"));
                    }).finally(() => setButtonsLoading(false));
                }}>
                    {t("copyButtonLabel")}
                </Button>
                <Button loader={buttonsLoading} onClick={() => {
                    setButtonsLoading(true);
                    moveArticle(article.idReadable, article.project).then(({ id }) => {
                        redirectToArticle(id);
                    }).catch(() => {
                        host.alert(t("errorMoveArticle"));
                    }).finally(() => setButtonsLoading(true));
                }}>
                    {t("moveButtonLabel")}
                </Button>
            </ButtonSet>
        </form>
    );
}

const toSelectItem = (it: Project) => ({ key: it.id, label: it.name, model: it });

async function handleArticleCopy(article: Article, includeDescendents: boolean) {
    const newArticleId = await copyArticle(article).then((res) => res.id);

    // noinspection ES6MissingAwait
    let promises = [handleAttachments(article.id, newArticleId)];
    if (includeDescendents) promises.push(copyChildArticles(article, newArticleId));

    await Promise.allSettled(promises);

    return newArticleId;
}

async function handleAttachments(oldArticleId: string, newArticleId: string) {
    const attachmentResults = await loadAndCopyAttachmentsToArticle(oldArticleId, newArticleId);
    for (const result of attachmentResults) if (result.status === "rejected")
        host.alert(i18n.t("errorCopyAttachment", { "name": result.name }), AlertType.ERROR);
}

async function copyChildArticles(parentArticle: Article, newArticleId: string) {
    if (!parentArticle.hasChildren) return;

    const promises = parentArticle.childArticles.map(async ({ id }) => {
        try {
            const article = await loadArticle(id).then((res) => ({ ...res, project: parentArticle.project }));
            const newId = await copyChildArticle(newArticleId, article).then((res) => res.id);

            await Promise.allSettled([handleAttachments(id, newId), copyChildArticles(article, newId)]);
        } catch (_) {
            host.alert(i18n.t("errorCopyArticle"));
        }
    });

    await Promise.allSettled(promises);
}

function redirectToArticle(id: string) {
    window.parent.location.href = `/articles/${id}`;
}
