import { PrevisionnelClient } from "../../../components/previsionnel/PrevisionnelClient";
import { exempleBoulangerie } from "../../../lib/engine";

/** Page serveur : injecte le jeu d'exemple, le reste est gere cote client. */
export default function Page() {
  return <PrevisionnelClient exemple={exempleBoulangerie} />;
}
