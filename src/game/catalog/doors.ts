import type { CurseCard, MonsterBonusCard, WanderingCard } from "./types";

const cu = (x: Omit<CurseCard, "kind" | "deck" | "id"> & { id: string }): CurseCard => ({
  ...x,
  id: `curse.${x.id}`,
  kind: "curse",
  deck: "door",
});

export const CURSES: CurseCard[] = [
  // ---------- Instantâneas ----------
  cu({ id: "azar", name: "Azar do Aventureiro", curseType: "instant", text: "Perca 1 nível." }),
  cu({ id: "lich", name: "Maldição do Lich", curseType: "instant", text: "Perca 2 níveis (3 se você for nível 15 ou mais)." }),
  cu({ id: "vento", name: "Vento Traiçoeiro", curseType: "instant", text: "Perca o capacete." }),
  cu({ id: "ferrugem", name: "Ferrugem Súbita", curseType: "instant", text: "Perca o peitoral." }),
  cu({ id: "calcas", name: "Calças no Joelho", curseType: "instant", text: "Perca as calças." }),
  cu({ id: "botas", name: "Ladrão de Botas", curseType: "instant", text: "Perca as botas." }),
  cu({ id: "dedos", name: "Dedos Escorregadios", curseType: "instant", text: "Perca 2 anéis, à escolha de quem lançou a maldição." }),
  cu({ id: "montaria", name: "Montaria Fujona", curseType: "instant", text: "Perca a montaria." }),
  cu({ id: "mimico", name: "Mímico de Bolso", curseType: "instant", text: "Perca o item equipado de maior bônus." }),
  cu({ id: "mao-furada", name: "Mão Furada", curseType: "instant", text: "Descarte 2 cartas aleatórias da mão." }),
  cu({ id: "impostos", name: "Coleta de Impostos", curseType: "instant", text: "Dê 1 carta aleatória da mão a cada jogador de nível menor que o seu." }),
  cu({ id: "troca", name: "Troca Feérica", curseType: "instant", text: "Troque 1 item equipado com o jogador à sua esquerda (mesmo slot, escolha dele)." }),
  cu({ id: "amnesia", name: "Amnésia Profissional", curseType: "instant", text: "Descarte sua classe." }),
  cu({ id: "identidade", name: "Crise de Identidade", curseType: "instant", text: "Descarte sua raça; você vira Humano." }),
  // ---------- De combate ----------
  cu({ id: "fraqueza", name: "Fraqueza Súbita", curseType: "combat", text: "-3 em combate (-5 se o alvo for nível 11 ou mais)." }),
  cu({ id: "chumbo", name: "Pés de Chumbo", curseType: "combat", text: "O alvo não pode fugir." }),
  cu({ id: "escuro", name: "Medo do Escuro", curseType: "combat", text: "O monstro ganha +5." }),
  cu({ id: "isolamento", name: "Isolamento", curseType: "combat", text: "Ninguém pode ajudar o alvo." }),
  cu({ id: "silencio", name: "Silêncio Arcano", curseType: "combat", text: "O alvo não pode usar habilidades ativas." }),
  cu({ id: "horda", name: "Chamado da Horda", curseType: "combat", text: "Compre cartas de Porta até achar um monstro: ele entra no combate como Monstro Errante." }),
  cu({ id: "ilusao-traidora", name: "Ilusão Traidora", curseType: "combat", text: "O ajudante de maior nível do alvo passa para o lado do monstro." }),
  // ---------- Com duração ----------
  cu({ id: "corvo", name: "Corvo Agourento no Ombro", curseType: "duration", duration: 3, text: "-1 em todas as suas rolagens de dado." }),
  cu({ id: "sapo", name: "Maldição do Sapo", curseType: "duration", duration: 2, text: "-3 em combate e não pode usar itens de mão. Acaba antes se outro jogador descartar 1 carta para dar um beijo em você." }),
  cu({ id: "licantropia", name: "Licantropia", curseType: "duration", duration: 3, text: "+2 em combate, mas não pode usar armadura nem armas; conta como Animal." }),
  cu({ id: "ganancia", name: "Ganância Dracônica", curseType: "duration", duration: 3, text: "Você não pode vender, trocar nem dar itens." }),
  cu({ id: "riqueza", name: "Ilusão de Riqueza", curseType: "duration", duration: 2, text: "Você compra metade dos tesouros ao vencer (arredondado para baixo)." }),
  cu({ id: "sono", name: "Sono Encantado", curseType: "duration", duration: 1, text: "Você pula o seu próximo turno." }),
  // ---------- Persistentes ----------
  cu({ id: "podridao", name: "Podridão Antiga", curseType: "persistent", text: "-2 em combate. Água Benta também remove." }),
  cu({ id: "sombra", name: "Sombra Seguidora", curseType: "persistent", text: "Sempre que vencer um combate, você compra 1 tesouro a menos." }),
  cu({ id: "divida", name: "Dívida com o Diabo", curseType: "persistent", text: "No início de cada turno seu, descarte 1 carta da mão." }),
  cu({ id: "espada", name: "Espada Amaldiçoada", curseType: "persistent", text: "Ocupa 1 slot de mão e dá -3 em combate; não pode ser desequipada nem vendida." }),
  cu({ id: "coroa-espinhos", name: "Coroa de Espinhos", curseType: "persistent", text: "Você não pode ter item Lendário equipado; se tiver, ele vai para a mão." }),
  cu({ id: "marca", name: "Marca do Caçador", curseType: "persistent", text: "Todo monstro que você enfrentar ganha +2. Se você derrotar um monstro de nível 20 ou mais, a marca some." }),
];

const mb = (id: string, name: string, value: number, text: string, copies = 1): MonsterBonusCard => ({
  id: `bonus.${id}`,
  name,
  kind: "monsterBonus",
  deck: "door",
  value,
  copies,
  text: `${text} ${value > 0 ? "+" : ""}${value} de nível para um monstro em combate. Uso único.`,
});

export const MONSTER_BONUSES: MonsterBonusCard[] = [
  mb("faminto", "Faminto", 3, "Não come há dias.", 2),
  mb("enfurecido", "Enfurecido", 5, "Alguém pisou no rabo dele.", 2),
  mb("anciao", "Ancião", 10, "Viu reinos nascerem e caírem.", 1),
  mb("ferido", "Ferido", -3, "Já saiu de outra briga.", 2),
  mb("filhote", "Filhote", -5, "Ainda está aprendendo a rugir.", 2),
];

export const WANDERING: WanderingCard[] = [
  {
    id: "wandering.errante",
    name: "Monstro Errante",
    kind: "wandering",
    deck: "door",
    copies: 3,
    text: "Jogue junto com um monstro da sua mão em um combate em andamento: ele entra e luta junto com o primeiro.",
  },
];
