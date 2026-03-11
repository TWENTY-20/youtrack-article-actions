import {host} from "./youTrackApp.ts";
import {Article, ArticleBase, Attachment, Project} from "./types.ts";

export async function loadArticle(articleId: string): Promise<Article> {
    return await host.fetchYouTrack<Article>(
        `articles/${articleId}?fields=id,project(id,name),attachments(id),childArticles(id),comments(id),content,hasChildren,idReadable,parentArticle(id,summary),summary,reporter(id),tags(id),visibility(id)`
    );
}

export async function isArticleDraft(articleId: string): Promise<boolean> {
    return await host.fetchYouTrack<{
        $type: string
    }>(`users/me/articleDrafts/${articleId}`).then(({$type}) => $type === "ArticleDraft").catch(() => false);
}

export async function loadProjects(filter: string): Promise<Project[]> {
    return await host.fetchYouTrack<Project[]>(`admin/projects?fields=id,name&query=${filter}`);
}

export async function loadProjectArticles(projectName: string, filter: string): Promise<ArticleBase[]> {
    return await host.fetchYouTrack<ArticleBase[]>(`articles?fields=id,idReadable,summary&query=${filter === "" ? "" : `{${filter}}+`}project:{${projectName}}`);
}

export async function copyArticle(article: Partial<Article>): Promise<ArticleBase> {
    return await host.fetchYouTrack<ArticleBase>(`articles?fields=id,idReadable,summary`, {
        method: "POST",
        body: article
    });
}

export async function loadAttachments(articleId: string): Promise<Attachment[]> {
    return await host.fetchYouTrack<Attachment[]>(`articles/${articleId}/attachments?fields=id,name,base64Content`);
}

export async function copyAttachment(targetArticleId: string, attachment: Attachment): Promise<void> {
    let fileName = attachment.name ?? "missing-name";
    const formData = new FormData();
    await fetch(attachment.base64Content ?? "data:;base64")
        .then(res => res.blob()).then((blob) => formData.append(fileName, new File([blob], fileName)));

    const tempResponse = new Response(formData);
    const blobBody = await tempResponse.blob();
    const contentType = tempResponse.headers.get("content-type");

    return await host.fetchYouTrack(`articles/${targetArticleId}/attachments?fields=id,name`, {
        method: "POST",
        headers: {
            "Content-Type": contentType ?? "multipart/form-data",
        },
        sendRawBody: true,
        body: blobBody
    });
}

export async function moveArticle(idReadable: string, project: Project, parentArticle?: ArticleBase): Promise<ArticleBase> {
    return await host.fetchYouTrack<ArticleBase>(`articles/${idReadable}?fields=id,idReadable,summary`, {
        method: "POST",
        body: {
            parentArticle: parentArticle ?? null,
            project: project
        }
    });
}

export async function countAllArticlesAndAttachments(articleId: string, includeDescendents: boolean): Promise<number> {
    const {attachments, childArticles} = await host.fetchYouTrack<{
        attachments: { id: string }[],
        childArticles: { id: string }[]
    }>(`articles/${articleId}`, {
        query: {
            fields: "attachments(id),childArticles(id)"
        }
    });

    let count = 1 + attachments.length;

    if (includeDescendents) {
        for (const child of childArticles) {
            count += await countAllArticlesAndAttachments(child.id, includeDescendents);
        }
    }

    return count;
}