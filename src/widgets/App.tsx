import { useEffect, useState } from "react";
import { APIError, Article, ArticleBase, Project } from "./types.ts";
import Select from "@jetbrains/ring-ui-built/components/select/select";
import { useTranslation } from "react-i18next";
import {
    copyArticle,
    loadAndCopyAttachmentsToArticle,
    loadArticle,
    loadProjectArticles,
    loadProjects,
    moveArticle
} from "./api.ts";
import Loader from "@jetbrains/ring-ui-built/components/loader/loader";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import { Input, Size } from "@jetbrains/ring-ui-built/components/input/input";
import YTApp, { host } from "./youTrackApp.ts";
import i18n from "./i18n.ts";
import { AlertType } from "@jetbrains/ring-ui-built/components/alert/alert";
import Checkbox from "@jetbrains/ring-ui-built/components/checkbox/checkbox";
import Tooltip from "@jetbrains/ring-ui-built/components/tooltip/tooltip";

const TOP_LEVEL_ARTICLE: ArticleBase = {
    id: "0",
    idReadable: "",
    summary: i18n.t("topLevelArticlePlaceholder")
};

//todo: hide widget in draft menu - currently not possible
export default function App() {
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [buttonsLoading, setButtonsLoading] = useState(false);

    const [article, setArticle] = useState<Article>();
    const [projects, setProjects] = useState<Project[]>();
    const [selectedProject, setSelectedProject] = useState<Project>();
    const [selectedParentArticle, setSelectedParentArticle] = useState<ArticleBase>(TOP_LEVEL_ARTICLE);
    const [includeDescendents, setIncludeDescendents] = useState<boolean>(true);

    useEffect(() => {
        loadArticle(YTApp.entity.id).then((res: Article) => {
            setArticle(res);
            setSelectedProject(res.project);
            if (res.parentArticle) setSelectedParentArticle(res.parentArticle);
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

    if (!article || !selectedProject) return (
        <div className="w-full flex justify-center mt-12 text-base font-bold text-wrap">
            <span>{error}</span>
        </div>
    );

    const moveButtonDisabled =
        selectedParentArticle === TOP_LEVEL_ARTICLE && article.parentArticle === null && selectedProject?.id === article.project.id
        || selectedParentArticle.id === article.parentArticle?.id;

    return (
        <form className="w-full flex flex-col space-y-6">
            <div>
                <label htmlFor="titleInput">{t("titleInputLabel")}</label>
                <Input
                    id="titleInput"
                    defaultValue={article.summary ?? ""}
                    size={Size.FULL}
                    error={!article.summary || article.summary.length === 0 ? t("titleInputEmpty") : undefined}
                    className={!article.summary || article.summary.length === 0 ? "-mb-5" : ""}
                    onChange={(event) => {
                        setArticle((article) =>
                            article && {
                                ...article,
                                summary: event.currentTarget.value
                            });
                    }}
                />
            </div>

            <div>
                <label htmlFor="projectSelection">{t("projectSelectionLabel")}</label>
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
                    data={projects?.map(projectToSelectItem)}
                    onSelect={(item) => {
                        if (!item) return;
                        setSelectedProject(item.model);
                        setSelectedParentArticle(TOP_LEVEL_ARTICLE);
                    }}
                    selected={projectToSelectItem(selectedProject!)}
                    size={Size.FULL}
                />
            </div>

            {
                selectedProject &&
                <div>
                    <label htmlFor="parentArticleSelection">{t("parentArticleSelectionLabel")}</label>
                    <Select
                        id="parentArticleSelection"
                        filter={{ placeholder: t("filterItems") }}
                        loading={selectedProject.articles == undefined}
                        loadingMessage={t("loading")}
                        notFoundMessage={t("noOptionsFound")}
                        onOpen={() => {
                            if (selectedProject.articles) return;
                            loadProjectArticles(selectedProject.id).then((res: ArticleBase[]) => {
                                selectedProject.articles = [TOP_LEVEL_ARTICLE, ...res];
                                setSelectedProject({ ...selectedProject });

                                // Memoize the articles
                                if (!projects) return;
                                const index = projects.findIndex((proj) => proj.id === selectedProject.id);
                                projects[index] = selectedProject;
                                setProjects(projects);
                            }).catch(() => {
                                selectedProject.articles = [TOP_LEVEL_ARTICLE];
                                setSelectedProject({ ...selectedProject });
                            });
                        }}
                        data={selectedProject.articles?.map(articleToSelectItem)}
                        onSelect={(item) => {
                            if (!item) return;
                            setSelectedParentArticle(item.model);
                        }}
                        selected={articleToSelectItem(selectedParentArticle)}
                        size={Size.FULL}
                    />
                </div>
            }

            <div>
                <Checkbox
                    id="includeDescendentsCheckbox"
                    defaultChecked={includeDescendents}
                    onChange={(event) => setIncludeDescendents(event.target.checked)}
                />
                <Tooltip title={t("includeDescendentsInfo")}>
                    <label htmlFor="includeDescendentsCheckbox">{t("includeDescendentsCheckboxLabel")}*</label>
                </Tooltip>
            </div>

            <div className="flex grow space-x-4 pt-4">
                <Button primary className="w-full" loader={buttonsLoading} onClick={() => {
                    setButtonsLoading(true);

                    if (!article || !selectedProject) return;

                    article.project = {
                        id: selectedProject.id,
                        name: selectedProject.name
                    };

                    const parentArticle = selectedParentArticle === TOP_LEVEL_ARTICLE ? null : selectedParentArticle;

                    handleArticleCopy(article, includeDescendents, parentArticle).then(([article, noErrors]) => {
                        if (noErrors)
                            redirectToArticle(article.id);
                        else
                            host.alert(t("warnCopyErrorsOccurred"), AlertType.WARNING);
                    }).catch(() => {
                        host.alert(t("errorCopyArticle"), AlertType.ERROR);
                    }).finally(() => setButtonsLoading(false));
                }}>
                    {t("copyButtonLabel")}
                </Button>
                <Button primary
                        className="w-full"
                        loader={!moveButtonDisabled && buttonsLoading}
                        disabled={moveButtonDisabled}
                        onClick={() => {
                            setButtonsLoading(true);

                            const parentArticle = selectedParentArticle === TOP_LEVEL_ARTICLE ? undefined : selectedParentArticle;

                            const project = {
                                id: selectedProject.id,
                                name: selectedProject.name
                            };

                            moveArticle(article.idReadable, project, parentArticle).then(({ id }) => {
                                redirectToArticle(id);
                            }).catch(() => {
                                host.alert(t("errorMoveArticle"), AlertType.ERROR);
                            }).finally(() => setButtonsLoading(false));
                        }}>
                    {t("moveButtonLabel")}
                </Button>
            </div>
        </form>
    );
}

const projectToSelectItem = (it: Project) => ({ key: it.id, label: it.name, model: it });
const articleToSelectItem = (it: ArticleBase) => ({
    key: it.id,
    label: it.summary,
    description: it.idReadable,
    model: it
});

async function handleArticleCopy(article: Article, includeDescendents: boolean, parentArticle: ArticleBase | null): Promise<[ArticleBase, boolean]> {
    article.parentArticle = parentArticle;
    const newArticle = await copyArticle(article);

    // noinspection ES6MissingAwait
    let promises = [handleAttachments(article.id, newArticle.id)];
    if (includeDescendents) promises.push(copyChildArticles(article, newArticle));

    const results = await Promise.allSettled(promises);
    const noErrors = !results.some((result) => result.status === "rejected" || !result.value)

    return [newArticle, noErrors];
}

async function handleAttachments(oldArticleId: string, newArticleId: string) {
    const attachmentResults = await loadAndCopyAttachmentsToArticle(oldArticleId, newArticleId);

    let anyAttachmentErrored = false;

    for (const result of attachmentResults) {
        if (result.status === "rejected") {
            host.alert(i18n.t("errorCopyAttachment", { "name": result.name }), AlertType.ERROR);
            anyAttachmentErrored = true;
        }
    }

    return !anyAttachmentErrored;
}

async function copyChildArticles(parentArticle: Article, newArticle: ArticleBase): Promise<boolean> {
    if (!parentArticle.hasChildren) return true;

    const promises = parentArticle.childArticles.map(async ({ id }) => {
        try {
            const article = await loadArticle(id).then((res) => ({ ...res, project: parentArticle.project }));
            const newChildArticle = await copyArticle({ ...article, parentArticle: newArticle });

            const results = await Promise.allSettled([handleAttachments(id, newChildArticle.id), copyChildArticles(article, newChildArticle)]);
            return !results.some((result) => result.status === "rejected" || !result.value);
        } catch (_) {
            host.alert(i18n.t("errorCopyChildArticle", { "id": id }), AlertType.ERROR);
            return false;
        }
    });

    const results = await Promise.allSettled(promises);
    return !results.some((result) => result.status === "rejected" || !result.value);
}

function redirectToArticle(id: string) {
    window.parent.location.href = `/articles/${id}`;
}
