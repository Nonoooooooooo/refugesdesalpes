// Liens vers les pages statiques des massifs (générées au build par scripts/seo/generate.js).
// Accessible aux lecteurs d'écran et aux robots : la carte, elle, n'expose aucun lien explorable.
const MASSIFS = [
  ['mont-blanc', 'Mont-Blanc'],
  ['chablais', 'Chablais'],
  ['aravis', 'Aravis'],
  ['bauges', 'Bauges'],
  ['beaufortain', 'Beaufortain'],
  ['haute-tarentaise', 'Haute-Tarentaise'],
  ['vanoise', 'Vanoise'],
  ['maurienne', 'Maurienne'],
  ['haute-maurienne', 'Haute-Maurienne'],
  ['thabor', 'Thabor'],
  ['belledonne', 'Belledonne'],
  ['grandes-rousses', 'Grandes-Rousses'],
  ['chartreuse', 'Chartreuse'],
  ['vercors', 'Vercors'],
  ['oisans', 'Oisans'],
  ['pelvoux', 'Pelvoux'],
  ['champsaur', 'Champsaur'],
  ['devoluy', 'Dévoluy'],
  ['embrunais-parpaillon', 'Embrunais-Parpaillon'],
  ['queyras', 'Queyras'],
  ['ubaye', 'Ubaye'],
  ['haut-var-haut-verdon', 'Haut-Var et Haut-Verdon'],
  ['mercantour', 'Mercantour'],
]

export default function MassifLinks() {
  return (
    <nav className="sr-only" aria-label="Massifs des Alpes">
      <a href="/massifs">Tous les massifs des Alpes et leurs refuges</a>
      <a href="/faq">Questions fréquentes</a>
      <a href="/a-propos">À propos et sources des données</a>
      <ul>
        {MASSIFS.map(([slug, name]) => (
          <li key={slug}>
            <a href={`/massif/${slug}`}>Refuges du massif {name}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
