"use server";

/**
 * Persistance du module STOCKS dans Supabase (tables `articles` +
 * `mouvements_stock`, 0005 + entreprise_id 0011), sous RLS scopee par entreprise.
 *
 * Un article porte ses mouvements (entrees/sorties/inventaires). Le snapshot
 * (quantite en stock, CUMP, valeur) est calcule PAR LE MOTEUR cote serveur
 * (calculerStock, en rejouant les mouvements) et persiste sur la ligne article :
 * les autres modules (ex. Production/MRP) lisent ce snapshot.
 */
import { creerClientServeur } from "@/lib/supabase/server";
import { calculerStock } from "@/lib/engine";
import type { ArticleLocal, MouvementLocal } from "@/lib/achats-stock-data";
import type { ArticleStockInput, TypeArticle, TypeMouvement } from "@/lib/engine";

interface MvtRow {
  id: string;
  type: TypeMouvement;
  quantite: number | string;
  cout_unitaire: number | null;
  date_mouvement: string | null;
  note: string | null;
  created_at?: string;
}
interface ArticleRow {
  id: string;
  ref: string;
  designation: string;
  type: TypeArticle;
  unite: string;
  seuil_alerte: number | string;
  quantite: number | string;
  cump: number;
  valeur_stock: number;
  mouvements_stock?: MvtRow[];
}

const COLS =
  "id,ref,designation,type,unite,seuil_alerte,quantite,cump,valeur_stock,mouvements_stock(id,type,quantite,cout_unitaire,date_mouvement,note,created_at)";

function versMouvement(r: MvtRow): MouvementLocal {
  return {
    id: r.id,
    type: r.type,
    quantite: Number(r.quantite),
    coutUnitaire: r.cout_unitaire ?? undefined,
    date: r.date_mouvement ?? undefined,
    note: r.note ?? undefined,
  };
}

function versArticle(r: ArticleRow): ArticleLocal {
  const mouvements = (r.mouvements_stock ?? [])
    .slice()
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .map(versMouvement);
  return {
    id: r.id,
    ref: r.ref,
    designation: r.designation,
    type: r.type,
    unite: r.unite,
    seuilAlerte: Number(r.seuil_alerte),
    mouvements,
    quantite: Number(r.quantite),
    cump: Number(r.cump),
    valeurStock: Number(r.valeur_stock),
  };
}

function versInput(a: ArticleLocal): ArticleStockInput {
  return {
    ref: a.ref,
    designation: a.designation,
    type: a.type,
    unite: a.unite,
    seuilAlerte: a.seuilAlerte,
    mouvements: a.mouvements.map((m) => ({ type: m.type, quantite: m.quantite, coutUnitaire: m.coutUnitaire })),
  };
}

type Client = Awaited<ReturnType<typeof creerClientServeur>>;

/** Recharge un article, recalcule son snapshot (moteur) et le persiste. */
async function recalculerArticle(s: Client, articleId: string): Promise<ArticleLocal> {
  const { data } = await s.from("articles").select(COLS).eq("id", articleId).single();
  const art = versArticle(data as unknown as ArticleRow);
  const snap = calculerStock([versInput(art)]).articles[0];
  if (!snap) return art;
  await s
    .from("articles")
    .update({ quantite: snap.quantite, cump: snap.cump, valeur_stock: snap.valeurStock })
    .eq("id", articleId);
  return { ...art, quantite: snap.quantite, cump: snap.cump, valeurStock: snap.valeurStock };
}

export async function listerArticlesAction(entrepriseId: string): Promise<ArticleLocal[]> {
  if (!entrepriseId) return [];
  const s = await creerClientServeur();
  const { data, error } = await s
    .from("articles")
    .select(COLS)
    .eq("entreprise_id", entrepriseId)
    .order("designation");
  if (error || !data) return [];
  return (data as unknown as ArticleRow[]).map(versArticle);
}

/** Cree/met a jour la FICHE d'un article (les mouvements se gerent a part). */
export async function upsertArticleAction(entrepriseId: string, a: ArticleLocal): Promise<ArticleLocal> {
  const s = await creerClientServeur();
  const champs = {
    ref: a.ref.trim(),
    designation: a.designation.trim(),
    type: a.type,
    unite: a.unite.trim() || "unite",
    seuil_alerte: a.seuilAlerte,
  };
  if (a.id) {
    const { data, error } = await s.from("articles").update(champs).eq("id", a.id).select(COLS).single();
    if (error || !data) throw new Error(error?.message ?? "Enregistrement de l'article impossible.");
    return versArticle(data as unknown as ArticleRow);
  }
  const { data, error } = await s
    .from("articles")
    .insert({ entreprise_id: entrepriseId, ...champs })
    .select(COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Creation de l'article impossible.");
  return versArticle(data as unknown as ArticleRow);
}

export async function supprimerArticleAction(id: string): Promise<void> {
  const s = await creerClientServeur();
  const { error } = await s.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Ajoute un mouvement puis renvoie l'article recalcule (snapshot moteur). */
export async function ajouterMouvementAction(
  entrepriseId: string,
  articleId: string,
  m: MouvementLocal,
): Promise<ArticleLocal> {
  const s = await creerClientServeur();
  const { error } = await s.from("mouvements_stock").insert({
    entreprise_id: entrepriseId,
    article_id: articleId,
    type: m.type,
    quantite: m.quantite,
    cout_unitaire: m.type === "entree" && m.coutUnitaire ? Math.round(m.coutUnitaire) : null,
    date_mouvement: m.date || new Date().toISOString().slice(0, 10),
    note: m.note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return recalculerArticle(s, articleId);
}

export async function supprimerMouvementAction(articleId: string, mouvementId: string): Promise<ArticleLocal> {
  const s = await creerClientServeur();
  const { error } = await s.from("mouvements_stock").delete().eq("id", mouvementId);
  if (error) throw new Error(error.message);
  return recalculerArticle(s, articleId);
}
