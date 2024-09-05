import YTApp, { host } from "./youTrackApp.ts";
import { Article, Project } from "./types.ts";

export async function loadArticle() {
    return await host.fetchYouTrack(
        `articles/${YTApp.entity.id}?fields=id,attachments(id),childArticles(id,hasChildren),comments(id),content,hasChildren,idReadable,ordinal,summary,visibility(id)`
    ) as Article;
}

export async function loadProjects() {
    return await host.fetchYouTrack(`admin/projects?fields=id,name`) as Project[];
}

export async function copyArticle(article: Article) {
    return await host.fetchYouTrack(`articles?fields=id`, {
        method: "POST",
        body: article
    }) as Pick<Article, "id">;
}

export async function moveArticle(idReadable: string, project: Project, parentArticle?: Pick<Article, "idReadable">) {
    return await host.fetchYouTrack(`articles/${idReadable}?fields=id`, {
        method: "POST",
        body: {
            parentArticle: parentArticle ?? null,
            project: project
        }
    }) as Pick<Article, "id">;
}
