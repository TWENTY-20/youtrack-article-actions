import {host} from "./youTrackApp.ts";
import {Article, ArticleBase, Attachment, Project} from "./types.ts";

export async function loadArticle(articleId: string) {
    return await host.fetchYouTrack(
        `articles/${articleId}?fields=id,project(id,name),attachments(id),childArticles(id),comments(id),content,hasChildren,idReadable,parentArticle(id,summary),summary,visibility(id)`
    ) as Article;
}

export async function isArticleDraft(articleId: string) {
    return await host.fetchYouTrack<{
        $type: string
    }>(`users/me/articleDrafts/${articleId}`).then(({$type}) => $type === "ArticleDraft").catch(() => false);
}

export async function loadProjects(filter: string) {
    return await host.fetchYouTrack(`admin/projects?fields=id,name&query=${filter}`) as Project[];
}

export async function loadProjectArticles(projectName: string, filter: string) {
    return await host.fetchYouTrack(`articles?fields=id,idReadable,summary&query=${filter === "" ? "" : `{${filter}}+`}project:{${projectName}}`) as ArticleBase[];
}

export async function copyArticle(article: Article) {
    return await host.fetchYouTrack(`articles?fields=id,idReadable,summary`, {
        method: "POST",
        body: article
    }) as ArticleBase;
}

export async function loadAndCopyAttachmentsToArticle(oldArticleId: string, newArticleId: string) {
    const attachments: Attachment[] = await host.fetchYouTrack(`articles/${oldArticleId}/attachments?fields=id,name,base64Content,visibility(id)&muteUpdateNotifications=true`);
    const results: ({
        status: "success";
        id: string;
        name: string;
    } | {
        status: "rejected";
        oldName: string;
    })[] = [];
    for (const att of attachments) {
        let fileName = att.name ?? "missing-name";
        const formData = new FormData();
        await fetch(att.base64Content ?? "data:;base64")
            .then(res => res.blob()).then((blob) => formData.append(fileName, new File([blob], fileName)));

        const tempResponse = new Response(formData);
        const blobBody = await tempResponse.blob();
        const contentType = tempResponse.headers.get("content-type");

        let result: {
            status: "success";
            id: string;
            name: string;
        } | {
            status: "rejected";
            oldName: string;
        };
        try {
            const response = await host.fetchYouTrack<{
                id: string;
                name: string;
            }>(`articles/${newArticleId}/attachments?fields=id,name`, {
                method: "POST",
                headers: {
                    "Content-Type": contentType ?? "multipart/form-data",
                },
                sendRawBody: true,
                body: blobBody
            });
            result = {
                status: "success",
                id: response.id,
                name: response.name,
            };
        } catch (e) {
            console.error(`Failed to upload attachment ${fileName} for article ${newArticleId}:`, e);
            result = {
                status: "rejected",
                oldName: fileName,
            };
        }
        results.push(result);
    }
    return results;
}

export async function moveArticle(idReadable: string, project: Project, parentArticle?: ArticleBase) {
    return await host.fetchYouTrack(`articles/${idReadable}?fields=id,idReadable,summary`, {
        method: "POST",
        body: {
            parentArticle: parentArticle ?? null,
            project: project
        }
    }) as ArticleBase;
}
