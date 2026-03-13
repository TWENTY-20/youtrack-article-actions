import {useCallback, useEffect, useState} from "react";
import {APIError, Article, ArticleBase, Project} from "../../lib/types.ts";
import Select from "@jetbrains/ring-ui-built/components/select/select";
import {useTranslation} from "react-i18next";
import {
    copyArticle,
    copyAttachment,
    countAllArticlesAndAttachments,
    isArticleDraft,
    loadArticle,
    loadAttachments,
    loadProjectArticles,
    loadProjects,
    moveArticle
} from "../../lib/api.ts";
import Loader from "@jetbrains/ring-ui-built/components/loader/loader";
import Button from "@jetbrains/ring-ui-built/components/button/button";
import {Input, Size} from "@jetbrains/ring-ui-built/components/input/input";
import YTApp, {host} from "../../lib/youTrackApp.ts";
import i18n from "../../lib/i18n.ts";
import {AlertType} from "@jetbrains/ring-ui-built/components/alert/alert";
import Checkbox from "@jetbrains/ring-ui-built/components/checkbox/checkbox";
import Tooltip from "@jetbrains/ring-ui-built/components/tooltip/tooltip";
import ProgressBar from "@jetbrains/ring-ui-built/components/progress-bar/progress-bar";
import Text from "@jetbrains/ring-ui-built/components/text/text";

const TOP_LEVEL_ARTICLE: ArticleBase = {
    id: "0",
    idReadable: "",
    summary: i18n.t("topLevelArticlePlaceholder")
};

function projectToSelectItem(it: Project) {
    return {key: it.id, label: it.name, model: it};
}

function articleToSelectItem(it: ArticleBase) {
    return {
        key: it.id,
        label: it.summary,
        description: it.idReadable,
        model: it
    };
}

function redirectToArticle(id: string) {
    window.parent.location.href = `/articles/${id}`;
}

