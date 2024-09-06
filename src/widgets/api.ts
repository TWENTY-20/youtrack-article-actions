import YTApp, { host } from "./youTrackApp.ts";
import { Article, Attachment, Project } from "./types.ts";

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

export async function loadAndCopyAttachmentsToArticle(oldArticleId: string, newArticleId: string) {
    const attachments: Attachment[] = await host.fetchYouTrack(`articles/${oldArticleId}/attachments?fields=id,name,author,created,updated,size,extension,charset,mimeType,metaData,draft,removed,base64Content,url,visibility(id),article(id),comment(id)&muteUpdateNotifications=true`);
    const attachmentRequests = attachments.map(async (att) => {
        let fileName = att.name ?? "missing-name"
        const formData = new FormData();
        await fetch(att.base64Content ?? "data:;base64")
            .then(res => res.blob()).then((blob) => formData.append(fileName, new File([blob], fileName)));

        return await host.fetchYouTrack(`articles/${newArticleId}/attachments?fields=id,name`, {
            method: "POST",
            headers:{
                'Content-Type': undefined,
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
