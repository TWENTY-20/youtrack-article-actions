import { host } from "./youTrackApp.ts";
import { Article, Attachment, Project } from "./types.ts";

export async function loadArticle(articleId: string) {
    return await host.fetchYouTrack(
        `articles/${articleId}?fields=id,project(id,name),attachments(id),childArticles(id),comments(id),content,hasChildren,idReadable,ordinal,summary,visibility(id)`
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

export async function copyChildArticle(parentArticleId: string, article: Article) {
    const newId = await copyArticle(article).then((res) => res.id);

    return await host.fetchYouTrack(`articles/${parentArticleId}/childArticles?fields=id`, {
        method: "POST",
        body: { ...article, idReadable: undefined, id: newId }
    }) as Pick<Article, "id">;
}

export async function loadAndCopyAttachmentsToArticle(oldArticleId: string, newArticleId: string) {
    const attachments: Attachment[] = await host.fetchYouTrack(`articles/${oldArticleId}/attachments?fields=id,name,base64Content,visibility(id)&muteUpdateNotifications=true`);
    const attachmentRequests = attachments.map(async (att) => {
        let fileName = att.name ?? "missing-name";
        const formData = new FormData();
        await fetch(att.base64Content ?? "data:;base64")
            .then(res => res.blob()).then((blob) => formData.append(fileName, new File([blob], fileName)));

        return await host.fetchYouTrack(`articles/${newArticleId}/attachments?fields=id,name`, {
            method: "POST",
            headers: {
                "Content-Type": undefined,
            },
            sendRawBody: true,

            body: formData
        });
    });
    const results = await Promise.allSettled(attachmentRequests);
    return results.map((result, index) => ({
        status: result.status,
        id: attachments[index].id,
        name: attachments[index].name,
    }));
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
