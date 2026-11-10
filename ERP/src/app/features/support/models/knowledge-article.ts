export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  body: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticleInput {
  title: string;
  category: string;
  body: string;
  published: boolean;
}