//todo: hide widget in draft menu - currently not possible
export function App() {
    const {t} = useTranslation();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [buttonsLoading, setButtonsLoading] = useState(false);

    const [article, setArticle] = useState<Article>();
    const [projects, setProjects] = useState<Project[]>();
    const [articles, setArticles] = useState<ArticleBase[]>();
    const [selectedProject, setSelectedProject] = useState<Project>();
    const [selectedParentArticle, setSelectedParentArticle] = useState<ArticleBase>(TOP_LEVEL_ARTICLE);
    const [includeDescendents, setIncludeDescendents] = useState<boolean>(true);
    const [projectFilter, setProjectFilter] = useState<string>("");
    const [articleFilter, setArticleFilter] = useState<string>("");

    const [progressText, setProgressText] = useState<string | null>(null);
    const [currentProgress, setCurrentProgress] = useState<number>(0);
    const [totalProgress, setTotalProgress] = useState<number>(0);

    useEffect(() => {
        const articleId = YTApp.entity!.id;
        loadArticle(articleId).then((res: Article) => {
            setArticle(res);
            setSelectedProject(res.project);
            if (res.parentArticle) {
                setSelectedParentArticle(res.parentArticle);
            }
        }).catch(async (err: APIError) => {
            if (err.status === 500 && await isArticleDraft(articleId)) {
                setError(t("errorDraft"));
                return;
            }
            setError(t("errorGeneral"));
        }).finally(() => setLoading(false));
    }, [t]);

    const fetchProjects = useCallback((filter: string) => {
        loadProjects(filter)
            .then((newProjects) => setProjects(newProjects));
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (!projects) return;
            fetchProjects(projectFilter);
        }, 500);

        return () => clearTimeout(debounce);
    }, [fetchProjects, projectFilter]);

    const fetchArticles = useCallback((projectId: string, filter: string) => {
        loadProjectArticles(projectId, filter).then(articles => {
            setArticles([TOP_LEVEL_ARTICLE, ...articles]);
        }).catch(() => {
            setArticles([TOP_LEVEL_ARTICLE]);
        });
    }, []);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (!selectedProject?.id || !articles) return;
            fetchArticles(selectedProject.name, articleFilter);
        }, 500);

        return () => clearTimeout(debounce);
    }, [selectedProject, fetchArticles, articleFilter]);

    const updateProgress = useCallback((articleId: string, attachment?: { index: number, total: number }) => {
        if (!attachment) {
            setProgressText(t("progressText", {"id": articleId}));
        } else {
            setProgressText(t("progressTextAttachment", {
                "id": articleId,
                "attachmentIndex": attachment.index + 1,
                "totalAttachments": attachment.total
            }));
        }
        setCurrentProgress((currentProgress) => currentProgress + 1);
    }, [t]);

    const handleAttachments = useCallback(async (oldArticleId: string, newArticleId: string, newArticleIdReadable: string) => {
        const attachments = await loadAttachments(oldArticleId);

        let anyAttachmentErrored = false;

        for (let i = 0; i < attachments.length; i++) {
            const attachment = attachments[i];
            try {
                await copyAttachment(newArticleId, attachment);
                updateProgress(newArticleIdReadable, {index: i, total: attachments.length});
            } catch (e) {
                console.error(e);
                host.alert(i18n.t("errorCopyAttachment", {"name": attachment.name}), AlertType.ERROR);
                anyAttachmentErrored = true;
            }
        }

        return anyAttachmentErrored;
    }, [updateProgress]);

    type HandleArticleCopy = (article: Article, includeDescendants: boolean, parentArticle: ArticleBase | null, visitedArticleIDs?: Set<string>) => Promise<[ArticleBase, boolean]>
    const handleArticleCopy: HandleArticleCopy = useCallback<HandleArticleCopy>(async (...args) => {
        const handleArticleCopy: HandleArticleCopy = async (article, includeDescendants, parentArticle, visitedArticleIDs = new Set<string>()) => {
            const newArticle = await copyArticle({...article, parentArticle});
            visitedArticleIDs.add(newArticle.id);
            updateProgress(article.idReadable);

            let errored = false;
            try {
                const attachmentError = await handleAttachments(article.id, newArticle.id, newArticle.idReadable);
                errored = attachmentError || errored;

                if (includeDescendants) {
                    for (const child of article.childArticles) {
                        if (visitedArticleIDs.has(child.id)) {
                            continue;
                        }

                        const fullChildArticle = await loadArticle(child.id);

                        const [, childErrored] = await handleArticleCopy(fullChildArticle, includeDescendants, newArticle, visitedArticleIDs);
                        if (childErrored) {
                            host.alert(t("errorCopyChildArticle", {"id": fullChildArticle.id}), AlertType.ERROR);
                            errored = childErrored;
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                errored = true;
            }

            return [newArticle, errored];
        };
        return handleArticleCopy(...args);
    }, [handleAttachments, t, updateProgress]);

    const handleCopy = useCallback((selectedProject: Project, selectedParentArticle: ArticleBase, article: Article, includeDescendents: boolean) => {
        setButtonsLoading(true);

        article.project = {
            id: selectedProject.id,
            name: selectedProject.name
        };

        const parentArticle = selectedParentArticle === TOP_LEVEL_ARTICLE ? null : selectedParentArticle;

        countAllArticlesAndAttachments(article.id, includeDescendents)
            .then((total) => {
                setTotalProgress(total);

                handleArticleCopy(article, includeDescendents, parentArticle).then(([article, errored]) => {
                    if (errored) {
                        host.alert(t("warnCopyErrorsOccurred"), AlertType.WARNING);
                        return;
                    }
                    redirectToArticle(article.id);
                }).catch((err: APIError) => {
                    if (err.status === 403) {
                        host.alert(t("errorMissingPermission"));
                        return;
                    }
                    host.alert(t("errorCopyArticle"), AlertType.ERROR);
                }).finally(() => setButtonsLoading(false));
            })
            .catch((e) => {
                console.error("Failed to count total number of articles and attachments", e);
                host.alert(t("errorCopyArticle"), AlertType.ERROR);
            });
    }, [t, handleArticleCopy, countAllArticlesAndAttachments]);

    const handleMove = useCallback((selectedProject: Project, selectedParentArticle: ArticleBase, article: Article) => {
        setButtonsLoading(true);

        const parentArticle = selectedParentArticle === TOP_LEVEL_ARTICLE ? undefined : selectedParentArticle;

        const project = {
            id: selectedProject.id,
            name: selectedProject.name
        };

        moveArticle(article.idReadable, project, parentArticle).then(({id}) => {
            redirectToArticle(id);
        }).catch((err: APIError) => {
            if (err.status === 403) {
                host.alert(t("errorMissingPermission"));
                return;
            }
            host.alert(t("errorMoveArticle"), AlertType.ERROR);
        }).finally(() => setButtonsLoading(false));
    }, [t]);

    if (loading) {
        return (
            <div className="flex justify-center items-center">
                <Loader message={t("loading")}/>
            </div>
        );
    }

    if (!article || !selectedProject) {
        return (
            <div className="w-full flex justify-center mt-12 text-base font-bold text-wrap">
                <span>{error}</span>
            </div>
        );
    }

    const moveButtonDisabled =
        selectedParentArticle === TOP_LEVEL_ARTICLE && article.parentArticle === null && selectedProject?.id === article.project.id
        || selectedParentArticle.id === article.parentArticle?.id;

    return (
        <form className="w-full flex flex-col gap-y-6 pr-1">
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
                    filter={{placeholder: t("filterItems")}}
                    onFilter={value => setProjectFilter(value)}
                    loading={projects == undefined}
                    loadingMessage={t("loading")}
                    notFoundMessage={t("noOptionsFound")}
                    onOpen={() => {
                        if (projects) {
                            return;
                        }
                        fetchProjects("");
                    }}
                    onClose={() => {
                        if (projectFilter !== "") {
                            setProjectFilter("");
                        }
                    }}
                    data={projects?.map(projectToSelectItem)}
                    onSelect={(item) => {
                        if (!item) {
                            return;
                        }
                        setSelectedProject(item.model);
                        setSelectedParentArticle(TOP_LEVEL_ARTICLE);
                    }}
                    selected={projectToSelectItem(selectedProject!)}
                    size={Size.FULL}
                />
            </div>

            <div>
                <label htmlFor="parentArticleSelection">{t("parentArticleSelectionLabel")}</label>
                <Select
                    id="parentArticleSelection"
                    filter={{placeholder: t("filterItems")}}
                    onFilter={(value) => setArticleFilter(value)}
                    loading={articles === undefined}
                    loadingMessage={t("loading")}
                    notFoundMessage={t("noOptionsFound")}
                    onOpen={() => {
                        if (!selectedProject || articles) return;
                        fetchArticles(selectedProject?.name, "");
                    }}
                    onClose={() => {
                        if (articleFilter !== "") {
                            setArticleFilter("");
                        }
                    }}
                    data={articles?.map(articleToSelectItem)}
                    onSelect={(item) => {
                        if (!item) {
                            return;
                        }
                        setSelectedParentArticle(item.model);
                    }}
                    selected={articleToSelectItem(selectedParentArticle)}
                    size={Size.FULL}
                />
            </div>

            <div className="mb-4">
                <Checkbox
                    id="includeDescendentsCheckbox"
                    defaultChecked={includeDescendents}
                    onChange={(event) => setIncludeDescendents(event.target.checked)}
                />
                <Tooltip title={t("includeDescendentsInfo")}>
                    <label htmlFor="includeDescendentsCheckbox">{t("includeDescendentsCheckboxLabel")} *</label>
                </Tooltip>
            </div>

            {
                !progressText ? (
                    <div className="flex grow gap-x-4">
                        <Button
                            primary
                            className="w-full"
                            loader={buttonsLoading}
                            onClick={() => handleCopy(selectedProject, selectedParentArticle, article, includeDescendents)}
                        >
                            {t("copyButtonLabel")}
                        </Button>
                        <Button
                            primary
                            className="w-full"
                            loader={!moveButtonDisabled && buttonsLoading}
                            disabled={moveButtonDisabled}
                            onClick={() => handleMove(selectedProject, selectedParentArticle, article)}
                        >
                            {t("moveButtonLabel")}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <Text>{progressText}</Text>
                        <ProgressBar value={currentProgress / totalProgress}/>
                    </div>
                )
            }
        </form>
    );
}
