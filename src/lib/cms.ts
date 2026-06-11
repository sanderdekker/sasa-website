/**
 * Payload CMS REST API client — SASA
 *
 * Haalt gepubliceerde Posts op via de Payload REST API.
 * Draait alleen tijdens de Astro build (server-side), nooit in de browser.
 */

import { fallbackImage } from './fallbackImages';

const CMS_BASE = (import.meta.env.CMS_URL as string | undefined) ?? 'http://localhost:3001';
const SITE_SLUG = (import.meta.env.CMS_SITE_SLUG as string | undefined) ?? 'sasa';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CmsPost {
  id: number;
  title: string;
  slug: string;
  /** Korte samenvatting (max 280 tekens) — voor overzichtslijsten */
  excerpt: string;
  /** ISO timestamp, bijv. "2026-05-20T10:00:00.000Z" */
  publishDate: string;
  /** Geschatte leestijd, bijv. "4" (minuten als string) */
  readTime: string;
  category: string;
  tags: { tag: string }[];
  heroImage: { url: string; alt: string } | null;
  author: {
    fullName: string;
    authorRole: string;
    avatar: { url: string } | null;
  } | null;
  /** Lexical JSON-structuur — gebruik lexicalToHtml() om te renderen */
  body: LexicalRoot | null;
}

// Lexical-node types (minimale definitie voor de serializer)
interface LexicalRoot {
  root: LexicalNode;
}

interface FaqItem {
  question?: string;
  answer?: string;
}

interface LexicalNode {
  type: string;
  tag?: string;
  text?: string;
  url?: string;
  listType?: 'bullet' | 'number';
  format?: number; // bitmask: 1=bold, 2=italic, 8=underline
  children?: LexicalNode[];
  // fields draagt zowel link-data (url/newTab/doc) als block-data (FAQ) afhankelijk van het nodetype.
  fields?: {
    url?: string;
    newTab?: boolean;
    linkType?: 'custom' | 'internal';
    doc?: { relationTo?: string; value?: { slug?: string } | string | number };
    blockType?: string;
    heading?: string;
    items?: FaqItem[];
  };
}

/**
 * Bepaalt de href van een link-node. Custom links gebruiken de url; interne links
 * worden opgelost naar het juiste pad op basis van de gekoppelde collectie + slug.
 */
function resolveLinkHref(node: LexicalNode): string {
  const f = node.fields;
  if (f?.linkType === 'internal' && f.doc && typeof f.doc.value === 'object' && f.doc.value?.slug) {
    const slug = f.doc.value.slug;
    return f.doc.relationTo === 'posts' ? `/blog/${slug}` : `/${slug}`;
  }
  return f?.url ?? node.url ?? '#';
}

// ---------------------------------------------------------------------------
// Interne fetch-helper
// ---------------------------------------------------------------------------

async function fetchCms<T>(path: string): Promise<T> {
  const url = `${CMS_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`CMS niet bereikbaar op ${url}: ${String(err)}`);
  }
  if (!res.ok) {
    throw new Error(`CMS antwoordde ${res.status} voor ${url}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Publieke functies
// ---------------------------------------------------------------------------

/**
 * Haal alle gepubliceerde posts op voor deze site, gesorteerd nieuwste eerst.
 */
export async function getPosts(): Promise<CmsPost[]> {
  const params = new URLSearchParams({
    'where[_status][equals]': 'published',
    'where[site__slug][equals]': SITE_SLUG,
    sort: '-publishDate',
    depth: '2',
    limit: '100',
  });
  const data = await fetchCms<{ docs: CmsPost[] }>(`/api/posts?${params}`);
  return data.docs;
}

/**
 * Haal één post op via slug. Geeft null terug als niet gevonden.
 */
export async function getPostBySlug(slug: string): Promise<CmsPost | null> {
  const params = new URLSearchParams({
    'where[_status][equals]': 'published',
    'where[site__slug][equals]': SITE_SLUG,
    'where[slug][equals]': slug,
    depth: '2',
    limit: '1',
  });
  const data = await fetchCms<{ docs: CmsPost[] }>(`/api/posts?${params}`);
  return data.docs[0] ?? null;
}

/**
 * Resolveert de hero-afbeelding van een post: CMS-beeld als dat er is,
 * anders de fallback-map op basis van slug.
 */
export function postImage(post: Pick<CmsPost, 'slug' | 'heroImage'>, width = 1400): string {
  return post.heroImage?.url ?? fallbackImage(post.slug, width);
}

/**
 * Geeft alle slugs terug — voor Astro's getStaticPaths().
 */
export async function getAllPostSlugs(): Promise<string[]> {
  const params = new URLSearchParams({
    'where[_status][equals]': 'published',
    'where[site__slug][equals]': SITE_SLUG,
    depth: '0',
    limit: '100',
    'select[slug]': 'true',
  });
  const data = await fetchCms<{ docs: { slug: string }[] }>(`/api/posts?${params}`);
  return data.docs.map((d) => d.slug);
}

// ---------------------------------------------------------------------------
// Lexical → HTML serializer
// ---------------------------------------------------------------------------

/**
 * Converteert Lexical JSON (uit Payload CMS) naar een HTML-string.
 * Ondersteunt: paragrafen, koppen, bold/italic/underline, links, lijsten.
 */
export function lexicalToHtml(body: LexicalRoot | null | unknown): string {
  if (!body || typeof body !== 'object') return '';
  const root = (body as LexicalRoot).root;
  if (!root) return '';
  return serializeChildren(root.children ?? []);
}

function serializeChildren(nodes: LexicalNode[]): string {
  return nodes.map(serializeNode).join('');
}

function serializeNode(node: LexicalNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${serializeChildren(node.children ?? [])}</p>`;

    case 'heading': {
      const tag = node.tag ?? 'h2';
      return `<${tag}>${serializeChildren(node.children ?? [])}</${tag}>`;
    }

    case 'list': {
      const tag = node.listType === 'number' ? 'ol' : 'ul';
      return `<${tag}>${serializeChildren(node.children ?? [])}</${tag}>`;
    }

    case 'listitem':
      return `<li>${serializeChildren(node.children ?? [])}</li>`;

    case 'link': {
      const href = resolveLinkHref(node);
      const target = node.fields?.newTab ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${escapeAttr(href)}"${target}>${serializeChildren(node.children ?? [])}</a>`;
    }

    case 'text': {
      let text = escapeHtml(node.text ?? '');
      const fmt = node.format ?? 0;
      if (fmt & 1) text = `<strong>${text}</strong>`;   // bold
      if (fmt & 2) text = `<em>${text}</em>`;           // italic
      if (fmt & 8) text = `<u>${text}</u>`;             // underline
      return text;
    }

    case 'linebreak':
      return '<br>';

    case 'block': {
      // Payload block-node. Voorlopig alleen het FAQ-block (accordions).
      if (node.fields?.blockType === 'faq') {
        const heading = node.fields.heading
          ? `<h2>${escapeHtml(node.fields.heading)}</h2>`
          : '';
        const items = (node.fields.items ?? [])
          .map(
            (it) =>
              `<details class="faq-item"><summary>${escapeHtml(it.question ?? '')}</summary>` +
              `<div class="faq-answer"><p>${escapeHtml(it.answer ?? '')}</p></div></details>`,
          )
          .join('');
        return `<section class="faq">${heading}${items}</section>`;
      }
      // Onbekend blocktype: render eventuele children, anders niets.
      return serializeChildren(node.children ?? []);
    }

    default:
      if (node.children?.length) return serializeChildren(node.children);
      return escapeHtml(node.text ?? '');
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;');
}
